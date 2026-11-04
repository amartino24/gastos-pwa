/** Converts an ARS amount to USD at the given ARS/USD rate. Null when rate is not usable. */
export function arsToUsd(ars: number | null | undefined, rate: number | null | undefined): number | null {
  if (!rate || rate <= 0) return null;
  return (ars || 0) / rate;
}
