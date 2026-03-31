export interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
  paid?: boolean;
}

export interface ExpenseGroup {
  id: string;
  name: string;
  pocketId: string;
  items: ExpenseItem[];
}

export interface BankAccountStatement {
  filename: string;
  extractedAmount: number;
  uploadedAt: string;
}

export interface BankAccount {
  id: string;
  name: string;
  total: number;
  statement?: BankAccountStatement;
}

export interface Pocket {
  id: string;
  name: string;
  groupIds: string[];
  sobrante: number;
  paraUsar: number;
  isBanco?: boolean;
}

export interface PocketSummary {
  pocket: Pocket;
  totalGastos: number;
  sobrante: number;
  diferencia: number;
  diferenciaUSD: number;
  paraUsar: number;
  paraUsarUSD: number;
  usdNecesarios: number;
  arsNecesarios: number;
}

export interface PaidSummary {
  totalItems: number;
  paidItems: number;
  totalARS: number;
  paidARS: number;
  pendingARS: number;
}

export interface MonthData {
  id: string;
  year: number;
  month: number;
  exchangeRate: number;
  expenseGroups: ExpenseGroup[];
  bankAccounts: BankAccount[];
  pockets: Pocket[];
  isClosed: boolean;
  closedAt?: string;
  notes?: string;
}

export interface Template {
  expenseGroups: ExpenseGroup[];
  bankAccounts: BankAccount[];
  pockets: Omit<Pocket, 'sobrante' | 'paraUsar'>[];
}

export interface AppState {
  months: MonthData[];
  template: Template;
}

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
