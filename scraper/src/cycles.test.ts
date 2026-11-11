import { describe, expect, it } from 'vitest';
import { cycleKey, movementHistory, toCycles, type CardResult } from './firestore.js';

const card: CardResult = {
  tarjeta: 'Visa ···4871',
  cierre: '2026-11-26',
  vencimiento: '2026-12-04',
  pendientes: [],
  forecast: { ARS: 10, USD: 1, movimientos: 0 },
  nuevos: 0,
};

describe('toCycles', () => {
  it('keys the open cycle by bank, last digits and payment month', () => {
    const [c] = toCycles('galicia', card, '2026-11-08T20:00:00Z');
    expect(c!.mesPago).toBe('2026-12');
    expect(cycleKey(c!)).toBe('galicia_4871_2026-12');
    expect(c!.final).toBeUndefined();
  });

  it('adds the closed statement as `final` of its own payment month', () => {
    const cycles = toCycles(
      'galicia',
      { ...card, cerrado: { cierre: '2026-10-29', vencimiento: '2026-11-11', ARS: 900, USD: 5, minimo: 90 } },
      'now',
    );
    expect(cycles.map(cycleKey)).toEqual(['galicia_4871_2026-12', 'galicia_4871_2026-11']);
    expect(cycles[1]).toMatchObject({ final: { ARS: 900, USD: 5, minimo: 90 } });
    expect(cycles[1]!.pendientes).toBeUndefined(); // merge keeps the movements already stored
  });

  it('skips the open cycle without a due date', () => {
    expect(toCycles('galicia', { ...card, vencimiento: undefined }, 'x')).toEqual([]);
  });
});

describe('movementHistory', () => {
  it('groups settled movements by month with stable keys, skipping pending', () => {
    const h = movementHistory([
      { id: '9/1', fecha: '2026-11-08', descripcion: 'Pago tarjeta', monto: -100, moneda: 'ARS' },
      { fecha: '2026-10-31', descripcion: 'Sueldo. Oct', monto: 5000, moneda: 'ARS' },
      { fecha: '2026-11-09', descripcion: 'x', monto: -1, moneda: 'ARS', pendiente: true },
    ]);
    expect(Object.keys(h).sort()).toEqual(['2026-10', '2026-11']);
    expect(Object.keys(h['2026-11']!)).toEqual(['id_9_1']);
    expect(Object.keys(h['2026-10']!)).toEqual(['2026-10-31_5000_00_Sueldo_Oct']);
  });
});
