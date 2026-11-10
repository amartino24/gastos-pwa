import { Injectable, Injector, effect, inject, untracked } from '@angular/core';
import { SCRAPER_BANK_LABELS, ScraperBank } from '../models';
import { RefreshOutcome, refreshOutcome } from '../../shared/utils/cards';
import { CardsService } from './cards';

const BANKS = Object.keys(SCRAPER_BANK_LABELS) as ScraperBank[];

/** Toast when a refresh requested from the app finishes: OK (with new movements) or the error. */
@Injectable({ providedIn: 'root' })
export class RefreshNotifierService {
  private readonly cards = inject(CardsService);
  private readonly injector = inject(Injector);
  /** Only runs that finish while the app is open. */
  private readonly openedAt = new Date().toISOString();
  private readonly notified = new Set<string>();

  constructor() {
    effect(() => {
      const requests = this.cards.requests();
      const doc = this.cards.doc();
      for (const bank of BANKS) {
        const req = requests?.[bank];
        if (!req?.finishedAt || req.state !== 'idle' || req.finishedAt < this.openedAt) continue;
        const key = `${bank}:${req.finishedAt}`;
        if (this.notified.has(key)) continue;
        this.notified.add(key);
        const outcome = refreshOutcome(req, doc?.[bank]);
        untracked(() => void this.show(bank, outcome));
      }
    });
  }

  /** Snack bar is imported on demand: keeps Material's overlay out of the initial bundle. */
  private async show(bank: ScraperBank, outcome: RefreshOutcome): Promise<void> {
    const { MatSnackBar } = await import('@angular/material/snack-bar');
    const snackBar = this.injector.get(MatSnackBar);
    const name = SCRAPER_BANK_LABELS[bank];
    switch (outcome.kind) {
      case 'ok': {
        const nuevos = outcome.nuevos === 0 ? 'sin consumos nuevos' : `${outcome.nuevos} ${outcome.nuevos === 1 ? 'consumo nuevo' : 'consumos nuevos'}`;
        snackBar.open(`${name} actualizado · ${nuevos}`, undefined, { duration: 4000 });
        break;
      }
      case 'error':
        snackBar.open(`${name}: no se pudo actualizar — ${outcome.error}`, 'OK', { duration: 12000 });
        break;
      case 'no-data':
        snackBar.open(`${name}: la corrida terminó sin datos nuevos`, 'OK', { duration: 6000 });
        break;
    }
  }
}
