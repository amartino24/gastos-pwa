/**
 * Daily run (launchd). Logs only counts — never amounts, merchants or credentials.
 *   --force      ignore the "already ran in the last 20h" guard
 *   --headed     show the browser (debugging selectors)
 *   --dry-run    don't write to Firestore
 *   --bank=x     only this bank
 *   --show       print totals to YOUR terminal (never written to the log file by launchd)
 */
import { open, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { ADAPTERS, adapterFor } from './banks/index.js';
import type { BankId, CardSnapshot, Credentials } from './banks/types.js';
import { PATHS, ensureHome, loadConfig, loadState, saveState, type ScraperState } from './config.js';
import { writeBank, type CardResult } from './firestore.js';
import { forecastNextStatement } from './forecast.js';
import { readSecret } from './keychain.js';
import { SERIALIZE_DOM_JS, renderDom, stripQuery, type DomNode } from './sanitize.js';
import { loadSeen, markSeen, pruneSeen, saveSeen } from './seen.js';

const MIN_HOURS_BETWEEN_RUNS = 20;
const STALE_LOCK_MS = 30 * 60 * 1000;

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const onlyBank = args.find(a => a.startsWith('--bank='))?.split('=')[1];

const log = (msg: string) => console.log(`${new Date().toISOString()} ${msg}`);

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function acquireLock(): Promise<boolean> {
  try {
    const s = await stat(PATHS.lock);
    const pid = Number(await readFile(PATHS.lock, 'utf8'));
    const alive = pid > 0 && pid !== process.pid && processAlive(pid);
    if (alive && Date.now() - s.mtimeMs < STALE_LOCK_MS) return false;
    await rm(PATHS.lock, { force: true }); // owner died (Ctrl+C, crash) or lock too old
  } catch {
    /* no lock */
  }
  try {
    const fh = await open(PATHS.lock, 'wx');
    await fh.writeFile(String(process.pid));
    await fh.close();
    return true;
  } catch {
    return false;
  }
}

async function credentialsFor(bank: BankId): Promise<Credentials> {
  const creds: Credentials = {};
  for (const f of ADAPTERS[bank].credentialFields) creds[f.key] = await readSecret(bank, f.key);
  return creds;
}

/** Masked structure of the page at the moment of failure (same masking as discover). */
async function dumpFailure(page: Page, bank: BankId): Promise<void> {
  try {
    let out = '';
    for (const frame of page.frames()) {
      const tree = (await frame.evaluate(SERIALIZE_DOM_JS).catch(() => null)) as DomNode | null;
      if (tree) out += `URL: ${stripQuery(frame.url())}\n\n${renderDom(tree)}\n`;
    }
    await writeFile(join(PATHS.logs, `fail-${bank}.txt`), out, { mode: 0o600 });
    log(`${bank}: captura enmascarada del error en logs/fail-${bank}.txt`);
  } catch {
    /* best effort */
  }
}

/** Banks may open new windows and close the original one: use the newest open page. */
function livePage(ctx: BrowserContext, fallback: Page): Page {
  return ctx.pages().filter(p => !p.isClosed()).at(-1) ?? fallback;
}

type BrowserMode = 'headless' | 'offscreen' | 'headed';

/** Sends the browser window to the Dock right away so it doesn't sit in front of everything. */
async function minimizeWindow(ctx: BrowserContext, page: Page): Promise<void> {
  try {
    const cdp = await ctx.newCDPSession(page);
    const { windowId } = (await cdp.send('Browser.getWindowForTarget')) as { windowId: number };
    await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } });
    await cdp.detach();
  } catch {
    /* best effort */
  }
}

