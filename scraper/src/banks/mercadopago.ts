import {
  back, drawPattern, ensureEmulator, launchApp, stopEmulator, swipe, tapNode, waitForUi, wakeAndRevealLock, type UiNode,
} from '../android.js';
import { readSecret } from '../keychain.js';
import type { AccountBalance, BankAdapter, CardMovement, CardSnapshot } from './types.js';

/**
 * Mercado Pago, read from its Android app in the local emulator (the web shows far
 * less). You log in once by hand in the emulator, 2FA included; runs reuse that
 * session and only navigate to read: home → credit card → "Consultar todos".
 * Never logs in, never touches payment buttons.
 */
const PKG = 'com.mercadopago.wallet';
export const DEFAULT_AVD = 'Pixel_8_Pro_API_35';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const pad = (n: number) => String(n).padStart(2, '0');

/** "465359 pesos argentinos con 69 centavos" / "180.154 pesos argentinos" / "-28900 …" → number. */
function spokenAmount(units: string, cents?: string): number {
  const n = Number(units.replace(/\./g, ''));
  const c = cents ? Number(cents) / 100 : 0;
  return Math.round((n < 0 || units.startsWith('-') ? n - c : n + c) * 100) / 100;
}

const AMOUNT = /^(-?[\d.]+) (pesos argentinos|dólares)(?: con (\d+) centavos?)?$/;
const DATE_HEADER = new RegExp(`^(\\d{1,2}) de (${MONTHS.join('|')})$`, 'i');
const CUOTA = /^Cuota (\d+) de (\d+)$/i;
const NOT_MERCHANT = /^(cargo|abono|consumo|devoluci[oó]n|pago)$/i;

/** Year of a day/month near `ref` (picks the closest of ref's year ±1). */
function nearYear(month: number, day: number, ref: Date): string {
  const candidates = [ref.getFullYear() - 1, ref.getFullYear(), ref.getFullYear() + 1].map(y => new Date(y, month - 1, day));
  const best = candidates.reduce((a, b) => (Math.abs(+b - +ref) < Math.abs(+a - +ref) ? b : a));
  return `${best.getFullYear()}-${pad(month)}-${pad(day)}`;
}

/** Home: "Saldo, 664 pesos con 33 centavos …" */
export function parseHomeBalance(nodes: UiNode[]): AccountBalance | null {
  for (const n of nodes) {
    const m = n.desc.match(/^Saldo, ([\d.]+) pesos(?: con (\d+) centavos?)?/);
    if (m) return { ARS: spokenAmount(m[1]!, m[2]), USD: 0 };
  }
  return null;
}

/** Android's pattern grid: the app lock ("Desbloqueá con PIN o patrón") or the device lock screen. */
export function patternGrid(nodes: UiNode[]): UiNode | undefined {
  return nodes.find(n => /^lockPattern(View)?$/.test(n.id));
}

export function isLoginScreen(nodes: UiNode[]): boolean {
  return nodes.some(n => /iniciar sesi[oó]n|ingres[aá] tu (e-?mail|usuario)|crear cuenta/i.test(`${n.text} ${n.desc}`));
}

/** The statement screen ("Resúmenes" → "Consultar todos") → the open cycle with its movements. */
export function parseStatement(nodes: UiNode[], today: Date): CardSnapshot {
  const dates = nodes.map(n => n.text).find(t => /Cierra el \d{1,2}\/\w{3}/.test(t)) ?? '';
  const dm = dates.match(/Cierra el (\d{1,2})\/(\w{3}).*Vence el (\d{1,2})\/(\w{3})/);
  const cierre = dm ? nearYear(SHORT.indexOf(dm[2]!.toLowerCase()) + 1, Number(dm[1]), today) : undefined;
  const vencimiento = dm ? nearYear(SHORT.indexOf(dm[4]!.toLowerCase()) + 1, Number(dm[3]), today) : undefined;

  const start = nodes.findIndex(n => n.text === 'Movimientos');
  const head = start === -1 ? nodes : nodes.slice(0, start);
  const ars = head.map(n => n.desc.match(AMOUNT)).find(m => m?.[2] === 'pesos argentinos');
  const usd = head.map(n => n.desc.match(AMOUNT)).find(m => m?.[2] === 'dólares');

  const pendientes: CardMovement[] = [];
  let fecha: string | null = null;
  let merchant = '';
  for (const n of start === -1 ? [] : nodes.slice(start + 1)) {
    const date = n.text.match(DATE_HEADER);
    if (date) {
      const month = MONTHS.indexOf(date[2]!.toLowerCase()) + 1;
      fecha = nearYear(month, Number(date[1]), cierre ? new Date(`${cierre}T12:00:00`) : today);
      merchant = '';
      continue;
    }
    const amount = n.desc.match(AMOUNT);
    if (amount && fecha) {
      // Charges come negative in the app; a consumption is positive for us (refunds negative).
      pendientes.push({
        fecha,
        descripcion: merchant || 'Movimiento',
        moneda: amount[2] === 'dólares' ? 'USD' : 'ARS',
        monto: -spokenAmount(amount[1]!, amount[3]),
      });
      continue;
    }
    const cuota = n.text.match(CUOTA);
    if (cuota && pendientes.length) {
      pendientes[pendientes.length - 1]!.cuota = { actual: Number(cuota[1]), total: Number(cuota[2]) };
      continue;
    }
    if (n.text && !NOT_MERCHANT.test(n.text.trim())) merchant = n.text.trim();
  }

  return {
    tarjeta: 'Mastercard Mercado Pago',
    cierre,
    vencimiento,
    totalBanco: { ARS: ars ? spokenAmount(ars[1]!, ars[3]) : 0, USD: usd ? spokenAmount(usd[1]!, usd[3]) : 0 },
    pendientes,
  };
}

