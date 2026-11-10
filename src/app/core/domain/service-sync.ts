import { AppState, ExpenseAuto, ExpenseItem, ServicePayment } from '../models';
import { ensureMonth, pesify, same } from './card-sync';

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Linked expense first, then one named like the company. */
function findItem(items: ExpenseItem[], s: ServicePayment): ExpenseItem | undefined {
  return items.find(i => i.serviceKey === s.key) ?? items.find(i => !i.serviceKey && norm(i.name) === norm(s.empresa));
}

function applyToItem(item: ExpenseItem, s: ServicePayment, rate: number, updatedAt: string, today: string): ExpenseItem {
  const amount = s.moneda === 'USD' ? pesify(0, s.importe, rate) : Math.round(s.importe);
  // First bill for this expense (new link or copied from last month): take the real amount.
  // After that, an amount the user edited by hand wins.
  const ours = !item.auto || item.amount === 0 || item.amount === item.auto.appliedAmount;
  // Auto-debits get paid on their due date; mark it once, so unchecking it by hand sticks.
  const markPaid = s.automatico && s.vencimiento <= today && !item.auto?.paidMarked && !item.paid;
  const auto: ExpenseAuto = {
    empresa: s.empresa,
    vencimiento: s.vencimiento,
    importe: s.importe,
    moneda: s.moneda,
    automatico: s.automatico,
    updatedAt,
    appliedAmount: ours ? amount : item.auto?.appliedAmount,
    paidMarked: item.auto?.paidMarked || markPaid || undefined,
  };
  return {
    ...item,
    serviceKey: s.key,
    amount: ours ? amount : item.amount,
    ...(markPaid ? { paid: true } : {}),
    auto: JSON.parse(JSON.stringify(auto)) as ExpenseAuto,
  };
}

/**
 * Puts each pending bill into the month of its due date (Banco): updates the linked
 * expense, or one named like the company, or adds it. Creates the month if missing
 * (forward only). Null when nothing changed.
 */
export function applyServices(
  state: AppState, services: ServicePayment[], updatedAt: string, newId: () => string, today: string,
): AppState | null {
  let months = state.months;
  let changed = false;

  for (const s of [...services].sort((a, b) => a.vencimiento.localeCompare(b.vencimiento))) {
    const ensured = ensureMonth(months, s.vencimiento.slice(0, 7), state.template, newId);
    if (!ensured) continue;
    const target = ensured.month;
    if (ensured.created) {
      months = [...months, target];
      changed = true;
    }

    const existing = findItem(target.items, s);
    const item: ExpenseItem = existing ?? { id: newId(), name: s.empresa, amount: 0, medio: 'banco' };
    const updated = applyToItem(item, s, target.exchangeRate, updatedAt, today);
    if (existing && same(existing, updated)) continue;

    const items = existing ? target.items.map(i => (i.id === existing.id ? updated : i)) : [...target.items, updated];
    months = months.map(m => (m.id === target.id ? { ...target, items } : m));
    changed = true;
  }

  return changed ? { ...state, months } : null;
}
