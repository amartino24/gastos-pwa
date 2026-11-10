import type { Page } from 'playwright';

export type BankId = 'santander' | 'galicia';
export type Moneda = 'ARS' | 'USD';

export interface Cuota {
  actual: number;
  total: number;
}

export interface CardMovement {
  fecha: string; // YYYY-MM-DD
  descripcion: string;
  moneda: Moneda;
  /** Amount billed in this statement (for installments: the single cuota amount). */
  monto: number;
  cuota?: Cuota;
  /** Bank-side id (e.g. ticket number) when available. */
  id?: string;
  /** Authorized but not yet settled. */
  pendiente?: boolean;
  /** First day the scraper saw this movement (set by scrape.ts). */
  vistoDesde?: string;
}

/** The last statement the bank already closed, with its real amount to pay. */
export interface ClosedStatement {
  cierre: string; // YYYY-MM-DD
  vencimiento: string;
  ARS: number;
  USD: number;
  minimo?: number;
}

/** What one card looks like right now in the homebanking. */
export interface CardSnapshot {
  tarjeta: string; // e.g. "Visa ···1234"
  /** Closing / due date of the open cycle. */
  cierre?: string;
  vencimiento?: string;
  /** Totals as computed by the bank, when it shows them. */
  totalBanco?: { ARS: number; USD: number };
  /** Consumos of the open cycle (installments of the period included). */
  pendientes: CardMovement[];
  /** Previous statement, once closed, when the bank exposes its total. */
  cerrado?: ClosedStatement;
}

/** A pending bill (utilities, phone, etc.) from the bank's "Pagos y servicios". */
export interface ServicePayment {
  /** Stable per company + customer account, to update the same expense month after month. */
  key: string;
  empresa: string;
  rubro?: string;
  vencimiento: string; // YYYY-MM-DD
  importe: number;
  moneda: Moneda;
  /** Debited automatically on the due date. */
  automatico: boolean;
}

export interface ScrapeOptions {
  /** Last 4 digits to keep; empty = every credit card. */
  tarjetas: string[];
}

export type Credentials = Record<string, string>;

export interface CredentialField {
  key: string;
  label: string;
}

export interface BankAdapter {
  id: BankId;
  name: string;
  /** Where discover starts and login begins. */
  startUrl: string;
  credentialFields: readonly CredentialField[];
  login(page: Page, creds: Credentials): Promise<void>;
  scrape(page: Page, opts: ScrapeOptions): Promise<CardSnapshot[]>;
  /** Pending bills, when the bank lists them. Runs after `scrape`, same session. */
  services?(page: Page): Promise<ServicePayment[]>;
  /** Best effort; some banks block new logins while a session stays open. */
  logout?(page: Page): Promise<void>;
}
