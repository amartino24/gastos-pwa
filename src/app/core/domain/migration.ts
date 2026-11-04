import { AppState, BankAccount, ExpenseItem, Medio, MedioBalance, MonthData, Template } from '../models';

// ── Legacy (v1) shapes: groups belong to pockets, pockets hold sobrante/paraUsar ──

interface LegacyItem { id: string; name: string; amount: number; paid?: boolean }
interface LegacyGroup { id: string; name: string; pocketId?: string; items: LegacyItem[] }
interface LegacyPocket {
  id: string; name: string; groupIds: string[];
  sobrante?: number; paraUsar?: number; isBanco?: boolean;
}
interface LegacyMonth {
  id: string; year: number; month: number; exchangeRate: number;
  expenseGroups: LegacyGroup[]; bankAccounts?: BankAccount[]; pockets: LegacyPocket[];
  isClosed?: boolean; closedAt?: string; notes?: string;
}
interface LegacyTemplate { expenseGroups: LegacyGroup[]; bankAccounts?: BankAccount[]; pockets: LegacyPocket[] }

const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase();

/**
 * Only the cash pocket/group stays Efectivo; everything else (UALA, Mamá y Papá, Banco…) is Banco.
 * A group is Efectivo when its pocket is named "Efectivo", or (no pocket match) the group itself is.
 */
function medioOfGroup(group: LegacyGroup, pockets: LegacyPocket[]): Medio {
  const pocket = pockets.find(p => p.groupIds?.includes(group.id)) ?? pockets.find(p => p.id === group.pocketId);
  if (pocket) return !pocket.isBanco && norm(pocket.name) === 'efectivo' ? 'efectivo' : 'banco';
  return norm(group.name) === 'efectivo' ? 'efectivo' : 'banco';
}

function medioOfPocket(p: LegacyPocket): Medio {
  return !p.isBanco && norm(p.name) === 'efectivo' ? 'efectivo' : 'banco';
}

function flattenItems(groups: LegacyGroup[], pockets: LegacyPocket[]): ExpenseItem[] {
  return groups.flatMap(g => {
    const medio = medioOfGroup(g, pockets);
    return g.items.map(i => ({ id: i.id, name: i.name, amount: i.amount || 0, medio, ...(i.paid ? { paid: true } : {}) }));
  });
}

function mergeBalances(pockets: LegacyPocket[]): Record<Medio, MedioBalance> {
  const out: Record<Medio, MedioBalance> = { banco: { sobrante: 0, paraUsar: 0 }, efectivo: { sobrante: 0, paraUsar: 0 } };
  for (const p of pockets) {
    const b = out[medioOfPocket(p)];
    b.sobrante += p.sobrante || 0;
    b.paraUsar += p.paraUsar || 0;
  }
  return out;
}

function migrateMonth(m: LegacyMonth): MonthData {
  return {
    id: m.id,
    year: m.year,
    month: m.month,
    exchangeRate: m.exchangeRate,
    items: flattenItems(m.expenseGroups ?? [], m.pockets ?? []),
    bankAccounts: m.bankAccounts ?? [],
    balances: mergeBalances(m.pockets ?? []),
    ...(m.notes ? { notes: m.notes } : {}),
  };
}

function migrateTemplate(t: LegacyTemplate): Template {
  const balances = mergeBalances(t.pockets ?? []);
  return {
    items: flattenItems(t.expenseGroups ?? [], t.pockets ?? []).map(({ paid: _p, ...i }) => i),
    bankAccounts: (t.bankAccounts ?? []).map(b => ({ id: b.id, name: b.name, total: 0 })),
    paraUsar: { banco: balances.banco.paraUsar, efectivo: balances.efectivo.paraUsar },
  };
}

export const EMPTY_TEMPLATE: Template = { items: [], bankAccounts: [], paraUsar: { banco: 0, efectivo: 0 } };

export function isLegacyState(raw: unknown): boolean {
  const s = raw as { version?: number; months?: unknown[]; template?: Record<string, unknown> } | null;
  if (!s || typeof s !== 'object') return false;
  if (s.version === 2) return false;
  return Array.isArray(s.months) || !!s.template;
}

/** Converts any stored state (v1 or v2) into a valid v2 AppState. Idempotent. */
export function migrateState(raw: unknown): AppState {
  const s = (raw ?? {}) as { version?: number; months?: unknown[]; template?: unknown };
  if (s.version === 2) return raw as AppState;

  const months = (s.months ?? []).map(m =>
    'expenseGroups' in (m as object) ? migrateMonth(m as LegacyMonth) : (m as MonthData));
  const t = s.template as LegacyTemplate | Template | undefined;
  const template = !t ? structuredClone(EMPTY_TEMPLATE)
    : 'expenseGroups' in t ? migrateTemplate(t) : t;

  return { version: 2, months, template };
}
