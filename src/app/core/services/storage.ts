import { Injectable } from '@angular/core';
import { AppState, Template } from '../models';

const STORAGE_KEY = 'gastos-app-state';

const DEFAULT_STATE: AppState = {
  months: [
    {
      id: '2026-04',
      year: 2026,
      month: 4,
      exchangeRate: 1420,
      isClosed: false,
      expenseGroups: [
        {
          id: 'apr-grp-gastos-mama',
          name: 'Gastos Mamá',
          pocketId: 'apr-pocket-uala-mama',
          items: [
            { id: 'apr-i1', name: 'Seguro auto', amount: 100000 },
            { id: 'apr-i2', name: 'Ajuste dif', amount: 87000 },
            { id: 'apr-i3', name: 'Personal', amount: 50000 },
          ],
        },
        {
          id: 'apr-grp-efectivo',
          name: 'Efectivo',
          pocketId: 'apr-pocket-efectivo',
          items: [
            { id: 'apr-i4', name: 'Cochera', amount: 120000 },
            { id: 'apr-i5', name: 'Devolucion Juani', amount: 1000000 },
          ],
        },
        {
          id: 'apr-grp-uala',
          name: 'UALA',
          pocketId: 'apr-pocket-uala-mama',
          items: [
            { id: 'apr-i6', name: 'Expensas', amount: 115000 },
            { id: 'apr-i7', name: 'Funcional', amount: 50000 },
            { id: 'apr-i8', name: 'Limpieza', amount: 100000 },
            { id: 'apr-i9', name: 'Cami Devolucion', amount: 300000 },
            { id: 'apr-i10', name: 'Masajista', amount: 120000 },
          ],
        },
        {
          id: 'apr-grp-otros',
          name: 'Otros',
          pocketId: 'apr-pocket-banco',
          items: [
            { id: 'apr-i11', name: 'Monotributo', amount: 70000 },
            { id: 'apr-i12', name: 'Mantenimiento Santa', amount: 0 },
            { id: 'apr-i13', name: 'Agua', amount: 20000 },
            { id: 'apr-i14', name: 'Gas', amount: 18000 },
            { id: 'apr-i15', name: 'Luz', amount: 90000 },
            { id: 'apr-i16', name: 'Gastos Ricardone', amount: 500000 },
            { id: 'apr-i17', name: 'Mutual', amount: 15000 },
          ],
        },
      ],
      bankAccounts: [
        { id: 'apr-bank-galicia', name: 'Galicia', total: 980571 },
        { id: 'apr-bank-santander', name: 'Santander', total: 2173000 },
        { id: 'apr-bank-mpago', name: 'Mercado Pago', total: 0 },
        { id: 'apr-bank-macro', name: 'Macro', total: 0 },
      ],
      pockets: [
        {
          id: 'apr-pocket-efectivo',
          name: 'Efectivo',
          groupIds: ['apr-grp-efectivo'],
          isBanco: false,
          sobrante: 0,
          paraUsar: 100000,
        },
        {
          id: 'apr-pocket-banco',
          name: 'Banco',
          groupIds: ['apr-grp-otros'],
          isBanco: true,
          sobrante: 1240000,
          paraUsar: 200000,
        },
        {
          id: 'apr-pocket-uala-mama',
          name: 'UALA + Mamá y Papá',
          groupIds: ['apr-grp-uala', 'apr-grp-gastos-mama'],
          isBanco: false,
          sobrante: 20000,
          paraUsar: 94000,
        },
      ],
    },
  ],
  template: {
    expenseGroups: [
      {
        id: 'grp-gastos-mama',
        name: 'Gastos Mamá',
        pocketId: 'pocket-uala-mama',
        items: [
          { id: 'i1', name: 'Seguro auto', amount: 100000 },
          { id: 'i2', name: 'Ajuste dif', amount: 87000 },
          { id: 'i3', name: 'Personal', amount: 50000 },
        ],
      },
      {
        id: 'grp-efectivo',
        name: 'Efectivo',
        pocketId: 'pocket-efectivo',
        items: [
          { id: 'i4', name: 'Cochera', amount: 120000 },
        ],
      },
      {
        id: 'grp-uala',
        name: 'UALA',
        pocketId: 'pocket-uala-mama',
        items: [
          { id: 'i5', name: 'Expensas', amount: 115000 },
          { id: 'i6', name: 'Funcional', amount: 50000 },
          { id: 'i7', name: 'Limpieza', amount: 100000 },
          { id: 'i8', name: 'Masajista', amount: 120000 },
        ],
      },
      {
        id: 'grp-otros',
        name: 'Otros',
        pocketId: 'pocket-banco',
        items: [
          { id: 'i9', name: 'Monotributo', amount: 70000 },
          { id: 'i10', name: 'Mantenimiento Santa', amount: 0 },
          { id: 'i11', name: 'Agua', amount: 20000 },
          { id: 'i12', name: 'Gas', amount: 18000 },
          { id: 'i13', name: 'Luz', amount: 90000 },
          { id: 'i14', name: 'Gastos Ricardone', amount: 500000 },
          { id: 'i15', name: 'Mutual', amount: 15000 },
        ],
      },
    ],
    bankAccounts: [
      { id: 'bank-galicia', name: 'Galicia', total: 0 },
      { id: 'bank-santander', name: 'Santander', total: 0 },
      { id: 'bank-mpago', name: 'Mercado Pago', total: 0 },
      { id: 'bank-macro', name: 'Macro', total: 0 },
    ],
    pockets: [
      { id: 'pocket-efectivo', name: 'Efectivo', groupIds: ['grp-efectivo'], isBanco: false },
      { id: 'pocket-banco', name: 'Banco', groupIds: ['grp-otros'], isBanco: true },
      { id: 'pocket-uala-mama', name: 'UALA + Mamá y Papá', groupIds: ['grp-uala', 'grp-gastos-mama'], isBanco: false },
    ],
  },
};

@Injectable({ providedIn: 'root' })
export class StorageService {
  load(): AppState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_STATE);
      const stored = JSON.parse(raw) as AppState;
      // If stored state has no months, seed with default months
      if (!stored.months || stored.months.length === 0) {
        return { ...stored, months: structuredClone(DEFAULT_STATE.months) };
      }
      return stored;
    } catch {
      return structuredClone(DEFAULT_STATE);
    }
  }

  save(state: AppState): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  getDefaultTemplate(): Template {
    return structuredClone(DEFAULT_STATE.template);
  }
}
