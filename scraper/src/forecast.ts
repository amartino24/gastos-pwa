import type { CardSnapshot, Moneda } from './banks/types.js';

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
