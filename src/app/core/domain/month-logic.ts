import {
  BankAccount, ExpenseItem, MEDIOS, Medio, MedioSummary, MonthData, MonthSource, PaidSummary, Template,
} from '../models';

export const monthId = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

/** Newest first. */
export function sortMonthsDesc(months: MonthData[]): MonthData[] {
  return [...months].sort((a, b) => (b.year - a.year) || (b.month - a.month));
}

/** Month to open on: the calendar month if it exists, else the most recent one. */
export function currentMonth(months: MonthData[], today: Date): MonthData | undefined {
  const id = monthId(today.getFullYear(), today.getMonth() + 1);
  return months.find(m => m.id === id) ?? sortMonthsDesc(months)[0];
}

/** Adds n months to an ISO date (YYYY-MM-DD), clamping the day to the target month's length. */
export function shiftIsoMonth(iso: string | undefined, n = 1): string | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + (b || 0), 0);

export function itemsOf(month: Pick<MonthData, 'items'>, medio: Medio): ExpenseItem[] {
  return month.items.filter(i => i.medio === medio);
}

/** Pending first, paid last; stable within each block. */
export function sortForDisplay<T extends { paid?: boolean }>(xs: T[]): T[] {
  return [...xs.filter(x => !x.paid), ...xs.filter(x => x.paid)];
}

export function medioTotal(month: MonthData, medio: Medio): number {
  const items = sum(itemsOf(month, medio).map(i => i.amount));
  return medio === 'banco' ? items + sum(month.bankAccounts.map(b => b.total)) : items;
}

export function calcSummary(month: MonthData): MedioSummary[] {
  return MEDIOS.map(medio => {
    const { sobrante, paraUsar } = month.balances[medio];
    const totalGastos = medioTotal(month, medio);
    const diferencia = sobrante - totalGastos;
    const arsNecesarios = (diferencia < 0 ? -diferencia : 0) + paraUsar;
    const usdNecesarios = month.exchangeRate > 0 ? arsNecesarios / month.exchangeRate : 0;
    return { medio, totalGastos, sobrante, diferencia, paraUsar, arsNecesarios, usdNecesarios };
  });
}

export function totalUsd(month: MonthData): number {
  return sum(calcSummary(month).map(s => s.usdNecesarios));
}

export function calcPaidSummary(month: MonthData): PaidSummary {
  const all: { amount: number; paid?: boolean }[] = [
    ...month.items,
    ...month.bankAccounts.map(b => ({ amount: b.total, paid: b.paid })),
  ];
  const paid = all.filter(x => x.paid);
  const totalARS = sum(all.map(x => x.amount));
  const paidARS = sum(paid.map(x => x.amount));
  return { totalItems: all.length, paidItems: paid.length, totalARS, paidARS, pendingARS: totalARS - paidARS };
}

/** Unpaid statements with a due date, soonest first. */
export function upcomingDue(month: MonthData, limit = 3): BankAccount[] {
  return month.bankAccounts
    .filter(b => !b.paid && b.fechaVencimiento)
    .sort((a, b) => a.fechaVencimiento!.localeCompare(b.fechaVencimiento!))
    .slice(0, limit);
}

/** Builds a new month from the previous month or the template (Q24/Q30 rules). */
export function buildNewMonth(
  args: { year: number; month: number; exchangeRate: number; source: MonthSource },
  previous: MonthData | undefined,
  template: Template,
  newId: () => string,
): MonthData {
  const fromPrevious = args.source === 'previous' && !!previous;
  const items = fromPrevious ? previous!.items : template.items;
  const accounts = fromPrevious ? previous!.bankAccounts : template.bankAccounts;
  const paraUsar = fromPrevious
    ? { banco: previous!.balances.banco.paraUsar, efectivo: previous!.balances.efectivo.paraUsar }
    : template.paraUsar;

  return {
    id: monthId(args.year, args.month),
    year: args.year,
    month: args.month,
    exchangeRate: args.exchangeRate,
    items: items.map(i => ({ id: newId(), name: i.name, amount: i.amount, medio: i.medio })),
    bankAccounts: accounts.map(b => ({
      id: newId(),
      name: b.name,
      total: 0,
      ...(fromPrevious && b.fechaCierre ? { fechaCierre: shiftIsoMonth(b.fechaCierre) } : {}),
      ...(fromPrevious && b.fechaVencimiento ? { fechaVencimiento: shiftIsoMonth(b.fechaVencimiento) } : {}),
    })),
    balances: {
      banco: { sobrante: 0, paraUsar: paraUsar.banco || 0 },
      efectivo: { sobrante: 0, paraUsar: paraUsar.efectivo || 0 },
    },
  };
}

/** Snapshot of a month as the new template: unpaid items, statements at $0 without dates. */
export function templateFromMonth(month: MonthData): Template {
  return {
    items: month.items.map(({ id, name, amount, medio }) => ({ id, name, amount, medio })),
    bankAccounts: month.bankAccounts.map(({ id, name }) => ({ id, name, total: 0 })),
    paraUsar: { banco: month.balances.banco.paraUsar, efectivo: month.balances.efectivo.paraUsar },
  };
}

/** The exchange rate of the most recent month, used to prefill a new month. */
export function lastExchangeRate(months: MonthData[]): number | undefined {
  return sortMonthsDesc(months)[0]?.exchangeRate;
}
