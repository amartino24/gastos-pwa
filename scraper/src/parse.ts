/** "$ 1.234.567,89" / "-1.234,5" / "99.999" (es-AR) → number; NaN-safe (0). */
export function parseArAmount(text: string | number | null | undefined): number {
  if (typeof text === 'number') return text;
  const m = (text ?? '').replace(/\s/g, '').match(/-?[\d.]*\d(?:,\d+)?/);
  if (!m) return 0;
  const n = Number(m[0].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** "03/11/26", "03/11/2026", "03-11-2026", "2026-11-03" → "2026-11-03". */
export function parseDate(text: string): string | null {
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const m = text.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (!m) return null;
  const year = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
  return `${year}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
}
