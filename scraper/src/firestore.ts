import { readFile } from 'node:fs/promises';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { BankId, CardSnapshot, ServicePayment } from './banks/types.js';
import { PATHS } from './config.js';
import type { Forecast } from './forecast.js';

export interface CardResult extends CardSnapshot {
  forecast: Forecast;
  /** Movements first seen in this run. */
  nuevos: number;
}

/** Shape of each bank entry in `users/{uid}/data/cards`. Read by the PWA. */
export interface BankCardsDoc {
  updatedAt: string;
  ok: boolean;
  error?: string;
  tarjetas?: CardResult[];
}

let db: Firestore | undefined;

export async function firestore(): Promise<Firestore> {
  if (db) return db;
  let key: object;
  try {
    key = JSON.parse(await readFile(PATHS.serviceAccount, 'utf8')) as object;
  } catch {
    throw new Error(`Falta la clave de Firebase en ${PATHS.serviceAccount} (ver README)`);
  }
  const app = getApps()[0] ?? initializeApp({ credential: cert(key) });
  db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

/**
 * Separate doc from `data/state` on purpose: the PWA overwrites `state` whole on
 * every save, so writing there from here would race with it.
 */
export async function writeBank(uid: string, bank: BankId, entry: BankCardsDoc): Promise<void> {
  const ref = (await firestore()).doc(`users/${uid}/data/cards`);
  const ciclos: Record<string, CardCycle> = {};
  for (const t of entry.tarjetas ?? []) {
    for (const c of toCycles(bank, t, entry.updatedAt)) ciclos[cycleKey(c)] = c;
  }
  // merge: a closed statement only adds `final` to its month's record, keeping the movements seen while open.
  await ref.set({ updatedAt: entry.updatedAt, [bank]: entry, ...(Object.keys(ciclos).length ? { ciclos } : {}) }, { merge: true });
}

/** Account balances per bank, in `saldos.<bank>` (latest read). */
export async function writeBalance(uid: string, bank: BankId, entry: { updatedAt: string; ARS: number; USD: number }): Promise<void> {
  const ref = (await firestore()).doc(`users/${uid}/data/cards`);
  await ref.set({ saldos: { [bank]: entry } }, { merge: true });
}

/**
 * Pending bills per bank, in `servicios.<bank>` of the same doc. Each run replaces the
 * list (paid bills drop off it); the app keeps what it already put into months.
 */
export async function writeServices(uid: string, bank: BankId, entry: { updatedAt: string; items: ServicePayment[] }): Promise<void> {
  const ref = (await firestore()).doc(`users/${uid}/data/cards`);
  await ref.set({ servicios: { [bank]: entry } }, { merge: true });
}

/**
 * One record per card and payment month (the month of `vencimiento`). While a
 * cycle is open each run overwrites its estimate; once the bank moves to the next
 * cycle the key changes and the old record keeps its last values, plus `final`
 * (the real amount to pay) when the bank exposes the closed statement.
 */
export interface CardCycle {
  bank: BankId;
  tarjeta: string;
  mesPago: string; // YYYY-MM
  cierre?: string;
  vencimiento: string;
  updatedAt: string;
  forecast?: Forecast;
  totalBanco?: { ARS: number; USD: number };
  pendientes?: CardResult['pendientes'];
  final?: { ARS: number; USD: number; minimo?: number };
}

export function toCycles(bank: BankId, t: CardResult, updatedAt: string): CardCycle[] {
  const out: CardCycle[] = [];
  if (t.vencimiento) {
    out.push({
      bank,
      tarjeta: t.tarjeta,
      mesPago: t.vencimiento.slice(0, 7),
      cierre: t.cierre,
      vencimiento: t.vencimiento,
      updatedAt,
      forecast: t.forecast,
      totalBanco: t.totalBanco,
      pendientes: t.pendientes,
    });
  }
  if (t.cerrado) {
    const { cierre, vencimiento, ARS, USD, minimo } = t.cerrado;
    out.push({ bank, tarjeta: t.tarjeta, mesPago: vencimiento.slice(0, 7), cierre, vencimiento, updatedAt, final: { ARS, USD, minimo } });
  }
  return out;
}

export function cycleKey(c: CardCycle): string {
  const last4 = c.tarjeta.match(/(\d{4,5})\s*$/)?.[1] ?? c.tarjeta.replace(/\W+/g, '');
  return `${c.bank}_${last4}_${c.mesPago}`;
}
