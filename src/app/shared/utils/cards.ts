import { MONTH_NAMES, RefreshStatus, ScrapeRequest, ScrapedBank, ScrapedCard, ScrapedMovement } from '../../core/models';

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

/**
 * New in the last run. The very first run marks everything as new, which is
 * noise, so nothing is highlighted when every movement is "new".
 */
export function showNewBadge(card: ScrapedCard): boolean {
  return card.nuevos > 0 && card.nuevos < card.pendientes.length;
}

export function isNewMovement(m: ScrapedMovement, card: ScrapedCard, updatedAt: string): boolean {
  return showNewBadge(card) && m.vistoDesde === arDay(updatedAt);
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

/** Requested but not yet taken by the watcher → 'pending'; taken and working → 'running'. */
export function refreshStatus(req: ScrapeRequest | undefined): RefreshStatus {
  if (!req) return 'idle';
  if (req.requestedAt && req.handledRequest !== req.requestedAt) return 'pending';
  return req.state === 'running' ? 'running' : 'idle';
}

/** The watcher writes a heartbeat every 5 min; 15 min without one means the Mac is off or asleep. */
export function watcherOnline(heartbeatAt: string | undefined, now: Date): boolean {
  return !!heartbeatAt && now.getTime() - Date.parse(heartbeatAt) < 15 * 60_000;
}

export const REFRESH_LABELS: Record<RefreshStatus, string> = {
  idle: 'Actualizar',
  pending: 'En cola…',
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
