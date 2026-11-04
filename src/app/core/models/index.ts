/** How an expense gets paid. Everything that isn't cash goes through the bank. */
export type Medio = 'banco' | 'efectivo';
export const MEDIOS: readonly Medio[] = ['banco', 'efectivo'];

export interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
  medio: Medio;
  paid?: boolean;
}

export interface BankAccountStatement {
  filename: string;
  extractedAmount: number;
  uploadedAt: string;
}

/** A credit-card / bank statement. Always paid from Banco. */
export interface BankAccount {
  id: string;
  name: string;
  total: number;
  paid?: boolean;
  fechaCierre?: string;      // ISO date YYYY-MM-DD
  fechaVencimiento?: string; // ISO date YYYY-MM-DD
  statement?: BankAccountStatement;
}

/** Money already available (sobrante) and the extra to keep (paraUsar), per medio. */
export interface MedioBalance {
  sobrante: number;
  paraUsar: number;
}

export interface MonthData {
  id: string;            // YYYY-MM
  year: number;
  month: number;         // 1-12
  exchangeRate: number;  // real ARS/USD rate, entered by the user
  items: ExpenseItem[];
  bankAccounts: BankAccount[];
  balances: Record<Medio, MedioBalance>;
  /** USD actually sold this month. Statistic only. */
  usdVendidos?: number;
  notes?: string;
}

export interface Template {
  items: ExpenseItem[];
  bankAccounts: BankAccount[];
  paraUsar: Record<Medio, number>;
}

export interface AppState {
  version: 2;
  months: MonthData[];
  template: Template;
}

export interface MedioSummary {
  medio: Medio;
  totalGastos: number;
  sobrante: number;
  diferencia: number;
  paraUsar: number;
  arsNecesarios: number;
  usdNecesarios: number;
}

export interface PaidSummary {
  totalItems: number;
  paidItems: number;
  totalARS: number;
  paidARS: number;
  pendingARS: number;
}

export type MonthSource = 'previous' | 'template';

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const MEDIO_LABELS: Record<Medio, string> = {
  banco: 'Banco',
  efectivo: 'Efectivo',
};
