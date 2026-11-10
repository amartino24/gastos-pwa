/**
 * Long-running agent (launchd KeepAlive). Listens to `users/{uid}/data/scrapeRequests`,
 * which the PWA writes when you tap "Actualizar", and runs the scraper for that bank.
 *
 * Doc shape (per bank):
 *   requestedAt     set by the app
 *   handledRequest  copy of the requestedAt we already took (no clock comparisons)
 *   state           'waiting' (min gap between runs) | 'running' | 'idle'
 *   startedAt / finishedAt
 * plus `watcher.heartbeatAt` so the app can tell whether the Mac is online.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { BankId } from './banks/types.js';
import { access } from 'node:fs/promises';
import { PATHS, SCRAPER_DIR, ensureHome, loadConfig } from './config.js';
import { restoreSleep } from './sleep-guard.js';
import { firestore } from './firestore.js';

const HEARTBEAT_MS = 5 * 60_000;
/** Santander blocks logins for ~5 min after a session; never hit a bank faster than this. */
const MIN_GAP_MS = 6 * 60_000;
const MAX_REQUEST_AGE_MS = 12 * 3_600_000;

interface BankRequest {
  requestedAt?: string;
  handledRequest?: string;
  state?: 'waiting' | 'running' | 'idle';
}

const log = (msg: string) => console.log(`${new Date().toISOString()} [watch] ${msg}`);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

await ensureHome();
const config = await loadConfig();
const db = await firestore();
const ref = db.doc(`users/${config.uid}/data/scrapeRequests`);
const tsxCli = createRequire(import.meta.url).resolve('tsx/cli');
const scrapeScript = join(SCRAPER_DIR, 'src', 'scrape.ts');

const queue: { bank: BankId; request: string }[] = [];
const lastStart = new Map<BankId, number>();
let busy = false;
let inFlight: string | null = null;

function runScrape(bank: BankId): Promise<number> {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [tsxCli, scrapeScript, '--force', `--bank=${bank}`], {
      cwd: SCRAPER_DIR,
      stdio: 'inherit',
    });
    child.on('exit', code => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
}

async function pump(): Promise<void> {
  if (busy) return;
  const next = queue.shift();
  if (!next) return;
  busy = true;
  const { bank, request } = next;
  inFlight = request;
  try {
    // Mark it taken right away so the app shows "Actualizando…" and it isn't re-queued.
    const wait = MIN_GAP_MS - (Date.now() - (lastStart.get(bank) ?? 0));
    if (wait > 0) {
      // Taken, but waiting: the app shows a countdown instead of "Actualizando…".
      const waitingUntil = new Date(Date.now() + wait).toISOString();
      await ref.set({ [bank]: { handledRequest: request, state: 'waiting', waitingUntil } }, { merge: true });
      log(`${bank}: corrió hace poco, espero ${Math.ceil(wait / 1000)}s`);
      await sleep(wait);
    }
    await ref.set({ [bank]: { handledRequest: request, state: 'running', startedAt: new Date().toISOString() } }, { merge: true });
    lastStart.set(bank, Date.now());
    log(`${bank}: pedido desde la app, corriendo`);
    const code = await runScrape(bank);
    log(`${bank}: terminó (exit ${code})`);
  } catch (err) {
    log(`${bank}: error del watcher — ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await ref.set({ [bank]: { state: 'idle', finishedAt: new Date().toISOString() } }, { merge: true }).catch(() => {});
    busy = false;
    inFlight = null;
    void pump();
  }
}

/** If a run crashed while holding "disablesleep", give the Mac its sleep back. */
async function sleepSafetyNet(): Promise<void> {
  const running = await access(PATHS.lock).then(() => true, () => false);
  if (!running && !busy) await restoreSleep();
}

let failedHeartbeats = 0;

async function heartbeat(): Promise<void> {
  await sleepSafetyNet();
  try {
    await ref.set({ watcher: { heartbeatAt: new Date().toISOString() } }, { merge: true });
    failedHeartbeats = 0;
  } catch (err) {
    failedHeartbeats++;
    log(`heartbeat falló — ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
    // After the Mac sleeps the gRPC channel can stay stuck forever (and the listener with it).
    // Exit so launchd (KeepAlive) starts us again with a fresh connection.
    if (failedHeartbeats >= 2 && !busy) {
      log('conexión colgada, reinicio el watcher');
      process.exit(1);
    }
  }
}

ref.onSnapshot(
  snap => {
    const data = (snap.data() ?? {}) as Partial<Record<BankId, BankRequest>>;
    for (const bank of config.banks) {
      const r = data[bank];
      if (!r?.requestedAt || r.handledRequest === r.requestedAt || r.requestedAt === inFlight) continue;
      if (queue.some(q => q.bank === bank)) continue;
      if (Date.now() - Date.parse(r.requestedAt) > MAX_REQUEST_AGE_MS) continue;
      queue.push({ bank, request: r.requestedAt });
    }
    void pump();
  },
  err => {
    log(`escucha falló — ${err.message}; salgo para que launchd me reinicie`);
    process.exit(1);
  },
);

await heartbeat();
setInterval(() => void heartbeat(), HEARTBEAT_MS);
log(`escuchando pedidos para ${config.banks.join(', ')}`);
