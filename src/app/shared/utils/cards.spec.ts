import { describe, expect, it } from 'vitest';
import { ScrapedCard } from '../../core/models';
import {
  formatMovementAmount, installmentEnd, isNewMovement, paymentMonth, refreshStatus, showNewBadge, updatedAgo, watcherOnline,
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
    expect(showNewBadge(card(0))).toBe(false);
    expect(showNewBadge(card(3))).toBe(false); // first run: everything is "new"
    const c = card(1);
    expect(showNewBadge(c)).toBe(true);
    expect(isNewMovement(c.pendientes[0], c, '2026-11-08T15:00:00Z')).toBe(true);
    expect(isNewMovement(c.pendientes[1], c, '2026-11-08T15:00:00Z')).toBe(false);
  });

  it('refreshStatus follows the request lifecycle', () => {
    expect(refreshStatus(undefined)).toBe('idle');
    expect(refreshStatus({ requestedAt: 'a' })).toBe('pending');
    expect(refreshStatus({ requestedAt: 'a', handledRequest: 'a', state: 'running' })).toBe('running');
    expect(refreshStatus({ requestedAt: 'a', handledRequest: 'a', state: 'idle' })).toBe('idle');
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
});
