import {
  CardCycle, MONTH_NAMES, MedioBalance, RefreshStatus, SCRAPER_BANK_LABELS, ScrapeRequest, ScrapedBank, ScrapedCard, ScrapedMovement, ScraperBank,
} from '../../core/models';

const SHORT_MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** YYYY-MM-DD of an ISO timestamp in Buenos Aires time (same day key the scraper uses). */
export function arDay(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
}

/** "hace 5 min" · "hace 3 h" · "hace 2 d" */
export function updatedAgo(iso: string, now: Date): string {
  const min = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60_000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

/** Older than ~1.5 days: the daily run probably didn't happen. */
export function isStale(iso: string, now: Date): boolean {
  return now.getTime() - Date.parse(iso) > 36 * 3_600_000;
}

/** Newest first. */
export function byDateDesc(list: readonly ScrapedMovement[]): ScrapedMovement[] {
  return [...list].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** What a card tile shows, for the open cycle (home) or a stored one (its month). */
export interface CardView {
  bank: ScraperBank;
  tarjeta: string;
  updatedAt: string;
  cierre?: string;
  vencimiento?: string;
  ars: number;
  usd: number;
  /** The bank closed it: amounts are the real total. */
  final: boolean;
  minimo?: number;
  movimientos: ScrapedMovement[];
  /** Movements first seen in the last run (0 when unknown). */
  nuevos: number;
  /** Still the open cycle: can be refreshed. */
  current: boolean;
}

export function viewFromScraped(bank: ScraperBank, data: ScrapedBank, card: ScrapedCard): CardView {
  return {
    bank, tarjeta: card.tarjeta, updatedAt: data.updatedAt, cierre: card.cierre, vencimiento: card.vencimiento,
    ars: card.forecast.ARS, usd: card.forecast.USD, final: false,
    movimientos: card.pendientes, nuevos: card.nuevos, current: true,
  };
}

export function viewFromCycle(cycle: CardCycle, current: boolean, nuevos = 0): CardView {
  const amounts = cycle.final ?? cycle.forecast ?? { ARS: 0, USD: 0 };
  return {
    bank: cycle.bank, tarjeta: cycle.tarjeta, updatedAt: cycle.updatedAt, cierre: cycle.cierre, vencimiento: cycle.vencimiento,
    ars: amounts.ARS, usd: amounts.USD, final: !!cycle.final, minimo: cycle.final?.minimo,
    movimientos: cycle.pendientes ?? [], nuevos, current,
  };
}

/**
 * New in the last run. The very first run marks everything as new, which is
 * noise, so nothing is highlighted when every movement is "new".
 */
export function showNewBadge(view: CardView): boolean {
  return view.nuevos > 0 && view.nuevos < view.movimientos.length;
}

export function isNewMovement(m: ScrapedMovement, view: CardView): boolean {
  return showNewBadge(view) && m.vistoDesde === arDay(view.updatedAt);
}

/** Payment month of a card = month of its due date: route id + display name. */
export function paymentMonth(vencimiento: string | undefined): { id: string; name: string } | null {
  if (!vencimiento) return null;
  const [y, m] = vencimiento.split('-').map(Number);
  if (!y || !m) return null;
  return { id: `${y}-${String(m).padStart(2, '0')}`, name: MONTH_NAMES[m - 1] };
}

/**
 * Last payment month of an installment plan, given the month this cuota is paid in.
 * "2026-12" + cuota 7/18 → 11 more months → "nov 2027".
 */
export function installmentEnd(mesPago: string | undefined, cuota: { actual: number; total: number } | undefined): string {
  if (!mesPago || !cuota) return '';
  const [y, m] = mesPago.split('-').map(Number);
  if (!y || !m) return '';
  const idx = y * 12 + (m - 1) + (cuota.total - cuota.actual);
  return `${SHORT_MONTHS[idx % 12]} ${Math.floor(idx / 12)}`;
}

/** "-$1.478,29" / "US$ 16,54" — sign before the currency symbol. */
export function formatMovementAmount(m: ScrapedMovement): string {
  const abs = Math.abs(m.monto).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${m.monto < 0 ? '-' : ''}${m.moneda === 'USD' ? 'US$ ' : '$'}${abs}`;
}

/** Not yet taken → 'pending'; taken but held by the min gap → 'waiting'; working → 'running'. */
export function refreshStatus(req: ScrapeRequest | undefined): RefreshStatus {
  if (!req) return 'idle';
  if (req.requestedAt && req.handledRequest !== req.requestedAt) return 'pending';
  return req.state === 'running' || req.state === 'waiting' ? req.state : 'idle';
}

/** "Espera 2 min…" / "Espera 40 s…" while the watcher holds a run. */
export function waitingLabel(waitingUntil: string | undefined, now: Date): string {
  const s = waitingUntil ? Math.max(0, Math.ceil((Date.parse(waitingUntil) - now.getTime()) / 1000)) : 0;
  return s >= 60 ? `Espera ${Math.ceil(s / 60)} min…` : `Espera ${s} s…`;
}

/** The watcher writes a heartbeat every 5 min; 15 min without one means the Mac is off or asleep. */
export function watcherOnline(heartbeatAt: string | undefined, now: Date): boolean {
  return !!heartbeatAt && now.getTime() - Date.parse(heartbeatAt) < 15 * 60_000;
}

export const REFRESH_LABELS: Record<RefreshStatus, string> = {
  idle: 'Actualizar',
  pending: 'En cola…',
  waiting: 'En espera…',
  running: 'Actualizando…',
};

export type RefreshOutcome =
  | { kind: 'ok'; nuevos: number }
  | { kind: 'error'; error: string }
  | { kind: 'no-data' };

/**
 * Result of a finished refresh: the scraper writes the bank entry before the watcher
 * marks the request done, so an entry written after `startedAt` is this run's result.
 */
export function refreshOutcome(req: ScrapeRequest, bank: ScrapedBank | undefined): RefreshOutcome {
  if (!bank || !req.startedAt || bank.updatedAt < req.startedAt) return { kind: 'no-data' };
  if (!bank.ok) return { kind: 'error', error: bank.error ?? 'error desconocido' };
  return { kind: 'ok', nuevos: (bank.tarjetas ?? []).reduce((n, t) => n + t.nuevos, 0) };
}

/** "Saldo en cuentas hace 2 h: Santander $1.000 · Galicia $500 (+ US$ 51)" */
export function sobranteHint(banco: MedioBalance, now: Date): string | null {
  const auto = banco.sobranteAuto;
  if (!auto) return null;
  const banks = Object.entries(auto.bancos) as [ScraperBank, { ARS: number; USD: number }][];
  const ars = banks.map(([b, v]) => `${SCRAPER_BANK_LABELS[b]} $${Math.round(v.ARS).toLocaleString('es-AR')}`).join(' · ');
  const usd = banks.reduce((n, [, v]) => n + v.USD, 0);
  const usdText = usd ? ` (+ US$ ${usd.toLocaleString('es-AR', { maximumFractionDigits: 2 })})` : '';
  const edited = banco.sobrante !== auto.applied ? ' · editado a mano' : '';
  return `Saldo en cuentas ${updatedAgo(auto.updatedAt, now)}: ${ars}${usdText}${edited}`;
}
