import { AppState, BankAccount, BankAccountAuto, CardCycle, MonthData, SCRAPER_BANK_LABELS, ScraperBank } from '../models';
import { buildNewMonth, lastExchangeRate, monthId, sortMonthsDesc } from './month-logic';

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** The month's account for this bank: first whose name mentions the bank. */
function findAccount(month: MonthData, bank: ScraperBank): BankAccount | undefined {
  const name = norm(SCRAPER_BANK_LABELS[bank]);
  return month.bankAccounts.find(a => norm(a.name).includes(name));
}

/** Real total once closed, else the open-cycle estimate. */
function cycleAmounts(cycle: CardCycle): { ARS: number; USD: number } {
  return cycle.final ?? cycle.forecast ?? { ARS: 0, USD: 0 };
}

/** Pesos + dollars converted at `rate` (the month's exchange rate). */
export function pesify(ars: number, usd: number, rate: number): number {
  return Math.round(ars + (rate > 0 ? usd * rate : 0));
}

function applyToAccount(account: BankAccount, cycle: CardCycle, rate: number): BankAccount {
  const { ARS, USD } = cycleAmounts(cycle);
  const total = pesify(ARS, USD, rate);
  // Respect the user: an uploaded statement or a hand-edited total wins over ours.
  const ours = account.total === 0 || account.total === account.auto?.appliedTotal;
  const canSetTotal = !account.statement && ours;
  const auto: BankAccountAuto = {
    bank: cycle.bank,
    tarjeta: cycle.tarjeta,
    updatedAt: cycle.updatedAt,
    ars: ARS,
    usd: USD,
    final: cycle.final ? true : undefined,
    minimo: cycle.final?.minimo,
    appliedTotal: canSetTotal ? total : account.auto?.appliedTotal,
    movimientos: cycle.pendientes ?? account.auto?.movimientos ?? [],
  };
  return {
    ...account,
    total: canSetTotal ? total : account.total,
    fechaCierre: cycle.cierre ?? account.fechaCierre,
    fechaVencimiento: cycle.vencimiento,
    auto: JSON.parse(JSON.stringify(auto)) as BankAccountAuto, // drop undefined keys (Firestore-safe, stable compare)
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Puts every card cycle into its payment month: creates the month when missing
 * (only going forward, from the newest month like "Nuevo mes"), finds or adds the
 * bank's account and fills total, dates and movement detail. Null when nothing changed.
 */
export function applyCardCycles(state: AppState, cycles: CardCycle[], newId: () => string): AppState | null {
  let months = state.months;
  let changed = false;

  for (const cycle of [...cycles].sort((a, b) => a.mesPago.localeCompare(b.mesPago))) {
    const [year, month] = cycle.mesPago.split('-').map(Number);
    if (!year || !month) continue;
    const id = monthId(year, month);

    let target = months.find(m => m.id === id);
    if (!target) {
      const previous = sortMonthsDesc(months)[0];
      // Never back-fill old months (e.g. a closed statement of a month you never created).
      if (previous && id < previous.id) continue;
      target = buildNewMonth(
        { year, month, exchangeRate: lastExchangeRate(months) ?? 0, source: previous ? 'previous' : 'template' },
        previous,
        state.template,
        newId,
      );
      months = [...months, target];
      changed = true;
    }

    const existing = findAccount(target, cycle.bank);
    const account = existing ?? { id: newId(), name: SCRAPER_BANK_LABELS[cycle.bank], total: 0 };
    const updated = applyToAccount(account, cycle, target.exchangeRate);
    if (existing && same(existing, updated)) continue;

    const bankAccounts = existing
      ? target.bankAccounts.map(a => (a.id === existing.id ? updated : a))
      : [...target.bankAccounts, updated];
    const next = { ...target, bankAccounts };
    months = months.map(m => (m.id === id ? next : m));
    changed = true;
  }

  return changed ? { ...state, months } : null;
}
