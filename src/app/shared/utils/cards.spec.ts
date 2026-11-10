import { describe, expect, it } from 'vitest';
import { ScrapedCard } from '../../core/models';
import {
  formatMovementAmount, installmentEnd, isNewMovement, paymentMonth, refreshOutcome, refreshStatus, showNewBadge, updatedAgo,
  viewFromCycle, viewFromScraped, waitingLabel, watcherOnline,
} from './cards';

const card = (nuevos: number, n = 3): ScrapedCard => ({
  tarjeta: 'Visa ···1',
  pendientes: Array.from({ length: n }, (_, i) => ({
    fecha: '2026-11-0' + (i + 1), descripcion: 'X', moneda: 'ARS' as const, monto: 1,
    vistoDesde: i === 0 ? '2026-11-08' : '2026-11-01',
  })),
  forecast: { ARS: 3, USD: 0, movimientos: n },
  nuevos,
});

describe('card utils', () => {
  it('installmentEnd gives the last payment month', () => {
    expect(installmentEnd('2026-12', { actual: 7, total: 18 })).toBe('nov 2027');
    expect(installmentEnd('2026-12', { actual: 6, total: 6 })).toBe('dic 2026');
    expect(installmentEnd('2026-11', { actual: 2, total: 6 })).toBe('mar 2027');
    expect(installmentEnd(undefined, { actual: 1, total: 2 })).toBe('');
  });

  it('paymentMonth is the due date month', () => {
    expect(paymentMonth('2026-12-04')).toEqual({ id: '2026-12', name: 'Diciembre' });
    expect(paymentMonth(undefined)).toBeNull();
  });

  it('formatMovementAmount puts the sign before the symbol', () => {
    expect(formatMovementAmount({ fecha: '', descripcion: '', moneda: 'ARS', monto: -1478.29 })).toBe('-$1.478,29');
    expect(formatMovementAmount({ fecha: '', descripcion: '', moneda: 'USD', monto: 16.5 })).toBe('US$ 16,50');
  });

  it('highlights new movements only when some (not all) are new', () => {
    const view = (nuevos: number) => viewFromScraped('galicia', { updatedAt: '2026-11-08T15:00:00Z', ok: true }, card(nuevos));
    expect(showNewBadge(view(0))).toBe(false);
    expect(showNewBadge(view(3))).toBe(false); // first run: everything is "new"
    const v = view(1);
    expect(showNewBadge(v)).toBe(true);
    expect(isNewMovement(v.movimientos[0], v)).toBe(true);
    expect(isNewMovement(v.movimientos[1], v)).toBe(false);
  });

  it('viewFromCycle uses the real total once closed, else the estimate', () => {
    const base = { bank: 'santander' as const, tarjeta: 'Visa ···0070', mesPago: '2026-12', vencimiento: '2026-12-18', updatedAt: 'x' };
    expect(viewFromCycle({ ...base, forecast: { ARS: 100, USD: 2 }, pendientes: [] }, true))
      .toMatchObject({ ars: 100, usd: 2, final: false, current: true, movimientos: [] });
    expect(viewFromCycle({ ...base, forecast: { ARS: 100, USD: 2 }, final: { ARS: 150, USD: 0, minimo: 15 } }, false))
      .toMatchObject({ ars: 150, usd: 0, final: true, minimo: 15, current: false });
  });

  it('refreshStatus follows the request lifecycle', () => {
    expect(refreshStatus(undefined)).toBe('idle');
    expect(refreshStatus({ requestedAt: 'a' })).toBe('pending');
    expect(refreshStatus({ requestedAt: 'a', handledRequest: 'a', state: 'running' })).toBe('running');
    expect(refreshStatus({ requestedAt: 'a', handledRequest: 'a', state: 'idle' })).toBe('idle');
    expect(refreshStatus({ requestedAt: 'a', handledRequest: 'a', state: 'waiting' })).toBe('waiting');
  });

  it('waitingLabel counts down', () => {
    const now = new Date('2026-11-08T12:00:00Z');
    expect(waitingLabel('2026-11-08T12:01:23Z', now)).toBe('Espera 2 min…');
    expect(waitingLabel('2026-11-08T12:00:40Z', now)).toBe('Espera 40 s…');
  });

  it('watcherOnline needs a heartbeat in the last 15 min', () => {
    const now = new Date('2026-11-08T12:00:00Z');
    expect(watcherOnline('2026-11-08T11:50:00Z', now)).toBe(true);
    expect(watcherOnline('2026-11-08T11:40:00Z', now)).toBe(false);
    expect(watcherOnline(undefined, now)).toBe(false);
  });

  it('updatedAgo is short and readable', () => {
    const now = new Date('2026-11-08T12:00:00Z');
    expect(updatedAgo('2026-11-08T11:55:00Z', now)).toBe('hace 5 min');
    expect(updatedAgo('2026-11-08T09:00:00Z', now)).toBe('hace 3 h');
    expect(updatedAgo('2026-11-05T12:00:00Z', now)).toBe('hace 3 d');
  });

  it('refreshOutcome reads the run result from the bank entry', () => {
    const req = { requestedAt: 'r', handledRequest: 'r', state: 'idle' as const, startedAt: '2026-11-08T12:00:00Z' };
    expect(refreshOutcome(req, { updatedAt: '2026-11-08T12:01:00Z', ok: true, tarjetas: [card(2)] })).toEqual({ kind: 'ok', nuevos: 2 });
    expect(refreshOutcome(req, { updatedAt: '2026-11-08T12:01:00Z', ok: false, error: 'login' })).toEqual({ kind: 'error', error: 'login' });
    expect(refreshOutcome(req, { updatedAt: '2026-11-08T11:00:00Z', ok: true })).toEqual({ kind: 'no-data' });
    expect(refreshOutcome(req, undefined)).toEqual({ kind: 'no-data' });
  });
});
