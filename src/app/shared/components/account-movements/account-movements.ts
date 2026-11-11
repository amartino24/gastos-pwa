import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AccountMovement } from '../../../core/models';
import { shortDate } from '../../utils/dates';

/** Signed amount: "-$1.518.923,09" / "+$2.000.000,00". */
export function signedAmount(m: AccountMovement): string {
  const abs = Math.abs(m.monto).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${m.monto < 0 ? '-' : '+'}${m.moneda === 'USD' ? 'US$ ' : '$'}${abs}`;
}

/** Account movements list: date, description, signed amount and the balance after it. */
@Component({
  selector: 'app-account-movements',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="list">
      @for (m of items(); track $index) {
        <li>
          <span class="date">{{ shortDate(m.fecha) }}</span>
          <span class="desc">
            {{ m.descripcion }}
            @if (m.pendiente) { <span class="tag warn">pendiente</span> }
            @if (paidLabel()(m); as label) { <span class="tag paid">pagó {{ label }}</span> }
          </span>
          <span class="nums">
            <span class="amount" [class.credit]="m.monto > 0">{{ signed(m) }}</span>
            @if (m.saldo !== undefined) {
              <span class="saldo">saldo \${{ fmt(m.saldo) }}</span>
            }
          </span>
        </li>
      }
    </ul>
  `,
  styles: [`
    .list { list-style: none; margin: 0 0 4px; padding: 0; }
    li {
      display: grid; grid-template-columns: 3.25rem 1fr auto; gap: 8px; align-items: baseline;
      padding: 5px 2px; border-bottom: 1px solid var(--g-line-soft); font-size: 0.8125rem;
    }
    li:last-child { border-bottom: none; }
    .date { color: var(--g-ink-2); font-variant-numeric: tabular-nums; }
    .desc { min-width: 0; overflow-wrap: anywhere; color: var(--g-ink); }
    .nums { display: flex; flex-direction: column; align-items: flex-end; }
    .amount { font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; color: var(--g-ink); }
    .credit { color: var(--g-accent-strong); }
    .saldo { font-size: 0.6875rem; color: var(--g-ink-2); white-space: nowrap; font-variant-numeric: tabular-nums; }
    .tag {
      margin-left: 4px; padding: 0 5px; border-radius: 5px;
      font-size: 0.6875rem; font-weight: 600;
    }
    .warn { background: var(--g-warn-soft); color: var(--g-warn); }
    .paid { background: var(--g-accent-soft); color: var(--g-accent-strong); }
  `],
})
export class AccountMovementsComponent {
  readonly items = input.required<AccountMovement[]>();
  /** Name of what this debit paid (reconciliation), if anything. */
  readonly paidLabel = input<(m: AccountMovement) => string | null>(() => null);

  protected readonly shortDate = shortDate;
  protected readonly signed = signedAmount;
  protected readonly fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
