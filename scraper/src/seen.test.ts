import { describe, expect, it } from 'vitest';
import type { CardSnapshot } from './banks/types.js';
import { markSeen, pruneSeen, type SeenStore } from './seen.js';

const card = (n: number): CardSnapshot => ({
  tarjeta: 'Visa ···0070',
  pendientes: Array.from({ length: n }, (_, i) => ({ id: `T${i}`, fecha: '2026-11-0' + (i + 1), descripcion: 'X', moneda: 'ARS' as const, monto: 100 })),
});

describe('markSeen', () => {
  it('counts only movements not seen before and keeps first-seen day', () => {
    const store: SeenStore = {};
    const day1 = card(2);
    expect(markSeen(store, 'santander', [day1], '2026-11-08')).toEqual([2]);

    const day2 = card(3);
    expect(markSeen(store, 'santander', [day2], '2026-11-09')).toEqual([1]);
    expect(day2.pendientes.map(m => m.vistoDesde)).toEqual(['2026-11-08', '2026-11-08', '2026-11-09']);
  });

  it('tells apart identical lines and installments of the same ticket', () => {
    const store: SeenStore = {};
    const dup: CardSnapshot = {
      tarjeta: 'V',
      pendientes: [
        { fecha: '2026-11-01', descripcion: 'CAFE', moneda: 'ARS', monto: 50 },
        { fecha: '2026-11-01', descripcion: 'CAFE', moneda: 'ARS', monto: 50 },
        { id: 'A', fecha: '2026-08-01', descripcion: 'TV', moneda: 'ARS', monto: 9, cuota: { actual: 3, total: 6 } },
      ],
    };
    expect(markSeen(store, 'santander', [dup], '2026-11-08')).toEqual([3]);
    const next: CardSnapshot = {
      tarjeta: 'V',
      pendientes: [{ id: 'A', fecha: '2026-08-01', descripcion: 'TV', moneda: 'ARS', monto: 9, cuota: { actual: 4, total: 6 } }],
    };
    expect(markSeen(store, 'santander', [next], '2026-12-08')).toEqual([1]);
  });
});

describe('pruneSeen', () => {
  it('drops entries older than the retention window', () => {
    const store: SeenStore = { santander: { old: '2026-01-01', recent: '2026-11-01' } };
    pruneSeen(store, '2026-11-08');
    expect(store.santander).toEqual({ recent: '2026-11-01' });
  });
});
