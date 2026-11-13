import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BankId } from './banks/types.js';

/** Everything private (browser profiles, config, Firebase key, logs) lives outside the repo. */
export const HOME_DIR = process.env['GASTOS_SCRAPER_HOME'] ?? join(homedir(), '.gastos-scraper');

export const PATHS = {
  home: HOME_DIR,
  profile: (bank: BankId) => join(HOME_DIR, 'profiles', bank),
  config: join(HOME_DIR, 'config.json'),
  serviceAccount: join(HOME_DIR, 'service-account.json'),
  state: join(HOME_DIR, 'state.json'),
  seen: join(HOME_DIR, 'seen.json'),
  lock: join(HOME_DIR, 'scrape.lock'),
  logs: join(HOME_DIR, 'logs'),
};

/** Sanitized discover dumps (no real data) — inside the repo but gitignored. */
export const DISCOVER_DIR = fileURLToPath(new URL('../.discover/', import.meta.url));
export const SCRAPER_DIR = fileURLToPath(new URL('../', import.meta.url));

export interface ScraperConfig {
  /** Firebase Auth uid of the app user whose `users/{uid}/data/cards` doc gets written. */
  uid: string;
  banks: BankId[];
  /** Last 4 digits of the cards to track per bank. Missing/empty = all credit cards. */
  tarjetas?: Partial<Record<BankId, string[]>>;
  /** Android Virtual Device with the Mercado Pago app logged in. */
  avd?: string;
}

export interface ScraperState {
  lastSuccess: Partial<Record<BankId, string>>;
  /** Browser mode that last worked per bank ('offscreen' when headless gets rejected). */
  mode?: Partial<Record<BankId, 'headless' | 'offscreen'>>;
}

export async function ensureHome(): Promise<void> {
  await mkdir(PATHS.logs, { recursive: true, mode: 0o700 });
}

export async function loadConfig(): Promise<ScraperConfig> {
  try {
    return JSON.parse(await readFile(PATHS.config, 'utf8')) as ScraperConfig;
  } catch {
    throw new Error(`No hay config en ${PATHS.config}. Corré: npm run setup`);
  }
}

export async function saveConfig(config: ScraperConfig): Promise<void> {
  await ensureHome();
  await writeFile(PATHS.config, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export async function loadState(): Promise<ScraperState> {
  try {
    return JSON.parse(await readFile(PATHS.state, 'utf8')) as ScraperState;
  } catch {
    return { lastSuccess: {} };
  }
}

export async function saveState(state: ScraperState): Promise<void> {
  await writeFile(PATHS.state, JSON.stringify(state, null, 2), { mode: 0o600 });
}