async function runBank(bank: BankId, tarjetas: string[], mode: BrowserMode): Promise<CardSnapshot[]> {
  const adapter = ADAPTERS[bank];
  const ctx = await chromium.launchPersistentContext(PATHS.profile(bank), {
    // Full Chromium ("new headless" when headless): the default headless shell is easy for bank anti-fraud to spot.
    channel: 'chromium',
    headless: mode === 'headless',
    // Plan B for banks that reject headless: a real window, minimized to the Dock right after launch.
    // Minimized windows must not get throttled, or the bank's SPA stalls.
    args:
      mode === 'offscreen'
        ? [
            '--window-size=1280,900',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
          ]
        : [],
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  if (mode === 'offscreen') await minimizeWindow(ctx, page);
  try {
    await page.goto(adapter.startUrl);
    await adapter.login(page, await credentialsFor(bank));
    return await adapter.scrape(page, { tarjetas });
  } catch (err) {
    await dumpFailure(livePage(ctx, page), bank);
    throw err;
  } finally {
    await adapter.logout?.(livePage(ctx, page)).catch(() => log(`${bank}: no se pudo cerrar sesión`));
    await ctx.close();
  }
}

/**
 * Tries the mode that worked last time for this bank (headless by default); if it
 * fails, retries once off-screen and remembers whichever mode succeeded.
 */
async function runWithFallback(bank: BankId, tarjetas: string[], state: ScraperState): Promise<CardSnapshot[]> {
  if (flag('headed')) return runBank(bank, tarjetas, 'headed');
  const first: BrowserMode = state.mode?.[bank] ?? 'headless';
  try {
    return await runBank(bank, tarjetas, first);
  } catch (err) {
    if (first !== 'headless') throw err;
    const msg = err instanceof Error ? err.message.split('\n')[0] : String(err);
    log(`${bank}: falló sin ventana (${msg}); reintento con ventana minimizada`);
    const result = await runBank(bank, tarjetas, 'offscreen');
    state.mode = { ...(state.mode ?? {}), [bank]: 'offscreen' };
    return result;
  }
}

/**
 * Keeps the Mac awake while this run lasts (it may have been woken by the scheduled
 * `pmset` wake and would otherwise fall back asleep mid-login). Ends with this process.
 */
function stayAwake(): void {
  try {
    spawn('caffeinate', ['-i', '-s', '-w', String(process.pid)], { stdio: 'ignore' }).unref();
  } catch {
    /* not macOS / not available */
  }
}

async function main(): Promise<void> {
  stayAwake();
  await ensureHome();
  if (!(await acquireLock())) {
    log('otra corrida en curso, salgo');
    return;
  }
  try {
    const config = await loadConfig();
    const state = await loadState();
    const seen = await loadSeen();
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
    const banks = onlyBank ? [adapterFor(onlyBank).id] : config.banks;

    for (const bank of banks) {
      const last = state.lastSuccess[bank];
      if (!flag('force') && last && Date.now() - Date.parse(last) < MIN_HOURS_BETWEEN_RUNS * 3600_000) {
        log(`${bank}: ya corrió ${last}, salteo`);
        continue;
      }
      const updatedAt = new Date().toISOString();
      try {
        const snapshots = await runWithFallback(bank, config.tarjetas?.[bank] ?? [], state);
        const nuevos = markSeen(seen, bank, snapshots, today);
        const tarjetas: CardResult[] = snapshots.map((c, i) => ({ ...c, forecast: forecastNextStatement(c), nuevos: nuevos[i]! }));
        if (!flag('dry-run')) {
          await writeBank(config.uid, bank, { updatedAt, ok: true, tarjetas });
          pruneSeen(seen, today);
          await saveSeen(seen);
          state.lastSuccess[bank] = updatedAt;
          await saveState(state);
        }
        const movs = tarjetas.reduce((n, t) => n + t.pendientes.length, 0);
        const nuevosTotal = nuevos.reduce((a, b) => a + b, 0);
        log(`${bank}: OK — ${tarjetas.length} tarjeta(s), ${movs} consumo(s), ${nuevosTotal} nuevo(s)${flag('dry-run') ? ' [dry-run]' : ''}`);
        if (flag('show')) {
          for (const t of tarjetas) {
            console.log(
              `   ${t.tarjeta}: próximo resumen ≈ $ ${t.forecast.ARS.toLocaleString('es-AR')} + U$S ${t.forecast.USD.toLocaleString('es-AR')}` +
                ` (banco: $ ${t.totalBanco?.ARS.toLocaleString('es-AR') ?? '-'}) · cierre ${t.cierre ?? '?'} · vto ${t.vencimiento ?? '?'}`,
            );
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message.split('\n')[0]! : String(err);
        log(`${bank}: ERROR — ${message}`);
        if (!flag('dry-run')) await writeBank(config.uid, bank, { updatedAt, ok: false, error: message }).catch(() => {});
      }
    }
  } finally {
    await rm(PATHS.lock, { force: true });
  }
}

await main();
