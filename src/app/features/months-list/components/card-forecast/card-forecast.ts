import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { pesify } from '../../../../core/domain/card-sync';
import { SCRAPER_BANK_LABELS, ScrapedCard } from '../../../../core/models';
import { CardsService } from '../../../../core/services/cards';
import { MonthsService } from '../../../../core/services/months';
import {
  byDateDesc, formatMovementAmount, installmentEnd, isNewMovement, paymentMonth, refreshStatus, showNewBadge, watcherOnline,
} from '../../../../shared/utils/cards';
import { formatArs } from '../../../../shared/utils/currency';
import { daysClass, daysLabel, shortDate } from '../../../../shared/utils/dates';
import { RefreshButtonComponent } from './refresh-button';

/** Home's "Próximo resumen": live estimate per tracked card, from the local scraper. */
@Component({
  selector: 'app-card-forecast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatIconModule, RouterLink, RefreshButtonComponent],
  templateUrl: './card-forecast.html',
  styleUrl: './card-forecast.scss',
})
export class CardForecastComponent {
  private readonly cards = inject(CardsService);
  private readonly months = inject(MonthsService);
  private readonly clock = signal(new Date());

  protected readonly banks = this.cards.banks;
  protected get now(): Date { return this.clock(); }

  /** A refresh is waiting and the Mac watcher hasn't checked in for 15 min. */
  protected readonly macOffline = computed(() =>
    this.banks().some(b => refreshStatus(this.cards.requests()?.[b.bank]) === 'pending') &&
    !watcherOnline(this.cards.requests()?.watcher?.heartbeatAt, this.clock()),
  );

  constructor() {
    const id = setInterval(() => this.clock.set(new Date()), 10_000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  /** Rate of the payment month if it exists, else the latest one. */
  protected rateFor(card: ScrapedCard): number {
    const pm = paymentMonth(card.vencimiento);
    return (pm && this.months.getMonth(pm.id)?.exchangeRate) || this.months.lastExchangeRate() || 0;
  }

  protected total(card: ScrapedCard): number {
    return pesify(card.forecast.ARS, card.forecast.USD, this.rateFor(card));
  }

  protected readonly bankLabel = SCRAPER_BANK_LABELS;
  protected readonly fmtArs = formatArs;
  protected readonly shortDate = shortDate;
  protected readonly daysLabel = daysLabel;
  protected readonly daysClass = daysClass;
  protected readonly sorted = (card: ScrapedCard) => byDateDesc(card.pendientes);
  protected readonly isNew = isNewMovement;
  protected readonly showNewBadge = showNewBadge;
  protected readonly paymentMonth = paymentMonth;
  protected readonly installmentEnd = installmentEnd;
  protected readonly money = formatMovementAmount;
}
