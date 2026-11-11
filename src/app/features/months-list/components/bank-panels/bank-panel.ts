import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { AccountMovement, SCRAPER_BANK_LABELS, ScrapedMovement, ScraperBank } from '../../../../core/models';
import { RefreshButtonComponent } from '../../../../shared/components/card-summary/refresh-button';
import { AccountMovementsComponent } from '../../../../shared/components/account-movements/account-movements';
import {
  CardView, byDateDesc, formatMovementAmount, installmentEnd, isNewMovement, paymentMonth, showNewBadge,
} from '../../../../shared/utils/cards';
import { formatArs } from '../../../../shared/utils/currency';
import { daysClass, daysLabel, shortDate } from '../../../../shared/utils/dates';

export interface BankPanelData {
  bank: ScraperBank;
  /** Latest read of anything for this bank (drives the single refresh pill). */
  updatedAt: string;
  error?: string;
  balance?: { ARS: number; USD: number };
  movements: AccountMovement[];
  cards: { view: CardView; total: number; rate: number }[];
}

/** Everything about one bank on the home: account balance, its card's next statement, and both lists (collapsed). */
@Component({
  selector: 'app-bank-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatIconModule, RouterLink, RefreshButtonComponent, AccountMovementsComponent],
  templateUrl: './bank-panel.html',
  styleUrl: './bank-panel.scss',
})
export class BankPanelComponent {
  readonly data = input.required<BankPanelData>();
  readonly now = input.required<Date>();

  protected readonly movements = computed(() => [...this.data().movements].sort((a, b) => b.fecha.localeCompare(a.fecha)));

  protected readonly bankLabel = SCRAPER_BANK_LABELS;
  protected readonly fmtArs = formatArs;
  protected readonly shortDate = shortDate;
  protected readonly daysLabel = daysLabel;
  protected readonly daysClass = daysClass;
  protected readonly paymentMonth = paymentMonth;
  protected readonly installmentEnd = installmentEnd;
  protected readonly isNew = isNewMovement;
  protected readonly showNewBadge = showNewBadge;
  protected readonly money = formatMovementAmount;
  protected readonly sortedConsumos = (list: ScrapedMovement[]) => byDateDesc(list);
}
