import type { AccountMovement, CardSnapshot, Moneda } from './banks/types.js';

export interface Forecast {
  ARS: number;
  USD: number;
  movimientos: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Next statement ≈ sum of the open cycle's movements, ARS and USD apart.
 * Both banks already list the period's installments, refunds and pending
 * authorizations, so no projection is needed. The app converts USD.
 */
export function forecastNextStatement(card: CardSnapshot): Forecast {
  const totals: Record<Moneda, number> = { ARS: 0, USD: 0 };
  for (const m of card.pendientes) totals[m.moneda] += m.monto;
  return { ARS: round2(totals.ARS), USD: round2(totals.USD), movimientos: card.pendientes.length };
}

/**
 * When the bank doesn't send the balance after each movement, rebuild it backwards
 * from today's balance: the newest settled movement ends at `current`, and each older
 * one ends where the next one started. Same-day order is the bank's list order.
 */
export function fillRunningBalance(movements: AccountMovement[], current: number): AccountMovement[] {
  if (movements.every(m => m.saldo !== undefined)) return movements;
  const settled = movements
    .map((m, i) => ({ m, i }))
    .filter(x => !x.m.pendiente)
    .sort((a, b) => b.m.fecha.localeCompare(a.m.fecha) || a.i - b.i);
  const saldos = new Map<number, number>();
  let after = current;
  for (const { m, i } of settled) {
    saldos.set(i, Math.round(after * 100) / 100);
    after -= m.monto;
  }
  return movements.map((m, i) => (m.saldo === undefined && saldos.has(i) ? { ...m, saldo: saldos.get(i) } : m));
}
