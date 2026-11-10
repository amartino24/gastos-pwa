import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { SCRAPER_BANK_LABELS } from '../../../../core/models';
import { CardsService } from '../../../../core/services/cards';
import { MonthsService } from '../../../../core/services/months';
import { CardSummaryComponent } from '../../../../shared/components/card-summary/card-summary';
import { RefreshButtonComponent } from '../../../../shared/components/card-summary/refresh-button';
import { CardView, paymentMonth, refreshStatus, viewFromScraped, watcherOnline } from '../../../../shared/utils/cards';

/** Home's "Próximo resumen": the open cycle of each tracked card, from the local scraper. */
@Component({
  selector: 'app-card-forecast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, CardSummaryComponent, RefreshButtonComponent],
  templateUrl: './card-forecast.html',
  styleUrl: './card-forecast.scss',
})
export class CardForecastComponent {
  private readonly cards = inject(CardsService);
  private readonly months = inject(MonthsService);
  protected readonly now = signal(new Date());

  protected readonly banks = this.cards.banks;
  protected readonly errors = computed(() => this.banks().filter(b => !b.data.ok));
  protected readonly views = computed<CardView[]>(() =>
    this.banks().flatMap(b => (b.data.tarjetas ?? []).map(card => viewFromScraped(b.bank, b.data, card))),
  );

  /** A refresh is waiting and the Mac watcher hasn't checked in for 15 min. */
  protected readonly macOffline = computed(() =>
    this.banks().some(b => refreshStatus(this.cards.requests()?.[b.bank]) === 'pending') &&
    !watcherOnline(this.cards.requests()?.watcher?.heartbeatAt, this.now()),
  );

  protected readonly bankLabel = SCRAPER_BANK_LABELS;

  constructor() {
    const id = setInterval(() => this.now.set(new Date()), 10_000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  /** Rate of the payment month if it exists, else the latest one. */
  protected rateFor(view: CardView): number {
    const pm = paymentMonth(view.vencimiento);
    return (pm && this.months.getMonth(pm.id)?.exchangeRate) || this.months.lastExchangeRate() || 0;
  }
}
