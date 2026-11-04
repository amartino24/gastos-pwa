import { Injectable } from '@angular/core';

const BLUE_URL = 'https://dolarapi.com/v1/dolares/blue';

/** Dólar blue quote from dolarapi.com. The app uses the midpoint between compra and venta. */
@Injectable({ providedIn: 'root' })
export class DolarService {
  async blueMid(): Promise<number> {
    const res = await fetch(BLUE_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`dolarapi ${res.status}`);
    const { compra, venta } = (await res.json()) as { compra: number; venta: number };
    if (!(compra > 0) || !(venta > 0)) throw new Error('dolarapi: cotización inválida');
    return Math.round((compra + venta) / 2);
  }
}
