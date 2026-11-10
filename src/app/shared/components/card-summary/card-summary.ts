import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { pesify } from '../../../core/domain/card-sync';
import { SCRAPER_BANK_LABELS } from '../../../core/models';
import {
  CardView, byDateDesc, formatMovementAmount, installmentEnd, isNewMovement, paymentMonth, showNewBadge,
} from '../../utils/cards';
import { formatArs } from '../../utils/currency';
import { daysClass, daysLabel, shortDate } from '../../utils/dates';
import { RefreshButtonComponent } from './refresh-button';

/** One card tile: pesified total, USD split, dates, movements. Used on the home and in each month. */
@Component({
  selector: 'app-card-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatIconModule, RouterLink, RefreshButtonComponent],
  templateUrl: './card-summary.html',
  styleUrl: './card-summary.scss',
})
export class CardSummaryComponent {
  readonly view = input.required<CardView>();
  /** ARS/USD rate to pesify the USD part. */
  readonly rate = input(0);
  readonly now = input.required<Date>();
  /** "Se paga en <mes> →" (home only; inside a month it would point to itself). */
  readonly showMonthLink = input(false);

  protected readonly total = computed(() => pesify(this.view().ars, this.view().usd, this.rate()));
  protected readonly movements = computed(() => byDateDesc(this.view().movimientos));

  protected readonly bankLabel = SCRAPER_BANK_LABELS;
  protected readonly fmtArs = formatArs;
  protected readonly shortDate = shortDate;
  protected readonly daysLabel = daysLabel;
  protected readonly daysClass = daysClass;
  protected readonly isNew = isNewMovement;
  protected readonly showNewBadge = showNewBadge;
  protected readonly paymentMonth = paymentMonth;
  protected readonly installmentEnd = installmentEnd;
  protected readonly money = formatMovementAmount;
}
