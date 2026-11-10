import { Injectable, effect, inject, untracked } from '@angular/core';
import { arDay } from '../../shared/utils/cards';
import { CardsService } from './cards';
import { MonthsService } from './months';

/**
 * Keeps months in sync with the scraper: whenever card cycles or pending bills arrive
 * (and the user's data is loaded), each lands in its payment month — created if needed.
 */
@Injectable({ providedIn: 'root' })
export class CardSyncService {
  private readonly cards = inject(CardsService);
  private readonly months = inject(MonthsService);

  constructor() {
    effect(() => {
      const cycles = this.cards.cycles();
      const services = this.cards.services();
      const ready = !this.months.loading() && this.months.authState() === 'ready';
      if (!ready || (cycles.length === 0 && services.length === 0)) return;
      untracked(() => this.months.applyScraped(cycles, services, arDay(new Date().toISOString())));
    });
  }
}
