import { AppState } from '../models';

export const STORAGE_KEY = 'gastos-app-state';

/** Starting point for a brand-new user: no months, a basic template. */
export const DEFAULT_STATE: AppState = {
  version: 2,
  months: [],
  template: {
    items: [
      { id: 't-cochera', name: 'Cochera', amount: 120000, medio: 'efectivo' },
      { id: 't-seguro', name: 'Seguro auto', amount: 100000, medio: 'banco' },
      { id: 't-expensas', name: 'Expensas', amount: 115000, medio: 'banco' },
      { id: 't-monotributo', name: 'Monotributo', amount: 70000, medio: 'banco' },
      { id: 't-luz', name: 'Luz', amount: 90000, medio: 'banco' },
      { id: 't-gas', name: 'Gas', amount: 18000, medio: 'banco' },
      { id: 't-agua', name: 'Agua', amount: 20000, medio: 'banco' },
    ],
    bankAccounts: [
      { id: 't-galicia', name: 'Galicia', total: 0 },
      { id: 't-santander', name: 'Santander', total: 0 },
      { id: 't-mpago', name: 'Mercado Pago', total: 0 },
    ],
    paraUsar: { banco: 200000, efectivo: 100000 },
  },
};
