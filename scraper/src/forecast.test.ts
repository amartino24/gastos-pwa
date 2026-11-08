import { describe, expect, it } from 'vitest';
import { forecastNextStatement } from './forecast.js';

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
