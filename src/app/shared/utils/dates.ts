const SHORT_MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Days from today to an ISO date (negative = past, null = no date). */
export function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(iso + 'T00:00:00');
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** "hoy" · "mañana" · "en 7d" · "hace 2d" */
export function daysLabel(iso?: string): string {
  const d = daysUntil(iso);
  if (d === null) return '';
  if (d === 0) return 'hoy';
  if (d === 1) return 'mañana';
  return d > 0 ? `en ${d}d` : `hace ${-d}d`;
}

/** CSS modifier for due-date badges. */
export function daysClass(iso?: string): string {
  const d = daysUntil(iso);
  if (d === null) return '';
  if (d < 0) return 'days-overdue';
  if (d <= 3) return 'days-urgent';
  if (d <= 7) return 'days-soon';
  return 'days-ok';
}

/** "2026-11-11" → "11 nov" */
export function shortDate(iso?: string): string {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${parseInt(d, 10)} ${SHORT_MONTHS[parseInt(m, 10) - 1]}`;
}
