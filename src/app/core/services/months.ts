import { Injectable, signal, computed, inject } from '@angular/core';
import { FirestoreService } from './firestore.service';
import { DEFAULT_STATE } from './storage';
import {
  AppState, MonthData, ExpenseItem, BankAccount,
  Pocket, PocketSummary, PaidSummary
} from '../models';

function uuid(): string {
  return crypto.randomUUID();
}

@Injectable({ providedIn: 'root' })
export class MonthsService {
  private firestore = inject(FirestoreService);
  private state = signal<AppState>(structuredClone(DEFAULT_STATE));

  loading = signal(true);

  months = computed(() => [...this.state().months].sort((a: MonthData, b: MonthData) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  }));

  async init(): Promise<void> {
    try {
      const state = await this.firestore.init();
      this.state.set(state);
    } catch (err) {
      console.error('[MonthsService] init failed:', err);
    } finally {
      this.loading.set(false);
    }
  }

  private save(): void {
    this.firestore.save(this.state());
  }

  getMonth(id: string): MonthData | undefined {
    return this.state().months.find(m => m.id === id);
  }

  createMonth(year: number, month: number, exchangeRate: number): MonthData {
    const template = this.state().template;
    const id = `${year}-${String(month).padStart(2, '0')}`;

    const newMonth: MonthData = {
      id,
      year,
      month,
      exchangeRate,
      expenseGroups: template.expenseGroups.map(g => ({
        ...structuredClone(g),
        id: uuid(),
        items: g.items.map(i => ({ ...i, id: uuid() })),
      })),
      bankAccounts: template.bankAccounts.map(b => ({ ...b, id: uuid(), total: 0 })),
      pockets: template.pockets.map(p => ({
        ...p,
        id: uuid(),
        sobrante: 0,
        paraUsar: 0,
      })) as Pocket[],
      isClosed: false,
    };

    // remap pocket groupIds to new group ids
    const oldToNew: Record<string, string> = {};
    template.expenseGroups.forEach((og, idx) => {
      oldToNew[og.id] = newMonth.expenseGroups[idx].id;
    });
    newMonth.pockets.forEach(p => {
      p.groupIds = p.groupIds.map(gid => oldToNew[gid] ?? gid);
    });

    this.state.update(s => ({ ...s, months: [...s.months, newMonth] }));
    this.save();
    return newMonth;
  }

  monthExists(year: number, month: number): boolean {
    const id = `${year}-${String(month).padStart(2, '0')}`;
    return this.state().months.some(m => m.id === id);
  }

  updateExchangeRate(monthId: string, rate: number): void {
    this.state.update(s => ({
      ...s,
      months: s.months.map(m => m.id === monthId ? { ...m, exchangeRate: rate } : m),
    }));
    this.save();
  }

  toggleItemPaid(monthId: string, groupId: string, item: ExpenseItem): void {
    this.updateExpenseItem(monthId, groupId, { ...item, paid: !item.paid });
  }

  updateExpenseItem(monthId: string, groupId: string, item: ExpenseItem): void {
    this.state.update(s => ({
      ...s,
      months: s.months.map(m => {
        if (m.id !== monthId) return m;
        return {
          ...m,
          expenseGroups: m.expenseGroups.map(g => {
            if (g.id !== groupId) return g;
            return { ...g, items: g.items.map(i => i.id === item.id ? item : i) };
          }),
        };
      }),
    }));
    this.save();
  }

  addExpenseItem(monthId: string, groupId: string, name: string, amount: number): void {
    const item: ExpenseItem = { id: uuid(), name, amount };
    this.state.update(s => ({
      ...s,
      months: s.months.map(m => {
        if (m.id !== monthId) return m;
        return {
          ...m,
          expenseGroups: m.expenseGroups.map(g =>
            g.id === groupId ? { ...g, items: [...g.items, item] } : g
          ),
        };
      }),
    }));
    this.save();
  }

  removeExpenseItem(monthId: string, groupId: string, itemId: string): void {
    this.state.update(s => ({
      ...s,
      months: s.months.map(m => {
        if (m.id !== monthId) return m;
        return {
          ...m,
          expenseGroups: m.expenseGroups.map(g =>
            g.id === groupId ? { ...g, items: g.items.filter(i => i.id !== itemId) } : g
          ),
        };
      }),
    }));
    this.save();
  }

  removeBankAccount(monthId: string, accountId: string): void {
    this.state.update(s => ({
      ...s,
      months: s.months.map(m => {
        if (m.id !== monthId) return m;
        return { ...m, bankAccounts: m.bankAccounts.filter(b => b.id !== accountId) };
      }),
    }));
    this.save();
  }

  updateBankAccount(monthId: string, account: BankAccount): void {
    this.state.update(s => ({
      ...s,
      months: s.months.map(m => {
        if (m.id !== monthId) return m;
        return {
          ...m,
          bankAccounts: m.bankAccounts.map(b => b.id === account.id ? account : b),
        };
      }),
    }));
    this.save();
  }

  updatePocket(monthId: string, pocket: Pocket): void {
    this.state.update(s => ({
      ...s,
      months: s.months.map(m => {
        if (m.id !== monthId) return m;
        return {
          ...m,
          pockets: m.pockets.map(p => p.id === pocket.id ? pocket : p),
        };
      }),
    }));
    this.save();
  }

  closeMonth(monthId: string): void {
    this.state.update(s => ({
      ...s,
      months: s.months.map(m =>
        m.id === monthId ? { ...m, isClosed: true, closedAt: new Date().toISOString() } : m
      ),
    }));
    this.save();
  }

  reopenMonth(monthId: string): void {
    this.state.update(s => ({
      ...s,
      months: s.months.map(m =>
        m.id === monthId ? { ...m, isClosed: false, closedAt: undefined } : m
      ),
    }));
    this.save();
  }

  deleteMonth(monthId: string): void {
    this.state.update(s => ({
      ...s,
      months: s.months.filter(m => m.id !== monthId),
    }));
    this.save();
  }

  getState(): AppState {
    return this.state();
  }

  loadState(newState: AppState): void {
    this.state.set(newState);
    this.save();
  }

  calcPaidSummary(month: MonthData): PaidSummary {
    let totalItems = 0;
    let paidItems = 0;
    let totalARS = 0;
    let paidARS = 0;
    for (const group of month.expenseGroups) {
      for (const item of group.items) {
        totalItems++;
        totalARS += item.amount || 0;
        if (item.paid) {
          paidItems++;
          paidARS += item.amount || 0;
        }
      }
    }
    return { totalItems, paidItems, totalARS, paidARS, pendingARS: totalARS - paidARS };
  }

  calcSummary(month: MonthData): PocketSummary[] {
    return month.pockets.map(pocket => {
      const groups = month.expenseGroups.filter(g => pocket.groupIds.includes(g.id));
      const groupTotal = groups.reduce((sum, g) => sum + g.items.reduce((s, i) => s + (i.amount || 0), 0), 0);
      const bankTotal = pocket.isBanco
        ? month.bankAccounts.reduce((sum, b) => sum + (b.total || 0), 0)
        : 0;
      const totalGastos = groupTotal + bankTotal;
      const diferencia = pocket.sobrante - totalGastos;
      const arsNecesarios = diferencia < 0 ? Math.abs(diferencia) + pocket.paraUsar : pocket.paraUsar;
      const usdNecesarios = month.exchangeRate > 0 ? arsNecesarios / month.exchangeRate : 0;
      return {
        pocket,
        totalGastos,
        sobrante: pocket.sobrante,
        diferencia,
        diferenciaUSD: month.exchangeRate > 0 ? diferencia / month.exchangeRate : 0,
        paraUsar: pocket.paraUsar,
        paraUsarUSD: month.exchangeRate > 0 ? pocket.paraUsar / month.exchangeRate : 0,
        usdNecesarios,
        arsNecesarios,
      };
    });
  }
}
