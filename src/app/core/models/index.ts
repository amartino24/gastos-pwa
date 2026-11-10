/** How an expense gets paid. Everything that isn't cash goes through the bank. */
export type Medio = 'banco' | 'efectivo';
export const MEDIOS: readonly Medio[] = ['banco', 'efectivo'];

export interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
  medio: Medio;
  paid?: boolean;
  /** Links the expense to a bank bill (kept when copied to the next month). */
  serviceKey?: string;
  /** Last bill applied by the scraper (see core/domain/service-sync.ts). */
  auto?: ExpenseAuto;
}

export interface ExpenseAuto {
  empresa: string;
  vencimiento: string;
  importe: number;
  moneda: 'ARS' | 'USD';
  automatico: boolean;
  updatedAt: string;
  /** Last amount written automatically; a hand-edited amount stops being overwritten. */
  appliedAmount?: number;
  /** Auto-debit already marked as paid once (so unchecking it by hand sticks). */
  paidMarked?: boolean;
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
  /** Filled automatically from the card scraper (see core/domain/card-sync.ts). */
  auto?: BankAccountAuto;
}

export interface BankAccountAuto {
  bank: ScraperBank;
  tarjeta: string;
  updatedAt: string;
  ars: number;
  usd: number;
  /** True once the bank closed the statement: ars/usd are the real amount to pay. */
  final?: boolean;
  minimo?: number;
  /** Last total written automatically; if the user changed `total`, we stop overwriting it. */
  appliedTotal?: number;
  movimientos: ScrapedMovement[];
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

export const SCRAPER_BANK_LABELS: Record<'santander' | 'galicia', string> = {
  santander: 'Santander',
  galicia: 'Galicia',
};

export const MEDIO_LABELS: Record<Medio, string> = {
  banco: 'Banco',
  efectivo: 'Efectivo',
};

// ── Card consumption scraper (written by /scraper into users/{uid}/data/cards) ──

export type ScraperBank = 'santander' | 'galicia';

export interface ScrapedMovement {
  fecha: string; // YYYY-MM-DD
  descripcion: string;
  moneda: 'ARS' | 'USD';
  monto: number;
  cuota?: { actual: number; total: number };
  id?: string;
  pendiente?: boolean;
  /** First day the scraper saw it. */
  vistoDesde?: string;
}

export interface ScrapedCard {
  tarjeta: string;
  cierre?: string;
  vencimiento?: string;
  totalBanco?: { ARS: number; USD: number };
  pendientes: ScrapedMovement[];
  forecast: { ARS: number; USD: number; movimientos: number };
  /** Movements first seen in the last run. */
  nuevos: number;
}

export interface ScrapedBank {
  updatedAt: string;
  ok: boolean;
  error?: string;
  tarjetas?: ScrapedCard[];
}

/** One per card and payment month (month of `vencimiento`); frozen once the bank moves on. */
export interface CardCycle {
  bank: ScraperBank;
  tarjeta: string;
  mesPago: string; // YYYY-MM
  cierre?: string;
  vencimiento: string;
  updatedAt: string;
  /** Estimate while the cycle is open. */
  forecast?: { ARS: number; USD: number };
  totalBanco?: { ARS: number; USD: number };
  pendientes?: ScrapedMovement[];
  /** Real amount to pay, once the bank closed the statement. */
  final?: { ARS: number; USD: number; minimo?: number };
}

/** A pending bill from the bank's "Pagos y servicios" (debit cards excluded). */
export interface ServicePayment {
  key: string;
  empresa: string;
  rubro?: string;
  vencimiento: string; // YYYY-MM-DD
  importe: number;
  moneda: 'ARS' | 'USD';
  automatico: boolean;
}

export interface ScrapedServices {
  updatedAt: string;
  items: ServicePayment[];
}

export type CardsDoc = {
  updatedAt?: string;
  ciclos?: Record<string, CardCycle>;
  servicios?: Partial<Record<ScraperBank, ScrapedServices>>;
} & Partial<Record<ScraperBank, ScrapedBank>>;

/** Manual refresh requests (app → Mac watcher), in users/{uid}/data/scrapeRequests. */
export interface ScrapeRequest {
  requestedAt?: string;
  handledRequest?: string;
  state?: 'waiting' | 'running' | 'idle';
  /** While `waiting`: when the run will start. */
  waitingUntil?: string;
  startedAt?: string;
  finishedAt?: string;
}

export type ScrapeRequestsDoc = { watcher?: { heartbeatAt?: string } } & Partial<Record<ScraperBank, ScrapeRequest>>;

export type RefreshStatus = 'idle' | 'pending' | 'waiting' | 'running';
