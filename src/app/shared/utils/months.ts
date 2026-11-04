import { MONTH_NAMES, MonthData } from '../../core/models';
import { monthId, sortMonthsDesc } from '../../core/domain/month-logic';

/** "Noviembre 2026" */
export function monthTitle(m: Pick<MonthData, 'year' | 'month'>): string {
  return `${MONTH_NAMES[m.month - 1]} ${m.year}`;
}

/** Month to offer in "Nuevo mes": the calendar month if missing, else the one after the newest. */
export function nextMonthToCreate(months: MonthData[], today: Date): { year: number; month: number } {
  const cal = { year: today.getFullYear(), month: today.getMonth() + 1 };
  if (!months.some(m => m.id === monthId(cal.year, cal.month))) return cal;
  const newest = sortMonthsDesc(months)[0];
  return newest.month === 12 ? { year: newest.year + 1, month: 1 } : { year: newest.year, month: newest.month + 1 };
}
