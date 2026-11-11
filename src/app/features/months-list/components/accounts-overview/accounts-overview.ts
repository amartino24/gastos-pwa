import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { AccountMovement, SCRAPER_BANK_LABELS, ScraperBank } from '../../../../core/models';
import { CardsService } from '../../../../core/services/cards';
import { updatedAgo } from '../../../../shared/utils/cards';
import { formatArs } from '../../../../shared/utils/currency';
import { shortDate } from '../../../../shared/utils/dates';

interface AccountRow {
  bank: ScraperBank;
  ars: number;
  usd: number;
  updatedAt: string;
  movements: AccountMovement[];
}

/** Home's "Cuentas": balance per bank and its recent movements, collapsed by default. */
@Component({
  selector: 'app-accounts-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatIconModule],
  templateUrl: './accounts-overview.html',
  styleUrl: './accounts-overview.scss',
})
export class AccountsOverviewComponent {
  private readonly cards = inject(CardsService);

  protected readonly rows = computed<AccountRow[]>(() => {
    const saldos = this.cards.saldos();
    const movs = this.cards.accountMovements();
    return (Object.keys(SCRAPER_BANK_LABELS) as ScraperBank[]).flatMap(bank => {
      const s = saldos[bank];
      if (!s) return [];
      const movements = [...(movs[bank]?.items ?? [])].sort((a, b) => b.fecha.localeCompare(a.fecha));
      return [{ bank, ars: s.ARS, usd: s.USD, updatedAt: s.updatedAt, movements }];
    });
  });
  protected readonly totalArs = computed(() => this.rows().reduce((n, r) => n + r.ars, 0));

  protected readonly bankLabel = SCRAPER_BANK_LABELS;
  protected readonly fmtArs = formatArs;
  protected readonly shortDate = shortDate;
  protected readonly ago = (iso: string) => updatedAgo(iso, new Date());
  protected readonly signed = (m: AccountMovement) =>
    `${m.monto < 0 ? '-' : '+'}$${Math.abs(m.monto).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
