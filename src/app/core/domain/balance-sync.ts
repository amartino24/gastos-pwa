import { AppState, MonthData, ScrapedBalance, ScraperBank, SobranteAuto } from '../models';
import { same } from './card-sync';
import { monthId } from './month-logic';

/** "2026-11-10" → "2026-12" */
export function nextMonthId(today: string): string {
  const [y, m] = today.split('-').map(Number);
  return m === 12 ? monthId(y + 1, 1) : monthId(y, m + 1);
}

/**
 * Today's bank balances are what's left for next month: they go to the Banco
 * "sobrante" of the following month, only if that month exists. Pesos only (the
 * sobrante is in ARS); the USD balance is kept as detail. A hand-edited sobrante wins.
 */
export function applyBalances(
  state: AppState, saldos: Partial<Record<ScraperBank, ScrapedBalance>>, today: string,
): AppState | null {
  const entries = (Object.entries(saldos) as [ScraperBank, ScrapedBalance | undefined][])
    .filter((e): e is [ScraperBank, ScrapedBalance] => !!e[1]);
  if (entries.length === 0) return null;

  const id = nextMonthId(today);
  const month = state.months.find(m => m.id === id);
  if (!month) return null;

  const total = Math.round(entries.reduce((n, [, s]) => n + s.ARS, 0));
  const banco = month.balances.banco;
  const ours = !banco.sobranteAuto || banco.sobrante === 0 || banco.sobrante === banco.sobranteAuto.applied;
  const sobranteAuto: SobranteAuto = {
    updatedAt: entries.map(([, s]) => s.updatedAt).sort().at(-1)!,
    bancos: Object.fromEntries(entries.map(([bank, s]) => [bank, { ARS: s.ARS, USD: s.USD }])),
    applied: ours ? total : banco.sobranteAuto!.applied,
  };
  const nextBanco = { ...banco, sobrante: ours ? total : banco.sobrante, sobranteAuto };
  if (same(banco, nextBanco)) return null;

  const updated: MonthData = { ...month, balances: { ...month.balances, banco: nextBanco } };
  return { ...state, months: state.months.map(m => (m.id === id ? updated : m)) };
}
