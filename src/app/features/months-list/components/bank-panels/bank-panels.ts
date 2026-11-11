import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { pesify } from '../../../../core/domain/card-sync';
import { SCRAPER_BANK_LABELS, ScraperBank } from '../../../../core/models';
import { CardsService } from '../../../../core/services/cards';
import { MonthsService } from '../../../../core/services/months';
import { paymentMonth, refreshStatus, viewFromScraped, watcherOnline } from '../../../../shared/utils/cards';
import { formatArs } from '../../../../shared/utils/currency';
import { BankPanelComponent, BankPanelData } from './bank-panel';

const BANKS = Object.keys(SCRAPER_BANK_LABELS) as ScraperBank[];

/** Home: one summary on top (money in accounts, cards to pay next) and one panel per bank. */
@Component({
  selector: 'app-bank-panels',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatIconModule, BankPanelComponent],
  template: `
    @if (panels().length) {
      <section class="summary" aria-label="Resumen de bancos">
        <div class="stat">
          <span class="stat-label">En cuentas</span>
          <span class="stat-value">\${{ fmtArs(totalArs()) }}</span>
          @if (totalUsd()) { <span class="stat-sub">US$ {{ totalUsd() | number:'1.2-2':'es-AR' }}</span> }
        </div>
        @if (toPay(); as p) {
          <div class="stat">
            <span class="stat-label">Tarjetas · {{ p.name }}</span>
            <span class="stat-value">\${{ fmtArs(p.total) }}</span>
          </div>
        }
      </section>

      @if (macOffline()) {
        <p class="offline" role="status">
          <mat-icon aria-hidden="true">laptop_mac</mat-icon>
          Tu Mac está apagada o dormida: se actualiza cuando vuelva a estar online.
        </p>
      }

      <div class="panels">
        @for (p of panels(); track p.bank) {
          <app-bank-panel [data]="p" [now]="now()" />
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; margin: 16px 0; }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      padding: 16px 18px;
      border-radius: 20px;
      background: var(--g-ink);
      color: var(--g-ground);
    }
    .stat { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .stat-label { font-size: 0.75rem; color: #B9BCC2; }
    .stat-value { font-size: 1.5rem; font-weight: 700; font-variant-numeric: tabular-nums; }
    .stat-sub { font-size: 0.8125rem; color: #B9BCC2; font-variant-numeric: tabular-nums; }
    .offline {
      display: flex; align-items: center; gap: 6px; margin: 10px 0 0;
      font-size: 0.8125rem; color: var(--g-warn);
    }
    .offline mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .panels { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
  `],
})
export class BankPanelsComponent {
  private readonly cards = inject(CardsService);
  private readonly months = inject(MonthsService);
  protected readonly now = signal(new Date());

  protected readonly panels = computed<BankPanelData[]>(() => {
    const doc = this.cards.doc();
    const saldos = this.cards.saldos();
    const movs = this.cards.accountMovements();
    return BANKS.flatMap(bank => {
      const data = doc?.[bank];
      const saldo = saldos[bank];
      const mov = movs[bank];
      if (!data && !saldo && !mov) return [];
      const updatedAt = [data?.updatedAt, saldo?.updatedAt, mov?.updatedAt].filter((x): x is string => !!x).sort().at(-1)!;
      const cards = data
        ? (data.tarjetas ?? []).map(card => {
            const view = viewFromScraped(bank, data, card);
            const rate = this.rateFor(view.vencimiento);
            return { view, rate, total: pesify(view.ars, view.usd, rate) };
          })
        : [];
      return [{
        bank,
        updatedAt,
        error: data && !data.ok ? data.error ?? 'error desconocido' : undefined,
        balance: saldo ? { ARS: saldo.ARS, USD: saldo.USD } : undefined,
        movements: mov?.items ?? [],
        cards,
      }];
    });
  });

  protected readonly totalArs = computed(() => this.panels().reduce((n, p) => n + (p.balance?.ARS ?? 0), 0));
  protected readonly totalUsd = computed(() => this.panels().reduce((n, p) => n + (p.balance?.USD ?? 0), 0));

  /** Cards of the nearest payment month, summed (pesified). */
  protected readonly toPay = computed(() => {
    const byMonth = new Map<string, { name: string; total: number }>();
    for (const c of this.panels().flatMap(p => p.cards)) {
      const pm = paymentMonth(c.view.vencimiento);
      if (!pm) continue;
      const entry = byMonth.get(pm.id) ?? { name: pm.name, total: 0 };
      entry.total += c.total;
      byMonth.set(pm.id, entry);
    }
    const first = [...byMonth.keys()].sort()[0];
    return first ? byMonth.get(first)! : null;
  });

  protected readonly macOffline = computed(() =>
    this.panels().some(p => refreshStatus(this.cards.requests()?.[p.bank]) === 'pending') &&
    !watcherOnline(this.cards.requests()?.watcher?.heartbeatAt, this.now()),
  );

  protected readonly fmtArs = formatArs;

  constructor() {
    const id = setInterval(() => this.now.set(new Date()), 10_000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  /** Rate of the payment month if it exists, else the latest one. */
  private rateFor(vencimiento: string | undefined): number {
    const pm = paymentMonth(vencimiento);
    return (pm && this.months.getMonth(pm.id)?.exchangeRate) || this.months.lastExchangeRate() || 0;
  }
}
