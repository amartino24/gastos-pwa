import { describe, expect, it } from 'vitest';
import { applyBalances, nextMonthId } from './balance-sync';
import { AppState, MonthData } from '../models';

const month = (id: string, sobrante = 0): MonthData => {
  const [year, m] = id.split('-').map(Number);
  return {
    id, year, month: m, exchangeRate: 1500, items: [], bankAccounts: [],
    balances: { banco: { sobrante, paraUsar: 0 }, efectivo: { sobrante: 7, paraUsar: 0 } },
  };
};
const state = (...months: MonthData[]): AppState => ({
  version: 2, months, template: { items: [], bankAccounts: [], paraUsar: { banco: 0, efectivo: 0 } },
});
const saldos = {
  santander: { updatedAt: '2026-11-10T10:00:00Z', ARS: 1000.4, USD: 50 },
  galicia: { updatedAt: '2026-11-10T11:00:00Z', ARS: 500, USD: 1 },
};

describe('applyBalances', () => {
  it('nextMonthId wraps the year', () => {
    expect(nextMonthId('2026-11-10')).toBe('2026-12');
    expect(nextMonthId('2026-12-31')).toBe('2027-01');
  });

  it('puts the pesos balance of all banks in next month\'s Banco sobrante', () => {
    const out = applyBalances(state(month('2026-11'), month('2026-12')), saldos, '2026-11-10')!;
    const dec = out.months.find(m => m.id === '2026-12')!;
    expect(dec.balances.banco).toMatchObject({ sobrante: 1500, sobranteAuto: { applied: 1500, updatedAt: '2026-11-10T11:00:00Z' } });
    expect(dec.balances.banco.sobranteAuto!.bancos.santander).toEqual({ ARS: 1000.4, USD: 50 });
    expect(dec.balances.efectivo.sobrante).toBe(7);
    expect(out.months.find(m => m.id === '2026-11')!.balances.banco.sobrante).toBe(0);
  });

  it('does nothing when next month does not exist, and is idempotent', () => {
    expect(applyBalances(state(month('2026-11')), saldos, '2026-11-10')).toBeNull();
    const once = applyBalances(state(month('2026-12')), saldos, '2026-11-10')!;
    expect(applyBalances(once, saldos, '2026-11-10')).toBeNull();
  });

  it('a hand-edited sobrante wins over later balances', () => {
    const once = applyBalances(state(month('2026-12')), saldos, '2026-11-10')!;
    const edited = state({ ...once.months[0], balances: { ...once.months[0].balances, banco: { ...once.months[0].balances.banco, sobrante: 42 } } });
    const out = applyBalances(edited, { santander: { ...saldos.santander, ARS: 9999 } }, '2026-11-10')!;
    expect(out.months[0].balances.banco.sobrante).toBe(42);
    expect(out.months[0].balances.banco.sobranteAuto!.bancos.santander!.ARS).toBe(9999);
  });
});
