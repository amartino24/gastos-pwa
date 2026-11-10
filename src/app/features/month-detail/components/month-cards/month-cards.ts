import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MonthData } from '../../../../core/models';
import { CardsService } from '../../../../core/services/cards';
import { CardSummaryComponent } from '../../../../shared/components/card-summary/card-summary';
import { CardView, viewFromCycle } from '../../../../shared/utils/cards';

/**
 * The card cycles paid in this month, as stored by the scraper: live while the
 * cycle is open, frozen once the bank moves on to the next one.
 */
@Component({
  selector: 'app-month-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, CardSummaryComponent],
  template: `
    @if (views().length) {
      <section class="month-cards" aria-labelledby="month-cards-title">
        <h2 id="month-cards-title" class="title">
          <mat-icon aria-hidden="true">credit_card</mat-icon>
          Tarjetas de este mes
        </h2>
        @for (v of views(); track v.bank + v.tarjeta) {
          <app-card-summary [view]="v" [rate]="month().exchangeRate" [now]="now()" />
        }
      </section>
    }
  `,
  styles: [`
    .month-cards { display: flex; flex-direction: column; gap: 8px; margin: 16px 0; }
    .title {
      display: flex; align-items: center; gap: 8px; margin: 0 0 4px;
      font-size: 0.875rem; font-weight: 600; color: var(--g-ink-2);
    }
    .title mat-icon { font-size: 20px; width: 20px; height: 20px; color: var(--g-accent); }
  `],
})
export class MonthCardsComponent {
  readonly month = input.required<MonthData>();

  private readonly cards = inject(CardsService);
  protected readonly now = signal(new Date());

  protected readonly views = computed<CardView[]>(() => {
    const id = this.month().id;
    const doc = this.cards.doc();
    return this.cards
      .cycles()
      .filter(c => c.mesPago === id)
      .sort((a, b) => a.bank.localeCompare(b.bank) || a.tarjeta.localeCompare(b.tarjeta))
      .map(c => {
        // Open cycle = the bank's latest read still points at this due date.
        const live = doc?.[c.bank]?.tarjetas?.find(t => t.tarjeta === c.tarjeta && t.vencimiento === c.vencimiento);
        return viewFromCycle(c, !!live && !c.final, live?.nuevos ?? 0);
      });
  });

  constructor() {
    const id = setInterval(() => this.now.set(new Date()), 10_000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }
}
