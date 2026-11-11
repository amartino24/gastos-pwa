import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { AccountMovement, MonthData, PaidBy, SCRAPER_BANK_LABELS, ScraperBank } from '../../../../core/models';
import { CardsService } from '../../../../core/services/cards';
import { AccountMovementsComponent } from '../../../../shared/components/account-movements/account-movements';
import { formatArs } from '../../../../shared/utils/currency';

/** This month's account movements per bank (accumulated history), collapsed, with what each debit paid. */
@Component({
  selector: 'app-month-movements',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, AccountMovementsComponent],
  template: `
    @if (banks().length) {
      <section class="movements" aria-labelledby="month-movements-title">
        <h2 id="month-movements-title" class="title">
          <mat-icon aria-hidden="true">account_balance</mat-icon>
          Movimientos de la cuenta
        </h2>
        @for (b of banks(); track b.bank) {
          <details class="fold">
            <summary>
              <mat-icon aria-hidden="true">expand_more</mat-icon>
              <span class="bank">{{ label[b.bank] }}</span>
              <span class="count">{{ b.items.length }} mov.</span>
              <span class="out">-\${{ fmt(b.out) }}</span>
              <span class="in">+\${{ fmt(b.in) }}</span>
            </summary>
            <app-account-movements [items]="b.items" [paidLabel]="paidLabel()" />
          </details>
        }
      </section>
    }
  `,
  styles: [`
    .movements { display: flex; flex-direction: column; gap: 6px; margin: 16px 0; }
    .title {
      display: flex; align-items: center; gap: 8px; margin: 0 0 2px;
      font-size: 0.875rem; font-weight: 600; color: var(--g-ink-2);
    }
    .title mat-icon { font-size: 20px; width: 20px; height: 20px; color: var(--g-accent); }
    .fold {
      background: var(--g-surface); border: 1px solid var(--g-line); border-radius: 14px; padding: 4px 14px;
    }
    summary {
      display: flex; align-items: center; gap: 8px; padding: 8px 0; cursor: pointer; list-style: none;
      font-size: 0.875rem; font-variant-numeric: tabular-nums;
    }
    summary::-webkit-details-marker { display: none; }
    summary:focus-visible { outline: 2px solid var(--g-accent); outline-offset: 2px; border-radius: 6px; }
    summary mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--g-accent-strong); transition: transform 0.15s; }
    .fold[open] summary mat-icon { transform: rotate(180deg); }
    .bank { font-weight: 600; color: var(--g-ink); }
    .count { color: var(--g-ink-2); font-size: 0.75rem; flex: 1; }
    .out { font-weight: 600; color: var(--g-ink); }
    .in { font-weight: 600; color: var(--g-accent-strong); }
  `],
})
export class MonthMovementsComponent {
  readonly month = input.required<MonthData>();
  private readonly cards = inject(CardsService);

  protected readonly banks = computed(() =>
    this.cards.monthMovements(this.month().id).map(b => ({
      ...b,
      out: -b.items.filter(m => m.monto < 0).reduce((n, m) => n + m.monto, 0),
      in: b.items.filter(m => m.monto > 0).reduce((n, m) => n + m.monto, 0),
    })),
  );

  /** "pagó Monotributo": debits matched by the reconciliation to an expense or a card statement. */
  protected readonly paidLabel = computed(() => {
    const m = this.month();
    const paid: { by: PaidBy; name: string }[] = [
      ...m.items.flatMap(i => (i.paidBy ? [{ by: i.paidBy, name: i.name }] : [])),
      ...m.bankAccounts.flatMap(a => (a.paidBy ? [{ by: a.paidBy, name: `resumen ${a.name}` }] : [])),
    ];
    return (mov: AccountMovement) =>
      paid.find(p => p.by.fecha === mov.fecha && Math.abs(p.by.monto - Math.abs(mov.monto)) < 0.01 && p.by.descripcion === mov.descripcion)
        ?.name ?? null;
  });

  protected readonly label: Record<ScraperBank, string> = SCRAPER_BANK_LABELS;
  protected readonly fmt = formatArs;
}