/** If a pattern grid is on screen, draws the pattern saved in the Keychain (never shown or logged). */
async function unlockIfAsked(): Promise<void> {
  const nodes = await waitForUi(() => true, 5_000);
  const grid = patternGrid(nodes);
  if (!grid) return;
  let pattern: string;
  try {
    pattern = await readSecret('mercadopago', 'patron');
  } catch {
    throw new Error('falta el patrón de Android en el Llavero: corré "npm run setup" y cargalo en Mercado Pago');
  }
  await drawPattern(pattern, grid.bounds);
  await new Promise(r => setTimeout(r, 2_000));
  const after = await waitForUi(() => true, 5_000);
  if (patternGrid(after)) throw new Error('el patrón no desbloqueó: revisalo con "npm run setup"');
}

/** Full run against the emulator: balance from the home, the card's open cycle from its statement. */
export async function runMercadoPago(avd: string): Promise<{ cards: CardSnapshot[]; balance: AccountBalance | null }> {
  const started = await ensureEmulator(avd);
  try {
    await wakeAndRevealLock();
    await unlockIfAsked();
    await launchApp(PKG);
    const isHome = (n: UiNode[]) => n.some(x => /^Total hasta hoy/.test(x.desc));
    let home = await waitForUi(n => isHome(n) || isLoginScreen(n) || !!patternGrid(n), 90_000);
    if (patternGrid(home)) {
      // App lock: Mercado Pago asks for the device pattern on open.
      await unlockIfAsked();
      home = await waitForUi(n => isHome(n) || isLoginScreen(n), 60_000);
    }
    if (isLoginScreen(home)) {
      throw new Error('la sesión de la app venció: abrí el emulador y volvé a iniciar sesión en Mercado Pago');
    }
    const balance = parseHomeBalance(home);

    const manage = home.find(n => n.text === 'Gestionar');
    if (!manage) throw new Error('no encontré "Gestionar" de la tarjeta');
    await tapNode(manage);
    await waitForUi(n => n.length > 10 && n.some(x => /Deslizá|límite disponible/i.test(`${x.text} ${x.desc}`)), 30_000);
    await swipe(672, 2620, 672, 900);
    const detail = await waitForUi(n => n.some(x => x.text === 'Consultar todos'), 30_000);
    await tapNode(detail.find(x => x.text === 'Consultar todos')!);
    const statement = await waitForUi(n => n.some(x => x.text === 'Movimientos') && n.some(x => AMOUNT.test(x.desc)), 45_000);

    // Leave the app on its home for the next run (session stays open).
    await back(3);
    return { cards: [parseStatement(statement, new Date())], balance };
  } finally {
    if (started) await stopEmulator();
  }
}

/** Placeholder so Mercado Pago fits the bank list; runs go through `standalone` (no browser). */
export const mercadopago: BankAdapter = {
  id: 'mercadopago',
  name: 'Mercado Pago',
  startUrl: '',
  // Android's unlock pattern (Mercado Pago requires a device lock). Dots of the 3×3 grid: 1-4-7-8-9.
  credentialFields: [{ key: 'patron', label: 'Patrón de Android de 1 a 9 (ej. 1-4-7-8-9)' }],
  async login() {},
  async scrape() {
    return [];
  },
};

