import { describe, expect, it } from 'vitest';
import { toSantanderMovement, toServicePayment } from './santander.js';

describe('santander toServicePayment', () => {
  it('maps a pending bill', () => {
    expect(toServicePayment({
      codigoEmpresa: 'EDEN', codigoClienteEmpresa: '00001234567890', nombreEmpresa: 'EDENOR SA        ',
      vencimiento: '11/11/2026', importe: '45.678,90', moneda: '$', pagoAutomatico: true,
      empresa: { nombreFantasia: 'EDENOR', rubroFantasia: 'ENERGIA ELECTRICA' },
    })).toEqual([{
      key: 'santander:EDEN:567890', empresa: 'EDENOR', rubro: 'ENERGIA ELECTRICA',
      vencimiento: '2026-11-11', importe: 45678.9, moneda: 'ARS', automatico: true,
    }]);
  });

  it('falls back to nombreEmpresa, null currency is ARS', () => {
    const [s] = toServicePayment({ nombreEmpresa: 'TEL  MOVIL ', vencimiento: '20/11/2026', importe: '9.999', moneda: null, codigoEmpresa: '123' });
    expect(s).toMatchObject({ empresa: 'TEL MOVIL', moneda: 'ARS', importe: 9999, automatico: false });
  });

  it('skips bills without due date or company', () => {
    expect(toServicePayment({ nombreEmpresa: 'X', importe: '1' })).toEqual([]);
    expect(toServicePayment({ vencimiento: '01/12/2026', importe: '1' })).toEqual([]);
  });
});

describe('santander toSantanderMovement', () => {
  it('maps a debit with title and detail (long numbers dropped)', () => {
    expect(toSantanderMovement({
      id: '123', isPending: false,
      content: {
        date: { value: '08/11/2026' },
        description: { title: 'Debito automatico', detail: 'Edenor cta 12345678901234' },
        csueldo: { currency: 'ars', value: -45678.9 },
      },
    })).toEqual([{ id: '123', fecha: '2026-11-08', descripcion: 'Debito automatico · Edenor cta', monto: -45678.9, moneda: 'ARS' }]);
  });

  it('falls back to the current-account column and skips rows without amount', () => {
    const [m] = toSantanderMovement({ content: { date: { value: '01/11/2026' }, description: { title: 'Sueldo' }, csueldo: { value: null }, ccorriente: { currency: 'ars', value: 1000 } } });
    expect(m).toMatchObject({ descripcion: 'Sueldo', monto: 1000 });
    expect(toSantanderMovement({ content: { date: { value: '01/11/2026' }, csueldo: { value: null } } })).toEqual([]);
  });
});
