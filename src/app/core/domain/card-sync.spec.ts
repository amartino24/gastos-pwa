import { describe, expect, it } from 'vitest';
import { applyCardCycles } from './card-sync';
import { AppState, CardCycle, MonthData } from '../models';

let n = 0;
const id = () => `id${++n}`;

const nov: MonthData = {
  id: '2026-11', year: 2026, month: 11, exchangeRate: 1500,
  items: [{ id: 'i1', name: 'Luz', amount: 100, medio: 'banco' }],
  bankAccounts: [
    { id: 'b1', name: 'Galicia', total: 50, fechaVencimiento: '2026-11-04' },
    { id: 'b2', name: 'Santander', total: 0 },
  ],
  balances: { banco: { sobrante: 0, paraUsar: 10 }, efectivo: { sobrante: 0, paraUsar: 5 } },
};

const state: AppState = {
  version: 2,
  months: [nov],
  template: { items: [], bankAccounts: [], paraUsar: { banco: 0, efectivo: 0 } },
};

const galiciaDec: CardCycle = {
  bank: 'galicia', tarjeta: 'Visa ···4871', mesPago: '2026-12', cierre: '2026-11-26', vencimiento: '2026-12-04',
  updatedAt: '2026-11-08T20:00:00Z', forecast: { ARS: 1000, USD: 2 },
  pendientes: [{ fecha: '2026-11-05', descripcion: 'X', moneda: 'ARS', monto: 1000 }],
};

