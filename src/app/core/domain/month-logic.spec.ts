import { describe, expect, it } from 'vitest';
import { migrateState, isLegacyState } from './migration';
import {
  buildNewMonth, calcSummary, shiftIsoMonth, sortForDisplay, templateFromMonth, totalUsd, upcomingDue,
} from './month-logic';
import { MonthData } from '../models';

const legacy = {
  months: [{
    id: '2026-04', year: 2026, month: 4, exchangeRate: 1000, isClosed: true,
    expenseGroups: [
      { id: 'g-mama', name: 'Gastos Mamá', pocketId: 'p-uala', items: [{ id: 'i1', name: 'Seguro', amount: 100 }] },
      { id: 'g-ef', name: 'Efectivo', pocketId: 'p-ef', items: [{ id: 'i2', name: 'Cochera', amount: 200, paid: true }] },
      { id: 'g-uala', name: 'UALA', pocketId: 'p-uala', items: [{ id: 'i3', name: 'Expensas', amount: 300 }] },
      { id: 'g-bco', name: 'Gastos banco', pocketId: 'p-bco', items: [{ id: 'i4', name: 'Luz', amount: 400 }] },
    ],
    bankAccounts: [{ id: 'b1', name: 'Galicia', total: 1000, fechaVencimiento: '2026-04-11' }],
    pockets: [
      { id: 'p-ef', name: 'Efectivo', groupIds: ['g-ef'], isBanco: false, sobrante: 10, paraUsar: 20 },
      { id: 'p-bco', name: 'Banco', groupIds: ['g-bco'], isBanco: true, sobrante: 30, paraUsar: 40 },
      { id: 'p-uala', name: 'UALA + Mamá y Papá', groupIds: ['g-uala', 'g-mama'], isBanco: false, sobrante: 5, paraUsar: 6 },
    ],
  }],
  template: {
    expenseGroups: [
      { id: 'tg-ef', name: 'Efectivo', pocketId: 'tp-ef', items: [{ id: 't1', name: 'Cochera', amount: 200 }] },
      { id: 'tg-uala', name: 'UALA', pocketId: 'tp-uala', items: [{ id: 't2', name: 'Expensas', amount: 300 }] },
    ],
    bankAccounts: [{ id: 'tb1', name: 'Galicia', total: 0 }],
    pockets: [
      { id: 'tp-ef', name: 'Efectivo', groupIds: ['tg-ef'], isBanco: false, paraUsar: 20 },
      { id: 'tp-uala', name: 'UALA + Mamá y Papá', groupIds: ['tg-uala'], isBanco: false, paraUsar: 6 },
    ],
  },
};

describe('migrateState', () => {
  const s = migrateState(legacy);
  const m = s.months[0];

  it('detects legacy state', () => {
    expect(isLegacyState(legacy)).toBe(true);
    expect(isLegacyState(s)).toBe(false);
  });

  it('only the Efectivo group stays efectivo; the rest goes to banco', () => {
    const medioOf = (n: string) => m.items.find(i => i.name === n)!.medio;
    expect(medioOf('Cochera')).toBe('efectivo');
    expect(medioOf('Seguro')).toBe('banco');
    expect(medioOf('Expensas')).toBe('banco');
    expect(medioOf('Luz')).toBe('banco');
  });

  it('keeps paid flags and drops month closing', () => {
    expect(m.items.find(i => i.name === 'Cochera')!.paid).toBe(true);
    expect('isClosed' in m).toBe(false);
  });

  it('merges UALA pocket balances into banco', () => {
    expect(m.balances.banco).toEqual({ sobrante: 35, paraUsar: 46 });
    expect(m.balances.efectivo).toEqual({ sobrante: 10, paraUsar: 20 });
  });

  it('migrates the template', () => {
    expect(s.template.items.map(i => i.medio)).toEqual(['efectivo', 'banco']);
    expect(s.template.paraUsar).toEqual({ banco: 6, efectivo: 20 });
  });

  it('is idempotent', () => {
    expect(migrateState(s)).toEqual(s);
  });
});

describe('calcSummary', () => {
  const m = migrateState(legacy).months[0];

  it('adds statements to banco and computes USD per medio', () => {
    const [banco, efectivo] = calcSummary(m);
    // banco: items 100+300+400 + statements 1000 = 1800; sobrante 35 → falta 1765 + paraUsar 46
    expect(banco.totalGastos).toBe(1800);
    expect(banco.arsNecesarios).toBe(1765 + 46);
    // efectivo: 200 gastos, sobrante 10 → falta 190 + 20
    expect(efectivo.arsNecesarios).toBe(210);
    expect(totalUsd(m)).toBeCloseTo((1811 + 210) / 1000);
  });
});

describe('buildNewMonth', () => {
  const s = migrateState(legacy);
  const prev = s.months[0];
  let n = 0;
  const id = () => `new-${n++}`;

  it('copies previous month: unpaid items, statements at 0 with dates +1 month, sobrante 0', () => {
    const m = buildNewMonth({ year: 2026, month: 5, exchangeRate: 1100, source: 'previous' }, prev, s.template, id);
    expect(m.id).toBe('2026-05');
    expect(m.items).toHaveLength(4);
    expect(m.items.every(i => !i.paid)).toBe(true);
    expect(m.bankAccounts[0]).toMatchObject({ name: 'Galicia', total: 0, fechaVencimiento: '2026-05-11' });
    expect(m.balances.banco).toEqual({ sobrante: 0, paraUsar: 46 });
  });

  it('can start from the template', () => {
    const m = buildNewMonth({ year: 2026, month: 5, exchangeRate: 1100, source: 'template' }, prev, s.template, id);
    expect(m.items.map(i => i.name)).toEqual(['Cochera', 'Expensas']);
    expect(m.balances.efectivo.paraUsar).toBe(20);
  });

  it('templateFromMonth strips paid, totals and dates', () => {
    const t = templateFromMonth(prev);
    expect(t.items.some(i => 'paid' in i)).toBe(false);
    expect(t.bankAccounts[0]).toEqual({ id: 'b1', name: 'Galicia', total: 0 });
  });
});

describe('helpers', () => {
  it('shiftIsoMonth clamps to month end', () => {
    expect(shiftIsoMonth('2026-01-31')).toBe('2026-02-28');
    expect(shiftIsoMonth('2026-12-10')).toBe('2027-01-10');
  });

  it('sortForDisplay puts paid last', () => {
    expect(sortForDisplay([{ paid: true, n: 1 }, { n: 2 }, { paid: false, n: 3 }]).map(x => x.n)).toEqual([2, 3, 1]);
  });

  it('upcomingDue lists unpaid statements by due date', () => {
    const m = { bankAccounts: [
      { id: 'a', name: 'A', total: 0, fechaVencimiento: '2026-11-20' },
      { id: 'b', name: 'B', total: 0, fechaVencimiento: '2026-11-10' },
      { id: 'c', name: 'C', total: 0, fechaVencimiento: '2026-11-01', paid: true },
      { id: 'd', name: 'D', total: 0 },
    ] } as MonthData;
    expect(upcomingDue(m).map(b => b.id)).toEqual(['b', 'a']);
  });
});
