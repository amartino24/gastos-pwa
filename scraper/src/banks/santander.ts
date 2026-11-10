import type { Locator, Page, Response } from 'playwright';
import { parseArAmount, parseDate } from '../parse.js';
import type { BankAdapter, CardMovement, CardSnapshot, ServicePayment } from './types.js';

/**
 * Santander "Online Banking Personas". The SPA loads card data from its own
 * JSON API (`/obp-servicios/bff/cards/...`); we drive the UI and read those
 * responses instead of parsing HTML.
 */
const BASE = 'https://www2.personas.santander.com.ar/obp-webapp/angular/#!';
const LOGIN_URL = `${BASE}/login`;
const CARDS_URL = `${BASE}/cards/`;
const TIMEOUT = 45_000;

interface ApiCard {
  id: string;
  brand: string; // VISA | AMEX | VISA_DEBITO …
  lastFourNumbers: string;
  enabled: boolean;
  isDebit: boolean;
  isAdditional: boolean;
}

interface ApiMovement {
  commercialEstablishment: string;
  ticketNumber: string;
  date: string; // YYYY-MM-DD
  currency: string; // ARS | USD
  amount: number | string;
  installment: number | string;
  totalInstallments: number | string;
  isPending: boolean;
}

interface ApiMovementsResponse {
  cards: { cardNumber: string; arsTotal: number | string; usdTotal: number | string; movements: ApiMovement[] }[];
}

