import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { SCRAPER_BANK_LABELS, ScraperBank } from '../../../core/models';
import { CardsService } from '../../../core/services/cards';
import { REFRESH_LABELS, isStale, refreshStatus, updatedAgo, waitingLabel } from '../../utils/cards';

/** "hace 5 min ⟳" pill: asks the Mac watcher to re-scrape one bank. */
@Component({
  selector: 'app-refresh-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <button type="button" class="fc-refresh-btn" [disabled]="status() !== 'idle'" [attr.aria-busy]="status() !== 'idle'"
      [attr.aria-label]="ariaLabel()" (click)="refresh()">
      @if (status() === 'idle') {
        <span class="fc-updated" [class.fc-stale]="stale()">{{ ago() }}</span>
      } @else {
        <span class="fc-updated">{{ busyLabel() }}</span>
      }
      <mat-icon aria-hidden="true" [class.fc-spin]="status() !== 'idle'">refresh</mat-icon>
    </button>
  `,
  styles: [`
    .fc-refresh-btn {
      display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0;
      padding: 4px 6px 4px 10px;
      border: 1px solid var(--g-line); border-radius: 999px;
      background: var(--g-surface); color: var(--g-accent-strong);
      font: 500 0.75rem var(--g-font); cursor: pointer;
    }
    mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .fc-refresh-btn:hover:not(:disabled) { background: var(--g-accent-soft); }
    .fc-refresh-btn:focus-visible { outline: 2px solid var(--g-accent); outline-offset: 2px; }
    .fc-refresh-btn:disabled { cursor: default; color: var(--g-ink-2); }
    .fc-updated { color: var(--g-ink-2); white-space: nowrap; }
    .fc-stale { color: var(--g-warn); }
    .fc-spin { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .fc-spin { animation: none; } }
  `],
})
export class RefreshButtonComponent {
  readonly bank = input.required<ScraperBank>();
  readonly updatedAt = input.required<string>();
  readonly now = input.required<Date>();

  private readonly cards = inject(CardsService);
  protected readonly labels = REFRESH_LABELS;
  private readonly request = computed(() => this.cards.requests()?.[this.bank()]);
  protected readonly status = computed(() => refreshStatus(this.request()));
  protected readonly busyLabel = computed(() =>
    this.status() === 'waiting' ? waitingLabel(this.request()?.waitingUntil, this.now()) : REFRESH_LABELS[this.status()],
  );
  protected readonly ago = computed(() => updatedAgo(this.updatedAt(), this.now()));
  protected readonly stale = computed(() => isStale(this.updatedAt(), this.now()));
  protected readonly ariaLabel = computed(() => {
    const name = SCRAPER_BANK_LABELS[this.bank()];
    return this.status() === 'idle' ? `Actualizar ${name}, ${this.ago()}` : `${this.busyLabel()} ${name}`;
  });

  protected refresh(): void {
    this.cards.requestRefresh(this.bank()).catch(err => console.error('[RefreshButton] request failed:', err));
  }
}
