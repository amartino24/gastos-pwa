/** Converts an ARS amount to USD at the given ARS/USD rate. Null when rate is not usable. */
export function arsToUsd(ars: number | null | undefined, rate: number | null | undefined): number | null {
  if (!rate || rate <= 0) return null;
  return (ars || 0) / rate;
}

/** Integer ARS amount with es-AR thousand separators, e.g. 1520000 → "1.520.000". */
export function formatArs(value: number | null | undefined): string {
  return Math.round(value || 0).toLocaleString('es-AR');
}

/** Parses user-typed ARS ("1.520.000", "1520000", "1520000,50") → number. */
export function parseArs(text: string): number {
  const normalized = text.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  return parseFloat(normalized) || 0;
}
