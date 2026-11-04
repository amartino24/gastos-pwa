import { Injectable, signal, computed, inject } from '@angular/core';
import { FirestoreService } from './firestore.service';
import { DEFAULT_STATE } from './storage';
import { migrateState } from '../domain/migration';
import {
  buildNewMonth, calcPaidSummary, calcSummary, currentMonth, lastExchangeRate, monthId, sortMonthsDesc,
  templateFromMonth,
} from '../domain/month-logic';
import {
  AppState, BankAccount, ExpenseItem, Medio, MedioBalance, MedioSummary, MonthData, MonthSource, PaidSummary,
} from '../models';

const uuid = () => crypto.randomUUID();

@Injectable({ providedIn: 'root' })
export class MonthsService {
  private firestore = inject(FirestoreService);
  private state = signal<AppState>(structuredClone(DEFAULT_STATE));

  loading = signal(true);
  authState = this.firestore.authState;
  saveError = this.firestore.saveError;

  /** Newest first. */
  months = computed(() => sortMonthsDesc(this.state().months));
  template = computed(() => this.state().template);
  /** Calendar month if it exists, else the newest. */
  current = computed(() => currentMonth(this.state().months, new Date()));
  lastExchangeRate = computed(() => lastExchangeRate(this.state().months));

  async init(): Promise<void> {
    try {
      this.state.set(await this.firestore.init());
    } catch (err) {
      console.error('[MonthsService] init failed:', err);
    } finally {
      this.loading.set(false);
    }
  }

  async signInWithGoogle(): Promise<void> {
    // Popup returns state immediately; redirect (Android) navigates away and never gets here.
    this.state.set(await this.firestore.signInWithGoogle());
  }

  async signOut(): Promise<void> {
    await this.firestore.signOut();
    this.state.set(structuredClone(DEFAULT_STATE));
  }

  get userEmail(): string | null { return this.firestore.currentUser?.email ?? null; }
  get userPhoto(): string | null { return this.firestore.currentUser?.photoURL ?? null; }

  getState(): AppState { return this.state(); }

  /** Replaces all data (backup import). Accepts v1 or v2 backups. */
  loadState(raw: unknown): void {
    this.state.set(migrateState(raw));
    this.save();
  }

  getMonth(id: string): MonthData | undefined {
    return this.state().months.find(m => m.id === id);
  }

  monthExists(year: number, month: number): boolean {
    return !!this.getMonth(monthId(year, month));
  }

  // ── Months ────────────────────────────────────────────────────────────────

  createMonth(year: number, month: number, exchangeRate: number, source: MonthSource): MonthData {
    const s = this.state();
    const newMonth = buildNewMonth({ year, month, exchangeRate, source }, sortMonthsDesc(s.months)[0], s.template, uuid);
    this.state.update(st => ({ ...st, months: [...st.months, newMonth] }));
    this.save();
    return newMonth;
  }

  deleteMonth(id: string): void {
    this.state.update(s => ({ ...s, months: s.months.filter(m => m.id !== id) }));
    this.save();
  }

  saveAsTemplate(id: string): void {
    const m = this.getMonth(id);
    if (!m) return;
    this.state.update(s => ({ ...s, template: templateFromMonth(m) }));
    this.save();
  }

  updateExchangeRate(id: string, exchangeRate: number): void {
    this.patchMonth(id, () => ({ exchangeRate }));
  }

  updateUsdVendidos(id: string, usdVendidos: number | undefined): void {
    this.patchMonth(id, () => ({ usdVendidos }));
  }

  updateBalance(id: string, medio: Medio, patch: Partial<MedioBalance>): void {
    this.patchMonth(id, m => ({ balances: { ...m.balances, [medio]: { ...m.balances[medio], ...patch } } }));
  }

  // ── Items ─────────────────────────────────────────────────────────────────

  addItem(id: string, medio: Medio, name: string, amount: number): void {
    const item: ExpenseItem = { id: uuid(), name, amount, medio };
    this.patchMonth(id, m => ({ items: [...m.items, item] }));
  }

  updateItem(id: string, item: ExpenseItem): void {
    this.patchMonth(id, m => ({ items: m.items.map(i => i.id === item.id ? item : i) }));
  }

  removeItem(id: string, itemId: string): void {
    this.patchMonth(id, m => ({ items: m.items.filter(i => i.id !== itemId) }));
  }

  // ── Bank statements ───────────────────────────────────────────────────────

  updateBankAccount(id: string, account: BankAccount): void {
    this.patchMonth(id, m => ({ bankAccounts: m.bankAccounts.map(b => b.id === account.id ? account : b) }));
  }

  removeBankAccount(id: string, accountId: string): void {
    this.patchMonth(id, m => ({ bankAccounts: m.bankAccounts.filter(b => b.id !== accountId) }));
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  calcSummary(month: MonthData): MedioSummary[] { return calcSummary(month); }
  calcPaidSummary(month: MonthData): PaidSummary { return calcPaidSummary(month); }

  private patchMonth(id: string, patch: (m: MonthData) => Partial<MonthData>): void {
    this.state.update(s => ({
      ...s,
      months: s.months.map(m => m.id === id ? { ...m, ...patch(m) } : m),
    }));
    this.save();
  }

  private save(): void {
    this.firestore.save(this.state());
  }
}
