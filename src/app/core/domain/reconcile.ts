import { AccountMovement, AppState, BankAccount, ExpenseItem, MonthData, PaidBy, ScraperBank } from '../models';

/** A settled debit of some bank's account. */
export interface Debit extends AccountMovement {
  bank: ScraperBank;
}

const DAY = 86_400_000;
const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
/** Generic banking words that say nothing about what was paid. */
const STOP = new Set(['pago', 'pagos', 'debito', 'deb', 'cuenta', 'transferencia', 'automatico', 'servicio', 'servicios', 'por', 'del', 'con']);
const tokens = (s: string) => norm(s).split(/[^a-z0-9]+/).filter(t => t.length >= 3 && !STOP.has(t));
const close = (a: number, b: number, tolerance: number) => Math.abs(a - b) <= Math.max(1, b * tolerance);
const CARD_PAYMENT = /tarjeta|visa|master|amex|american/i;

function paidBy(d: Debit): PaidBy {
  return { bank: d.bank, fecha: d.fecha, descripcion: d.descripcion, monto: Math.abs(d.monto) };
}

/** Statement paid by a card-payment debit of ~its total, between its closing and a few days after due. */
function matchStatement(account: BankAccount, debits: Debit[]): Debit | undefined {
  if (account.paid || account.paidBy || account.total <= 0 || !account.fechaVencimiento) return undefined;
  const due = Date.parse(account.fechaVencimiento);
  const from = account.fechaCierre ? Date.parse(account.fechaCierre) : due - 40 * DAY;
  return debits.find(d => {
    const t = Date.parse(d.fecha);
    return t >= from && t <= due + 5 * DAY && CARD_PAYMENT.test(d.descripcion) && close(Math.abs(d.monto), account.total, 0.005);
  });
}

/** Expense paid by a debit in its month: same amount (±0.5%), or a similar name and ±5%. */
function matchExpense(item: ExpenseItem, month: MonthData, debits: Debit[]): Debit | undefined {
  if (item.paid || item.paidBy || item.medio !== 'banco' || item.amount <= 0) return undefined;
  const words = new Set([...tokens(item.name), ...tokens(item.auto?.empresa ?? '')]);
  return debits.find(d => {
    if (d.fecha.slice(0, 7) !== month.id || CARD_PAYMENT.test(d.descripcion)) return false;
    const amount = Math.abs(d.monto);
    if (close(amount, item.amount, 0.005)) return true;
    return tokens(d.descripcion).some(t => words.has(t)) && close(amount, item.amount, 0.05);
  });
}

/**
 * Marks as paid what the bank accounts show was debited: card statements (by their
 * total) and Banco expenses (by amount, or name + amount). Each debit pays one thing;
 * something marked once (paidBy) is never re-marked, so unchecking it by hand sticks.
 */
export function applyReconciliation(state: AppState, debitsIn: Debit[]): AppState | null {
  const available = debitsIn.filter(d => d.monto < 0 && !d.pendiente && d.moneda === 'ARS');
  if (available.length === 0) return null;
  const used = new Set<Debit>();
  const free = () => available.filter(d => !used.has(d));
  let changed = false;

  const months = state.months.map(month => {
    let touched = false;
    const bankAccounts = month.bankAccounts.map(account => {
      const d = matchStatement(account, free());
      if (!d) return account;
      used.add(d);
      touched = true;
      return { ...account, paid: true, paidBy: paidBy(d) };
    });
    const items = month.items.map(item => {
      const d = matchExpense(item, month, free());
      if (!d) return item;
      used.add(d);
      touched = true;
      return { ...item, paid: true, paidBy: paidBy(d) };
    });
    if (!touched) return month;
    changed = true;
    return { ...month, bankAccounts, items };
  });

  return changed ? { ...state, months } : null;
}
