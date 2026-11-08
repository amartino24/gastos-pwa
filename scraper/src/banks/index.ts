import { galicia } from './galicia.js';
import { santander } from './santander.js';
import type { BankAdapter, BankId } from './types.js';

export const ADAPTERS: Record<BankId, BankAdapter> = { santander, galicia };

export function adapterFor(id: string | undefined): BankAdapter {
  if (id === 'santander' || id === 'galicia') return ADAPTERS[id];
  throw new Error(`Banco desconocido "${id ?? ''}". Opciones: ${Object.keys(ADAPTERS).join(', ')}`);
}