describe('applyCardCycles', () => {
  it('creates the payment month from the newest one and fills the bank account', () => {
    const out = applyCardCycles(state, [galiciaDec], id)!;
    const dec = out.months.find(m => m.id === '2026-12')!;
    expect(dec.items.map(i => i.name)).toEqual(['Luz']);
    expect(dec.exchangeRate).toBe(1500);
    const g = dec.bankAccounts.find(a => a.name === 'Galicia')!;
    expect(g.total).toBe(1000 + 2 * 1500);
    expect(g.fechaCierre).toBe('2026-11-26');
    expect(g.fechaVencimiento).toBe('2026-12-04');
    expect(g.auto?.movimientos).toHaveLength(1);
    // November untouched
    expect(out.months.find(m => m.id === '2026-11')).toEqual(nov);
  });

  it('is idempotent', () => {
    const once = applyCardCycles(state, [galiciaDec], id)!;
    expect(applyCardCycles(once, [galiciaDec], id)).toBeNull();
  });

  it('keeps updating while the cycle is open', () => {
    const once = applyCardCycles(state, [galiciaDec], id)!;
    const twice = applyCardCycles(once, [{ ...galiciaDec, forecast: { ARS: 2000, USD: 0 }, updatedAt: 'later' }], id)!;
    expect(twice.months.find(m => m.id === '2026-12')!.bankAccounts.find(a => a.name === 'Galicia')!.total).toBe(2000);
  });

  it('does not overwrite a hand-edited total or an uploaded statement', () => {
    const once = applyCardCycles(state, [galiciaDec], id)!;
    const edited = {
      ...once,
      months: once.months.map(m => m.id !== '2026-12' ? m : {
        ...m, bankAccounts: m.bankAccounts.map(a => a.name === 'Galicia' ? { ...a, total: 777 } : a),
      }),
    };
    const out = applyCardCycles(edited, [{ ...galiciaDec, forecast: { ARS: 5000, USD: 0 }, updatedAt: 'later' }], id)!;
    const g = out.months.find(m => m.id === '2026-12')!.bankAccounts.find(a => a.name === 'Galicia')!;
    expect(g.total).toBe(777);
    expect(g.auto?.ars).toBe(5000);
  });

  it('adds the bank account when the month does not have it', () => {
    const noSantander = { ...state, months: [{ ...nov, bankAccounts: [] }] };
    const out = applyCardCycles(noSantander, [{ ...galiciaDec, bank: 'santander', mesPago: '2026-11', vencimiento: '2026-11-18' }], id)!;
    expect(out.months[0].bankAccounts.map(a => a.name)).toEqual(['Santander']);
  });

  it('a closed statement replaces the estimate with the real total, keeping the movements', () => {
    const once = applyCardCycles(state, [galiciaDec], id)!;
    const closed: CardCycle = {
      bank: 'galicia', tarjeta: 'Visa ···4871', mesPago: '2026-12', cierre: '2026-11-26', vencimiento: '2026-12-04',
      updatedAt: 'later', final: { ARS: 1200, USD: 3, minimo: 100 },
    };
    const out = applyCardCycles(once, [{ ...galiciaDec, ...closed }], id)!;
    const g = out.months.find(m => m.id === '2026-12')!.bankAccounts.find(a => a.name === 'Galicia')!;
    expect(g.total).toBe(1200 + 3 * 1500);
    expect(g.auto).toMatchObject({ final: true, minimo: 100, ars: 1200, usd: 3 });
    expect(g.auto?.movimientos).toHaveLength(1);
  });

  it('the real closed total replaces a total typed by hand before it', () => {
    const typed = { ...state, months: [{ ...nov, bankAccounts: [{ id: 'b1', name: 'Galicia', total: 1520000 }] }] };
    const closedNov: CardCycle = {
      bank: 'galicia', tarjeta: 'Visa ···4871', mesPago: '2026-11', cierre: '2026-10-29', vencimiento: '2026-11-11',
      updatedAt: 't', final: { ARS: 1518923.09, USD: 0, minimo: 151000 },
    };
    const out = applyCardCycles(typed, [closedNov], id)!;
    const g = out.months[0].bankAccounts.find(a => a.name === 'Galicia')!;
    expect(g.total).toBe(1518923);
    // once the real total is in, a later hand edit is respected
    const edited = { ...out, months: [{ ...out.months[0], bankAccounts: [{ ...g, total: 1 }] }] };
    const again = applyCardCycles(edited, [{ ...closedNov, updatedAt: 't2' }], id)!;
    expect(again.months[0].bankAccounts[0].total).toBe(1);
  });

  it('fixes an account already marked closed whose typed total was kept (no total of ours yet)', () => {
    const stuck = { ...state, months: [{ ...nov, bankAccounts: [{
      id: 'b1', name: 'Galicia', total: 1520000,
      auto: { bank: 'galicia' as const, tarjeta: 'Visa ···4871', updatedAt: 't', ars: 1518923.09, usd: 0, final: true, movimientos: [] },
    }] }] };
    const closedNov: CardCycle = {
      bank: 'galicia', tarjeta: 'Visa ···4871', mesPago: '2026-11', vencimiento: '2026-11-11', updatedAt: 't', final: { ARS: 1518923.09, USD: 0 },
    };
    expect(applyCardCycles(stuck, [closedNov], id)!.months[0].bankAccounts[0].total).toBe(1518923);
  });

  it('an uploaded statement always wins', () => {
    const withPdf = { ...state, months: [{ ...nov, bankAccounts: [{ id: 'b1', name: 'Galicia', total: 777, statement: { filename: 'r.pdf', extractedAmount: 777, uploadedAt: 'x' } }] }] };
    const out = applyCardCycles(withPdf, [{ ...galiciaDec, mesPago: '2026-11', final: { ARS: 5, USD: 0 } }], id)!;
    expect(out.months[0].bankAccounts[0].total).toBe(777);
  });

  it('does not back-fill months older than the newest one', () => {
    const old: CardCycle = { ...galiciaDec, mesPago: '2026-09', vencimiento: '2026-09-04', final: { ARS: 1, USD: 0 } };
    expect(applyCardCycles(state, [old], id)).toBeNull();
  });

  it('a new cycle goes to its own month and leaves the previous one as it was', () => {
    const dec = applyCardCycles(state, [galiciaDec], id)!;
    const jan: CardCycle = { ...galiciaDec, mesPago: '2027-01', cierre: '2026-12-24', vencimiento: '2027-01-05', forecast: { ARS: 300, USD: 0 } };
    const out = applyCardCycles(dec, [galiciaDec, jan], id)!;
    expect(out.months.map(m => m.id).sort()).toEqual(['2026-11', '2026-12', '2027-01']);
    expect(out.months.find(m => m.id === '2026-12')).toEqual(dec.months.find(m => m.id === '2026-12'));
    expect(out.months.find(m => m.id === '2027-01')!.bankAccounts.find(a => a.name === 'Galicia')!.total).toBe(300);
  });
});