/** Prefixes errors with the step that failed (Playwright messages alone don't say where). */
async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw new Error(`${name} — ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
  }
}

const logoutButton = (page: Page) =>
  page.locator('#cerrar-sesion, [aria-label="Cerrar sesión"], [aria-label="Salir"], button:has-text("Cerrar sesión")').first();

export interface ApiPendingPayment {
  codigoEmpresa?: string;
  codigoClienteEmpresa?: string;
  nombreEmpresa?: string;
  vencimiento?: string; // dd/mm/yyyy
  importe?: string;
  moneda?: string | null; // "$" | "U$S" | null
  pagoAutomatico?: boolean;
  isTarjetas?: boolean;
  empresa?: { nombreFantasia?: string; rubroFantasia?: string } | null;
}

const clean = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

export function toServicePayment(p: ApiPendingPayment): ServicePayment[] {
  const vencimiento = p.vencimiento ? parseDate(p.vencimiento) : null;
  const empresa = clean(p.empresa?.nombreFantasia) || clean(p.nombreEmpresa);
  if (!vencimiento || !empresa) return [];
  const cliente = clean(p.codigoClienteEmpresa);
  return [{
    key: `santander:${clean(p.codigoEmpresa) || empresa}:${cliente.slice(-6)}`,
    empresa,
    rubro: clean(p.empresa?.rubroFantasia) || undefined,
    vencimiento,
    importe: parseArAmount(p.importe),
    moneda: /U\$S|USD/i.test(p.moneda ?? '') ? 'USD' : 'ARS',
    automatico: !!p.pagoAutomatico,
  }];
}

const pathOf = (r: Response) => new URL(r.url()).pathname;
const isCardsList = (r: Response) => r.request().method() === 'GET' && /\/bff\/cards\/cards\/?$/.test(pathOf(r));
const movementsCardId = (r: Response) => pathOf(r).match(/\/bff\/cards\/cards\/([^/]+)\/movements$/)?.[1];

const BRAND_LABEL: Record<string, string> = { VISA: 'Visa', AMEX: 'Amex', MASTER: 'Mastercard', MASTERCARD: 'Mastercard' };

function toMovement(m: ApiMovement): CardMovement {
  const actual = Number(m.installment);
  const total = Number(m.totalInstallments);
  return {
    id: m.ticketNumber || undefined,
    fecha: m.date,
    descripcion: m.commercialEstablishment.trim(),
    moneda: m.currency === 'USD' ? 'USD' : 'ARS',
    monto: Number(m.amount),
    cuota: total > 1 && actual >= 1 ? { actual, total } : undefined,
    pendiente: m.isPending || undefined,
  };
}

async function readDate(page: Page, label: 'Cierre' | 'Vencimiento'): Promise<string | undefined> {
  try {
    const text = await page.locator(`div[aria-label^="${label}:"] p`).nth(1).textContent({ timeout: 5_000 });
    return (text && parseDate(text)) || undefined;
  } catch {
    return undefined;
  }
}

export const santander: BankAdapter = {
  id: 'santander',
  name: 'Santander',
  startUrl: LOGIN_URL,
  credentialFields: [
    { key: 'usuario', label: 'Usuario' },
    { key: 'clave', label: 'Clave' },
  ],

  async login(page, creds) {
    // Visible labels aren't bound to the inputs, so getByLabel doesn't work here.
    const password = page.locator('input#clave');
    const user = page.locator('input#datosusuario');
    // Old and new ("Select") layouts: the logout control differs, so match either.
    const loggedIn = logoutButton(page);

    await step('login: esperando formulario', () => password.or(loggedIn).first().waitFor({ timeout: TIMEOUT }));
    if (await loggedIn.isVisible()) return; // session from the persistent profile still alive

    // With "Recordar usuario" the bank greets by name and only asks for the password.
    // Type like a person: the bank's anti-fraud logs out sessions whose password was pasted instantly.
    const typeInto = async (field: Locator, value: string) => {
      await field.click();
      await page.waitForTimeout(300 + Math.random() * 400);
      await field.pressSequentially(value, { delay: 60 + Math.floor(Math.random() * 80) });
    };
    if (await user.isVisible()) await typeInto(user, creds['usuario'] ?? '');
    await typeInto(password, creds['clave'] ?? '');
    await page.waitForTimeout(500 + Math.random() * 500);

    const loginResponse = page.waitForResponse(r => pathOf(r).endsWith('/login/doLogin'), { timeout: TIMEOUT });
    loginResponse.catch(() => {}); // handled below; avoids an unhandled rejection if the click step fails first
    // Not getByRole: "¿Necesitás ayuda para ingresar?" also matches "Ingresar".
    await step('login: botón Ingresar', () => page.locator('button.button-login').click());
    const res = await step('login: respuesta del banco', () => loginResponse);
    const body = (await res.json().catch(() => ({}))) as { estadoRespuesta?: string };
    if (body.estadoRespuesta !== 'OK') {
      const shown = (await page.locator('.feedback-pantalla-error').first().textContent({ timeout: 3_000 }).catch(() => '')) ?? '';
      if (/sesi[oó]n/i.test(shown)) {
        throw new Error('el banco dice que ya hay una sesión abierta: cerrala con "Salir" o esperá 5 minutos');
      }
      throw new Error(`login rechazado por el banco (estado ${String(body.estadoRespuesta ?? '?').slice(0, 12)})`);
    }
    await step('login: esperando el home', () => page.waitForURL(/#!\/(home|cards)/, { timeout: TIMEOUT }));
  },

  /** Pending bills from "Pagos y servicios" (card statements excluded: cards are scraped apart). */
  async services(page) {
    // Like a person: back to the home (logo) and the "Pago de servicios" quick access.
    // A hash change or a full reload doesn't load this section reliably.
    const pending = page.waitForResponse(r => pathOf(r).endsWith('/pagos/obtenerPagosPendientes'), { timeout: TIMEOUT });
    pending.catch(() => {});
    await step('pagos: volver al inicio', () => page.locator('[aria-label="Volver al inicio"]').first().click({ timeout: 10_000 }));
    await page.waitForTimeout(1_500 + Math.random() * 1_000);
    await step('pagos: acceso "Pago de servicios"', () =>
      page.getByText(/^\s*Pago de servicios\s*$/i).first().click({ timeout: 20_000 }),
    );
    const res = await step('pagos: pendientes', () => pending);
    const body = (await res.json()) as { respuesta?: { pagosPendientesConVencimiento?: ApiPendingPayment[] } };
    return (body.respuesta?.pagosPendientesConVencimiento ?? []).filter(p => !p.isTarjetas).flatMap(toServicePayment);
  },

  async logout(page) {
    const salir = logoutButton(page);
    if (!(await salir.isVisible().catch(() => false))) return;
    await salir.click({ timeout: 5_000 });
    // A confirmation dialog may show up; accept it if it does.
    // "¿Estás seguro de que querés salir?" → "Si". The modal's buttons aren't always
    // role=button, so match any visible clickable element whose text is exactly "Si".
    const yes = page
      .locator('button, [role="button"], a, md-button, .md-button')
      .filter({ hasText: /^\s*s[ií]\s*$/i })
      .filter({ visible: true })
      .first();
    await yes.click({ timeout: 4_000 }).catch(() => page.getByText(/^\s*s[ií]\s*$/i).first().click({ timeout: 2_000 }).catch(() => {}));
    // Wait until the bank lands on its logout page; otherwise the server keeps the session
    // and blocks logins for ~5 minutes.
    await page.waitForURL(/logout/i, { timeout: 10_000 }).catch(() => {});
  },

  async scrape(page, opts) {
    const movements = new Map<string, ApiMovementsResponse>();
    page.on('response', async r => {
      const id = movementsCardId(r);
      if (!id || r.request().method() !== 'POST') return;
      try {
        movements.set(id, (await r.json()) as ApiMovementsResponse);
      } catch {
        /* ignore */
      }
    });

    // Open the cards section by clicking the card tile on the home, like a person would.
    // (A hash change doesn't load the cards micro-frontend; a full goto risks a blank SPA.)
    const wantedDigits = opts.tarjetas[0];
    const tiles = page.locator('md-card-content.credit-card__content');
    const tile = wantedDigits ? page.locator(`md-card-content.credit-card__content[aria-label*="${wantedDigits}"]`) : tiles;
    let cardsResponse = page.waitForResponse(isCardsList, { timeout: TIMEOUT });
    cardsResponse.catch(() => {});
    const hasTile = await tile.first().waitFor({ timeout: 20_000 }).then(() => true, () => false);
    await page.waitForTimeout(1_000 + Math.random() * 1_500);
    if (hasTile) {
      await tile.first().click();
    } else {
      await page.goto(CARDS_URL);
    }
    let listRes = await cardsResponse.catch(() => null);
    if (!listRes) {
      // The SPA sometimes stays blank until a reload (F5).
      cardsResponse = page.waitForResponse(isCardsList, { timeout: TIMEOUT });
      cardsResponse.catch(() => {});
      await page.reload();
      listRes = await step('tarjetas: lista (tras recargar)', () => cardsResponse);
    }
    const { cards } = (await listRes.json()) as { cards: ApiCard[] };

    const carousel = page.locator('#carouselId button#boton-selectable-card');
    await step('tarjetas: carrusel', () => carousel.first().waitFor({ timeout: TIMEOUT }));

    // Each titular credit card's movements include its adicionales (same statement).
    const wanted = new Set(opts.tarjetas);
    const titulares = cards
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => card.enabled && !card.isDebit && !card.isAdditional);
    const direct = titulares.filter(({ card }) => wanted.has(card.lastFourNumbers));
    // If a wanted number is an adicional we don't know its account up front: load every titular.
    const toLoad = wanted.size === 0 || direct.length === 0 ? titulares : direct;

    const result: CardSnapshot[] = [];
    for (const { card, index } of toLoad) {
      if (!movements.has(card.id)) {
        const wait = page.waitForResponse(r => movementsCardId(r) === card.id, { timeout: TIMEOUT });
        // Carousel order matches the API order; DOM click works even when the slide is off-screen.
        await carousel.nth(index).evaluate(el => (el as HTMLElement).click());
        await step(`tarjetas: consumos de la tarjeta ${index + 1}`, () => wait);
        await page.waitForTimeout(500); // let the response handler store the body
      }
      const data = movements.get(card.id);
      if (!data) throw new Error(`santander: no llegaron los consumos de la tarjeta ${index + 1}`);

      const matches =
        wanted.size === 0 || wanted.has(card.lastFourNumbers) || data.cards.some(c => wanted.has(c.cardNumber));
      if (!matches) continue;

      result.push({
        tarjeta: `${BRAND_LABEL[card.brand] ?? card.brand} ···${card.lastFourNumbers}`,
        cierre: await readDate(page, 'Cierre'),
        vencimiento: await readDate(page, 'Vencimiento'),
        totalBanco: {
          ARS: data.cards.reduce((n, c) => n + Number(c.arsTotal || 0), 0),
          USD: data.cards.reduce((n, c) => n + Number(c.usdTotal || 0), 0),
        },
        // Titular + adicionales of the same account, cuotas of the period included.
        pendientes: data.cards.flatMap(c => c.movements.map(toMovement)),
      });
    }
    if (result.length === 0) throw new Error(`santander: no se encontró la tarjeta ${opts.tarjetas.join(', ') || 'de crédito'}`);
    return result;
  },
};
