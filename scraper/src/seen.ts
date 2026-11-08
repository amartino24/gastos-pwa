import { readFile, writeFile } from 'node:fs/promises';
import type { BankId, CardMovement, CardSnapshot } from './banks/types.js';
import { PATHS } from './config.js';

/** movement key → first day it was seen (YYYY-MM-DD). Local only, never uploaded. */
export type SeenStore = Partial<Record<BankId, Record<string, string>>>;

const KEEP_DAYS = 200;

function baseKey(tarjeta: string, m: CardMovement): string {
  return [tarjeta, m.id ?? '', m.fecha, m.moneda, m.monto.toFixed(2), m.cuota ? `${m.cuota.actual}/${m.cuota.total}` : ''].join('|');
}

/**
 * Sets `vistoDesde` on every movement and returns how many are new per card.
 * Identical lines (no bank id, same day/amount) are told apart by occurrence order.
 */
export function markSeen(store: SeenStore, bank: BankId, cards: CardSnapshot[], today: string): number[] {
  const seen = (store[bank] ??= {});
  return cards.map(card => {
    const occurrences = new Map<string, number>();
    let nuevos = 0;
    for (const m of card.pendientes) {
      const base = baseKey(card.tarjeta, m);
      const n = (occurrences.get(base) ?? 0) + 1;
      occurrences.set(base, n);
      const key = n === 1 ? base : `${base}#${n}`;
      if (!seen[key]) {
        seen[key] = today;
        nuevos++;
      }
      m.vistoDesde = seen[key];
    }
    return nuevos;
  });
}

export function pruneSeen(store: SeenStore, today: string): void {
  const cutoff = new Date(Date.parse(today) - KEEP_DAYS * 86_400_000).toISOString().slice(0, 10);
  for (const bank of Object.keys(store) as BankId[]) {
    const entries = store[bank]!;
    for (const [k, day] of Object.entries(entries)) if (day < cutoff) delete entries[k];
  }
}

export async function loadSeen(): Promise<SeenStore> {
  try {
    return JSON.parse(await readFile(PATHS.seen, 'utf8')) as SeenStore;
  } catch {
    return {};
  }
}

export async function saveSeen(store: SeenStore): Promise<void> {
  await writeFile(PATHS.seen, JSON.stringify(store), { mode: 0o600 });
}
