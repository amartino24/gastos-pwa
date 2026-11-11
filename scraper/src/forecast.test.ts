import { describe, expect, it } from 'vitest';
import { fillRunningBalance, forecastNextStatement } from './forecast.js';

describe('forecastNextStatement', () => {
  it('sums movements per currency, refunds included', () => {
    const f = forecastNextStatement({
      tarjeta: 'Visa',
      pendientes: [
        { fecha: '2026-10-25', descripcion: 'SUPER', moneda: 'ARS', monto: 1000.1 },
        { fecha: '2026-11-02', descripcion: 'NETFLIX', moneda: 'USD', monto: 9.99 },
        { fecha: '2026-11-03', descripcion: 'DEVOLUCION', moneda: 'ARS', monto: -200 },
        { fecha: '2026-08-10', descripcion: 'TV', moneda: 'ARS', monto: 500, cuota: { actual: 4, total: 6 } },
      ],
    });
    expect(f).toEqual({ ARS: 1300.1, USD: 9.99, movimientos: 4 });
  });
});

describe('fillRunningBalance', () => {
  it('rebuilds the balance after each movement from today\'s balance', () => {
    const out = fillRunningBalance([
      { fecha: '2026-11-10', descripcion: 'b', monto: -100, moneda: 'ARS' },
      { fecha: '2026-11-08', descripcion: 'a', monto: 1000, moneda: 'ARS' },
      { fecha: '2026-11-11', descripcion: 'p', monto: -5, moneda: 'ARS', pendiente: true },
    ], 900);
    expect(out.map(m => m.saldo)).toEqual([900, 1000, undefined]);
  });

  it('keeps what the bank sent', () => {
    const list = [{ fecha: '2026-11-10', descripcion: 'b', monto: -100, moneda: 'ARS' as const, saldo: 7 }];
    expect(fillRunningBalance(list, 900)).toBe(list);
  });
});
