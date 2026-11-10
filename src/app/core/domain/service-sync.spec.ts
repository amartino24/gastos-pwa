import { describe, expect, it } from 'vitest';
import { applyServices } from './service-sync';
import { buildNewMonth } from './month-logic';
import { AppState, MonthData, ServicePayment } from '../models';

let n = 0;
const id = () => `id${++n}`;

const nov: MonthData = {
  id: '2026-11', year: 2026, month: 11, exchangeRate: 1500,
  items: [
    { id: 'luz', name: 'Edenor', amount: 30000, medio: 'banco' },
    { id: 'agua', name: 'Agua', amount: 20000, medio: 'banco' },
  ],
  bankAccounts: [],
  balances: { banco: { sobrante: 0, paraUsar: 0 }, efectivo: { sobrante: 0, paraUsar: 0 } },
};
const state: AppState = { version: 2, months: [nov], template: { items: [], bankAccounts: [], paraUsar: { banco: 0, efectivo: 0 } } };

const edenor: ServicePayment = {
  key: 'santander:EDEN:567890', empresa: 'EDENOR', vencimiento: '2026-11-20', importe: 45678.9, moneda: 'ARS', automatico: true,
};
const item = (s: AppState, month: string, itemId: string) => s.months.find(m => m.id === month)!.items.find(i => i.id === itemId)!;

describe('applyServices', () => {
  it('updates the expense named like the company and links it', () => {
    const out = applyServices(state, [edenor], 't1', id, '2026-11-10')!;
    expect(item(out, '2026-11', 'luz')).toMatchObject({ amount: 45679, serviceKey: edenor.key, auto: { empresa: 'EDENOR', automatico: true } });
    expect(item(out, '2026-11', 'luz').paid).toBeUndefined();
  });

  it('is idempotent', () => {
    const once = applyServices(state, [edenor], 't1', id, '2026-11-10')!;
    expect(applyServices(once, [edenor], 't1', id, '2026-11-10')).toBeNull();
  });

  it('adds a new Banco expense when nothing matches, and respects a renamed linked one', () => {
    const telco: ServicePayment = { ...edenor, key: 'santander:123:1', empresa: 'TELCO SA', importe: 9999 };
    const once = applyServices(state, [telco], 't1', id, '2026-11-10')!;
    const added = once.months[0].items.find(i => i.serviceKey === telco.key)!;
    expect(added).toMatchObject({ name: 'TELCO SA', amount: 9999, medio: 'banco' });
    const renamed = { ...once, months: [{ ...once.months[0], items: once.months[0].items.map(i => i.id === added.id ? { ...i, name: 'Celular' } : i) }] };
    const twice = applyServices(renamed, [{ ...telco, importe: 12000 }], 't2', id, '2026-11-10')!;
    expect(twice.months[0].items.filter(i => i.serviceKey === telco.key)).toMatchObject([{ name: 'Celular', amount: 12000 }]);
  });

  it('does not overwrite a hand-edited amount', () => {
    const once = applyServices(state, [edenor], 't1', id, '2026-11-10')!;
    const edited = { ...once, months: [{ ...once.months[0], items: once.months[0].items.map(i => i.id === 'luz' ? { ...i, amount: 1 } : i) }] };
    const out = applyServices(edited, [{ ...edenor, importe: 50000 }], 't2', id, '2026-11-10')!;
    expect(item(out, '2026-11', 'luz')).toMatchObject({ amount: 1, auto: { importe: 50000 } });
  });

  it('marks an auto-debit paid once its due date passed, only once', () => {
    const out = applyServices(state, [edenor], 't1', id, '2026-11-20')!;
    expect(item(out, '2026-11', 'luz')).toMatchObject({ paid: true, auto: { paidMarked: true } });
    const unchecked = { ...out, months: [{ ...out.months[0], items: out.months[0].items.map(i => i.id === 'luz' ? { ...i, paid: false } : i) }] };
    expect(applyServices(unchecked, [edenor], 't1', id, '2026-11-21')).toBeNull();
  });

  it('goes to the month of the due date, creating it, and the link survives into the next month', () => {
    const dec: ServicePayment = { ...edenor, vencimiento: '2026-12-20', importe: 50000 };
    const once = applyServices(state, [edenor], 't1', id, '2026-11-10')!;
    const out = applyServices(once, [dec], 't2', id, '2026-11-10')!;
    const decMonth = out.months.find(m => m.id === '2026-12')!;
    expect(decMonth.items.filter(i => i.serviceKey === edenor.key)).toMatchObject([{ name: 'Edenor', amount: 50000 }]);
    // a month built from November keeps the link
    expect(buildNewMonth({ year: 2027, month: 1, exchangeRate: 1, source: 'previous' }, once.months[0], state.template, id)
      .items.find(i => i.name === 'Edenor')?.serviceKey).toBe(edenor.key);
  });
});
