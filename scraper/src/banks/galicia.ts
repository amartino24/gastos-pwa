import type { BrowserContext, Locator, Page, Response } from 'playwright';
import { parseArAmount, parseDate } from '../parse.js';
import type {
  AccountBalance, AccountMovement, BankAdapter, CardMovement, CardSnapshot, ClosedStatement, Moneda, ServicePayment,
} from './types.js';

/**
 * Galicia Online Banking. Login on onlinebanking.*, card data on tarjetas.*,
 * whose React app loads everything from JSON BFFs:
 *   bff/overview/cards        → cards, totals, closing/due dates
 *   bff/cards/movements-tc    → consumptions, adjustments, pending authorizations
 * We drive the UI and read those responses.
 */
const LOGIN_URL = 'https://onlinebanking.bancogalicia.com.ar/login';
const ACCOUNTS_URL = 'https://onlinebanking.bancogalicia.com.ar/navigation/menulink/2';
const PAGOS_MENU_URL = 'https://onlinebanking.bancogalicia.com.ar/navigation/menulink/409';
const PAGOS_HOST = 'pagosyrecargas.bancogalicia.com.ar';
const CARDS_MENU_URL = 'https://onlinebanking.bancogalicia.com.ar/navigation/menulink/390';
const MOVEMENTS_URL = 'https://tarjetas.bancogalicia.com.ar/tarjetas/ini/movimientos';
const TIMEOUT = 45_000;

interface OverviewCard {
  last_digits: string;
  brand: string;
  account_number: string;
  settlement_closing_dates?: { previous?: string | null; current?: string | null; next?: string | null };
  settlement_due_dates?: { previous?: string | null; current?: string | null; next?: string | null };
  /** Amount to pay of the last closed statement. */
  settlement_total_payment?: { currency: string; amount: number | string }[];
  settlement_minimum_payment?: { currency: string; total_amount: number | string }[];
}
interface OverviewResponse {
  data: { credit_cards?: OverviewCard[] }[];
}

interface Consumption {
  last_four_digits: string;
  receipt_number: string;
  transaction_date: string;
  merchant_name: string;
  installment_plan: number | string;
  installment_number: number | string;
  final_currency: string;
  final_amount: number | string;
  credit_account?: string;
}
interface Adjustment {
  transaction_date: string;
  operation_description: string;
  transaction_amount: number | string;
  transaction_currency: string;
  receipt_number?: string;
}
interface Authorization {
  transaction_date: string;
  merchant_name: string;
  installment_plan: number | string;
  /** The operation itself (what the statement will charge). */
  transaction_currency: string;
  transaction_amount: number | string;
  /** Just its USD equivalent — not what gets billed. */
  currency?: string;
  amount?: number | string;
  last_four_digits: string;
}
interface MovementsResponse {
  data: {
    consumptions?: Consumption[];
    adjustments?: Adjustment[];
    authorizations?: Authorization[];
    totals?: { total_amount_pesos?: string | number; total_amount_dollars?: string | number };
  }[];
}

