import { galicia } from './galicia.js';
import { mercadopago } from './mercadopago.js';
import { santander } from './santander.js';
import type { BankAdapter, BankId } from './types.js';

export const ADAPTERS: Record<BankId, BankAdapter> = { santander, galicia, mercadopago };

export function adapterFor(id: string | undefined): BankAdapter {
  if (id && id in ADAPTERS) return ADAPTERS[id as BankId];
  throw new Error(`Banco desconocido "${id ?? ''}". Opciones: ${Object.keys(ADAPTERS).join(', ')}`);
}
