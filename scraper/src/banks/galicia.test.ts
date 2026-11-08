import { describe, expect, it } from 'vitest';
import { forecastNextStatement } from '../forecast.js';
import { toSnapshot } from './galicia.js';

const card = {
  last_digits: '1111',
  brand: 'VISA',
  account_number: 'A1',
  settlement_closing_dates: { previous: '2026-10-30', current: '2026-11-27', next: '2026-12-26' },
  settlement_due_dates: { previous: '2026-11-10', current: '2026-12-09', next: '2027-01-08' },
  settlement_total_payment: [{ currency: 'ARS', amount: '850000.5' }, { currency: 'USD', amount: '12' }],
  settlement_minimum_payment: [{ currency: 'ARS', total_amount: '90000' }],
};

const movements = {
  data: [
    {
      consumptions: [
        { last_four_digits: '1111', receipt_number: 'R1', transaction_date: '2026-11-02', merchant_name: 'SUPER ', installment_plan: 1, installment_number: 1, final_currency: 'ARS', final_amount: 1000, credit_account: 'A1' },
        { last_four_digits: '1111', receipt_number: 'R2', transaction_date: '2026-08-15', merchant_name: 'TV', installment_plan: 6, installment_number: 4, final_currency: 'ARS', final_amount: 500, credit_account: 'A1' },
        { last_four_digits: '2222', receipt_number: 'R3', transaction_date: '2026-11-03', merchant_name: 'OTRA CUENTA', installment_plan: 1, installment_number: 1, final_currency: 'ARS', final_amount: 999, credit_account: 'B2' },
      ],
      adjustments: [{ transaction_date: '2026-11-04', operation_description: 'DEVOLUCION', transaction_amount: '-200.50', transaction_currency: 'ARS', receipt_number: '9' }],
      authorizations: [{ transaction_date: '2026-11-07', merchant_name: 'NETFLIX   ', installment_plan: 1, currency: 'USD', amount: '9.99', last_four_digits: '1111' }],
      totals: { total_amount_pesos: '1500', total_amount_dollars: '0' },
    },
  ],
};

describe('galicia toSnapshot', () => {
  it('maps consumptions, adjustments and authorizations of the right account', () => {
    const s = toSnapshot(card, movements, '2026-11-08');
    expect(s.tarjeta).toBe('Visa ···1111');
    expect(s.cierre).toBe('2026-11-27');
    expect(s.vencimiento).toBe('2026-12-09');
    expect(s.totalBanco).toEqual({ ARS: 1500, USD: 0 });
    expect(s.pendientes.map(m => m.descripcion)).toEqual(['SUPER', 'TV', 'DEVOLUCION', 'NETFLIX']);
    expect(s.pendientes[1]!.cuota).toEqual({ actual: 4, total: 6 });
    expect(s.pendientes[3]).toMatchObject({ moneda: 'USD', monto: 9.99, pendiente: true });
    expect(forecastNextStatement(s)).toMatchObject({ ARS: 1299.5, USD: 9.99 });
  });

  it('reads the last closed statement with its real total', () => {
    expect(toSnapshot(card, movements, '2026-11-08').cerrado).toEqual({
      cierre: '2026-10-30', vencimiento: '2026-11-10', ARS: 850000.5, USD: 12, minimo: 90000,
    });
    // after the current closing passes, that one becomes the closed statement
    expect(toSnapshot(card, movements, '2026-11-28').cerrado).toMatchObject({ cierre: '2026-11-27', vencimiento: '2026-12-09' });
  });

  it('uses the next closing once the current one has passed', () => {
    const s = toSnapshot(card, movements, '2026-11-28');
    expect(s.cierre).toBe('2026-12-26');
    expect(s.vencimiento).toBe('2027-01-08');
  });
});