async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw new Error(`${name} — ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
  }
}

const pathOf = (r: Response) => new URL(r.url()).pathname;
const moneda = (c: string): Moneda => (c === 'USD' ? 'USD' : 'ARS');
const num = (v: unknown) => Number(v ?? 0) || 0;
const BRAND_LABEL: Record<string, string> = { VISA: 'Visa', AMEX: 'Amex', MASTER: 'Mastercard', MASTERCARD: 'Mastercard' };

function cuota(plan: unknown, n: unknown) {
  const total = num(plan);
  const actual = num(n);
  return total > 1 && actual >= 1 ? { actual, total } : undefined;
}

/** Upcoming closing: `current` if it hasn't passed yet, else `next` (with the matching due date). */
function upcoming(card: OverviewCard, today: string): { cierre?: string; vencimiento?: string } {
  const c = card.settlement_closing_dates ?? {};
  const d = card.settlement_due_dates ?? {};
  if (c.current && c.current >= today) return { cierre: c.current, vencimiento: d.current ?? undefined };
  return { cierre: c.next ?? c.current ?? undefined, vencimiento: (c.next ? d.next : d.current) ?? undefined };
}

/**
 * Last closed statement: the most recent closing date already past (`current`
 * until it passes, else `previous`), paired with its due date and the bank's total.
 */
export function closedStatement(card: OverviewCard, today: string): ClosedStatement | undefined {
  const c = card.settlement_closing_dates ?? {};
  const d = card.settlement_due_dates ?? {};
  const pair = c.current && c.current < today ? [c.current, d.current] : [c.previous, d.previous];
  const [cierre, vencimiento] = pair;
  const totals = card.settlement_total_payment ?? [];
  if (!cierre || !vencimiento || totals.length === 0) return undefined;
  const amount = (cur: string) => num(totals.find(t => t.currency === cur)?.amount);
  const minimo = card.settlement_minimum_payment?.find(m => m.currency === 'ARS')?.total_amount;
  return { cierre, vencimiento, ARS: amount('ARS'), USD: amount('USD'), minimo: minimo === undefined ? undefined : num(minimo) };
}

/** ["Saldo en Pesos 12.345,67", "Saldo en Dolares 1,00"] → { ARS, USD } (summed per currency). */
export function parseGaliciaBalances(texts: string[]): AccountBalance {
  const out: AccountBalance = { ARS: 0, USD: 0 };
  for (const t of texts) {
    const amount = parseArAmount(t.replace(/^[^\d-]*/, ''));
    if (/d[oó]lar/i.test(t)) out.USD += amount;
    else if (/peso/i.test(t)) out.ARS += amount;
  }
  return { ARS: Math.round(out.ARS * 100) / 100, USD: Math.round(out.USD * 100) / 100 };
}

interface DebtsResponse {
  Debts?: {
    CompanyName?: string;
    AliasServicio?: string | null;
    DigitalPaymentID?: string;
    BillDueDate?: string; // dd/mm/yyyy
    Amount?: number | string;
    CurrencyShortDescription?: string;
    TienePagoAutomatico?: boolean;
    PagoAutomaticoGalicia?: boolean;
    Empresa?: { Code?: string; Description?: string };
  }[];
}

/** One pending debt → ServicePayment. The alias ("Monotributo") names it, like the user does. */
export function toGaliciaService(d: NonNullable<DebtsResponse['Debts']>[number]): ServicePayment[] {
  const vencimiento = d.BillDueDate ? parseDate(d.BillDueDate) : null;
  const empresa = clean(d.AliasServicio) || clean(d.CompanyName) || clean(d.Empresa?.Description);
  if (!vencimiento || !empresa) return [];
  return [{
    key: `galicia:${clean(d.Empresa?.Code) || empresa}:${clean(d.DigitalPaymentID).slice(-6)}`,
    empresa,
    rubro: clean(d.CompanyName) || undefined,
    vencimiento,
    importe: parseArAmount(d.Amount),
    moneda: /U\$S|USD/i.test(d.CurrencyShortDescription ?? '') ? 'USD' : 'ARS',
    automatico: !!(d.TienePagoAutomatico || d.PagoAutomaticoGalicia),
  }];
}

interface MovementsAccountResponse {
  Model?: {
    Movimientos?: {
      ID?: string;
      Fecha?: string; // dd/mm/yyyy
      DescripcionAMostrar?: string;
      ImporteCredito?: string;
      ImporteDebito?: string;
      SaldoParcial?: number | string;
      EsMovimientoPendiente?: boolean;
    }[];
  };
}

/** Debit "-1.234,56" / credit "1.234,56" → signed amount (debits negative). */
export function toAccountMovement(m: NonNullable<NonNullable<MovementsAccountResponse['Model']>['Movimientos']>[number]): AccountMovement[] {
  const fecha = m.Fecha ? parseDate(m.Fecha) : null;
  if (!fecha) return [];
  const debit = Math.abs(parseArAmount(m.ImporteDebito));
  const credit = Math.abs(parseArAmount(m.ImporteCredito));
  return [{
    id: m.ID || undefined,
    fecha,
    descripcion: clean(m.DescripcionAMostrar),
    monto: Math.round((credit - debit) * 100) / 100,
    moneda: 'ARS',
    pendiente: m.EsMovimientoPendiente || undefined,
    saldo: m.SaldoParcial != null && m.SaldoParcial !== '' ? parseArAmount(m.SaldoParcial) : undefined,
  }];
}

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Resolves with the JSON of the first response matching `match`, from any page of the context. */
function waitStoredResponse<T>(ctx: BrowserContext, match: (r: Response) => boolean): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ctx.off('response', onResponse);
      reject(new Error('no llegó la respuesta'));
    }, TIMEOUT);
    const onResponse = async (r: Response) => {
      if (!match(r)) return;
      try {
        const json = (await r.json()) as T;
        clearTimeout(timer);
        ctx.off('response', onResponse);
        resolve(json);
      } catch {
        /* keep waiting */
      }
    };
    ctx.on('response', onResponse);
  });
}

export function toSnapshot(card: OverviewCard, mov: MovementsResponse, today: string): CardSnapshot {
  const block = mov.data[0] ?? {};
  const mine = (x: { credit_account?: string }) => !x.credit_account || x.credit_account === card.account_number;

  const pendientes: CardMovement[] = [
    ...(block.consumptions ?? []).filter(mine).map(c => ({
      id: c.receipt_number || undefined,
      fecha: c.transaction_date,
      descripcion: c.merchant_name.trim(),
      moneda: moneda(c.final_currency),
      monto: num(c.final_amount),
      cuota: cuota(c.installment_plan, c.installment_number),
    })),
    // Credits/refunds/bonifications already applied to this period (usually negative).
    ...(block.adjustments ?? []).map(a => ({
      id: a.receipt_number ? `adj-${a.receipt_number}` : undefined,
      fecha: a.transaction_date,
      descripcion: a.operation_description.trim(),
      moneda: moneda(a.transaction_currency),
      monto: num(a.transaction_amount),
    })),
    // Authorized, not settled yet: will land in this statement.
    ...(block.authorizations ?? []).map(a => ({
      fecha: a.transaction_date,
      descripcion: a.merchant_name.trim(),
      moneda: moneda(a.transaction_currency),
      monto: num(a.transaction_amount),
      cuota: cuota(a.installment_plan, 1),
      pendiente: true,
    })),
  ];

  return {
    tarjeta: `${BRAND_LABEL[card.brand] ?? card.brand} ···${card.last_digits}`,
    ...upcoming(card, today),
    totalBanco: { ARS: num(block.totals?.total_amount_pesos), USD: num(block.totals?.total_amount_dollars) },
    pendientes,
    cerrado: closedStatement(card, today),
  };
}

const TARJETAS_HOST = 'tarjetas.bancogalicia.com.ar';

/** Resolves with the first open page on `host` (existing or opened later). */
async function waitForPage(ctx: BrowserContext, host: string): Promise<Page> {
  const deadline = Date.now() + TIMEOUT;
  while (Date.now() < deadline) {
    const found = ctx.pages().find(p => !p.isClosed() && p.url().includes(host));
    if (found) return found;
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`no se abrió ${host}`);
}

/** Waits until the context-level listener has stored `key`. */
async function waitStored<T>(store: Map<string, unknown>, key: string): Promise<T> {
  const deadline = Date.now() + TIMEOUT;
  while (Date.now() < deadline) {
    if (store.has(key)) return store.get(key) as T;
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`no llegó ${key}`);
}

export const galicia: BankAdapter = {
  id: 'galicia',
  name: 'Galicia',
  startUrl: LOGIN_URL,
  credentialFields: [
    { key: 'dni', label: 'DNI' },
    { key: 'usuario', label: 'Usuario' },
    { key: 'clave', label: 'Clave' },
  ],

  // Login form: #DocumentNumber, #UserName, #Password, #submitButton.
  async login(page, creds) {
    const dni = page.locator('input#DocumentNumber');
    await step('login: esperando formulario', () => dni.waitFor({ timeout: TIMEOUT }));
    // The form validates on key events: fill() leaves "Iniciar sesión" disabled, so type key by key.
    // "Recordar DNI y Usuario" may prefill/hide fields; type only into visible ones.
    const typeInto = async (field: Locator, value: string) => {
      await field.click();
      await field.clear();
      await field.pressSequentially(value, { delay: 40 + Math.floor(Math.random() * 40) });
    };
    if (await dni.isVisible()) await typeInto(dni, creds['dni'] ?? '');
    const user = page.locator('input#UserName');
    if (await user.isVisible()) await typeInto(user, creds['usuario'] ?? '');
    await typeInto(page.locator('input#Password'), creds['clave'] ?? '');
    await page.keyboard.press('Tab'); // some validators also run on blur

    const submit = page.locator('button#submitButton');
    await step('login: botón iniciar sesión habilitado', () =>
      page.waitForFunction(() => {
        const b = document.querySelector<HTMLButtonElement>('button#submitButton');
        return !!b && !b.disabled && !b.classList.contains('disabled');
      }, undefined, { timeout: 10_000 }),
    );
    await step('login: botón iniciar sesión', () => submit.click());
    await step('login: esperando el home', () =>
      page.waitForURL(url => !url.pathname.toLowerCase().startsWith('/login'), { timeout: TIMEOUT }),
    );
  },

  async scrape(page, opts) {
    // Galicia opens the cards site in another window and may close the current
    // one, so listen on the whole browser context and follow the live page.
    const ctx = page.context();
    const store = new Map<string, unknown>();
    ctx.on('response', async r => {
      const p = pathOf(r);
      const key = p.endsWith('/bff/overview/cards') ? 'overview' : p.endsWith('/bff/cards/movements-tc') ? 'movements' : null;
      if (!key) return;
      try {
        store.set(key, await r.json());
      } catch {
        /* ignore */
      }
    });
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });

    await page.goto(CARDS_MENU_URL).catch(() => {}); // the page may get closed mid-navigation
    const cardsPage = await step('tarjetas: abriendo el sitio de tarjetas', () => waitForPage(ctx, TARJETAS_HOST));
    const overview = await step('tarjetas: resumen de tarjetas', () => waitStored<OverviewResponse>(store, 'overview'));

    const credit = overview.data.flatMap(d => d.credit_cards ?? []);
    const wanted = new Set(opts.tarjetas);
    const cards = wanted.size ? credit.filter(c => wanted.has(c.last_digits)) : credit;
    if (cards.length === 0) throw new Error(`galicia: no se encontró la tarjeta ${opts.tarjetas.join(', ') || 'de crédito'}`);

    store.delete('movements');
    await cardsPage.goto(MOVEMENTS_URL);
    const movements = await step('tarjetas: movimientos', () => waitStored<MovementsResponse>(store, 'movements'));

    // The movements page shows one card account; make sure it's the one we want.
    const accounts = new Set((movements.data[0]?.consumptions ?? []).map(c => c.credit_account).filter(Boolean));
    const result = cards
      .filter(c => accounts.size === 0 || accounts.has(c.account_number))
      .map(c => toSnapshot(c, movements, today));
    if (result.length === 0) {
      throw new Error('galicia: la pantalla de movimientos abrió otra tarjeta (falta implementar elegirla)');
    }
    return result;
  },

  /** Pending bills from "Pagos de servicios" (pagosyrecargas.*), reached through the banking menu. */
  async services(page) {
    const ctx = page.context();
    const debts = waitStoredResponse<DebtsResponse>(ctx, r => pathOf(r).endsWith('/Pagos/GetPublishedDebtsDataOrdered'));
    // pagosyrecargas.* only accepts sessions handed over by the banking menu
    // ("Pagos de servicios", menulink 409); a direct goto lands on "Sesión expirada".
    await page.goto(PAGOS_MENU_URL).catch(() => {});
    await step('pagos: abriendo pagos y recargas', () => waitForPage(ctx, PAGOS_HOST));
    const body = await step('pagos: deudas', () => debts);
    return (body.Debts ?? []).flatMap(toGaliciaService);
  },

  async balances(page) {
    await page.goto(ACCOUNTS_URL);
    const live = await step('cuentas: página de cuentas', () => waitForPage(page.context(), 'cuentas.bancogalicia.com.ar'));
    const labels = live.locator('[id="SaldoAccesibilidad"]');
    await step('cuentas: saldos', () => labels.first().waitFor({ state: 'attached', timeout: TIMEOUT }));
    return parseGaliciaBalances(await labels.allTextContents());
  },

  /** Opens the pesos account on "Mis cuentas" (left there by `balances`) and reads its movements. */
  async movements(page) {
    const ctx = page.context();
    const live = ctx.pages().filter(p => !p.isClosed()).at(-1) ?? page;
    const response = waitStoredResponse<MovementsAccountResponse>(ctx, r => pathOf(r).endsWith('/Cuentas/GetMovimientosCuenta'));
    await step('cuentas: abrir cuenta en pesos', () =>
      live.locator('[role="button"][aria-label*="Pesos"]').first().click({ timeout: 20_000 }),
    );
    const body = await step('cuentas: movimientos', () => response);
    return (body.Model?.Movimientos ?? []).flatMap(toAccountMovement);
  },

  async logout(page: Page) {
    // On "Mis cuentas" the link sits in a collapsed menu (present but hidden): click it via the DOM.
    const out = page.locator('#LogOut_a').first();
    if ((await out.count().catch(() => 0)) === 0) return;
    await out.evaluate(el => (el as HTMLElement).click());
    await page.getByRole('button', { name: /^(s[ií]|aceptar|cerrar sesi[oó]n|salir)$/i }).first().click({ timeout: 3_000 }).catch(() => {});
    await page.waitForTimeout(1_500);
  },
};
