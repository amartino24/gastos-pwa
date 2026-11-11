import { describe, expect, it } from 'vitest';
import { Debit, applyReconciliation } from './reconcile';
import { AppState, MonthData } from '../models';

const nov: MonthData = {
  id: '2026-11', year: 2026, month: 11, exchangeRate: 1500,
  items: [
    { id: 'mono', name: 'Monotributo', amount: 84612.93, medio: 'banco' },
    { id: 'luz', name: 'Luz', amount: 90000, medio: 'banco' },
    { id: 'coch', name: 'Cochera', amount: 120000, medio: 'efectivo' },
  ],
  bankAccounts: [
    { id: 'gal', name: 'Galicia', total: 1518923, fechaCierre: '2026-10-29', fechaVencimiento: '2026-11-11' },
    { id: 'san', name: 'Santander', total: 280000, fechaCierre: '2026-11-05', fechaVencimiento: '2026-11-13' },
  ],
  balances: { banco: { sobrante: 0, paraUsar: 0 }, efectivo: { sobrante: 0, paraUsar: 0 } },
};
const state: AppState = { version: 2, months: [nov], template: { items: [], bankAccounts: [], paraUsar: { banco: 0, efectivo: 0 } } };
const debit = (fecha: string, descripcion: string, monto: number, extra: Partial<Debit> = {}): Debit =>
  ({ bank: 'galicia', fecha, descripcion, monto, moneda: 'ARS', ...extra });

describe('applyReconciliation', () => {
  it('marks a card statement paid by its card-payment debit', () => {
    const out = applyReconciliation(state, [debit('2026-11-08', 'Pago tarjeta visa', -1518923.09)])!;
    const gal = out.months[0].bankAccounts.find(a => a.id === 'gal')!;
    expect(gal).toMatchObject({ paid: true, paidBy: { fecha: '2026-11-08', monto: 1518923.09, bank: 'galicia' } });
    expect(out.months[0].bankAccounts.find(a => a.id === 'san')!.paid).toBeUndefined();
  });

  it('marks a Banco expense by exact amount, or by name with a small difference', () => {
    const out = applyReconciliation(state, [
      debit('2026-11-10', 'Debito AFIP VEP', -84612.93),
      debit('2026-11-12', 'Edenor luz debito', -92000),
    ])!;
    expect(out.months[0].items.find(i => i.id === 'mono')).toMatchObject({ paid: true });
    expect(out.months[0].items.find(i => i.id === 'luz')).toMatchObject({ paid: true });
  });

  it('ignores credits, pending, other months, Efectivo and far amounts', () => {
    expect(applyReconciliation(state, [
      debit('2026-11-10', 'Ingreso', 84612.93),
      debit('2026-11-10', 'Pendiente', -84612.93, { pendiente: true }),
      debit('2026-10-10', 'Octubre', -84612.93),
      debit('2026-11-10', 'Pago cochera', -120000),
      debit('2026-11-10', 'Luz', -150000),
    ])).toBeNull();
  });

  it('a debit pays only one thing, and a hand-unchecked item is not re-marked', () => {
    const once = applyReconciliation(state, [debit('2026-11-10', 'x', -84612.93)])!;
    const unchecked = { ...once, months: [{ ...once.months[0], items: once.months[0].items.map(i => (i.id === 'mono' ? { ...i, paid: false } : i)) }] };
    expect(applyReconciliation(unchecked, [debit('2026-11-10', 'x', -84612.93)])).toBeNull();
  });

  it('a statement payment outside closing..due+5 does not count', () => {
    expect(applyReconciliation(state, [debit('2026-10-01', 'Pago tarjeta visa', -1518923)])).toBeNull();
  });
});
