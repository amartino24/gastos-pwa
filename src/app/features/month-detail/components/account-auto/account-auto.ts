import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { pesify } from '../../../../core/domain/card-sync';
import { BankAccountAuto } from '../../../../core/models';
import { byDateDesc, formatMovementAmount, installmentEnd, updatedAgo } from '../../../../shared/utils/cards';
import { formatArs } from '../../../../shared/utils/currency';
import { shortDate } from '../../../../shared/utils/dates';

/** Scraper detail inside a month's bank account: estimate/closed total, USD split, movements. */
@Component({
  selector: 'app-account-auto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatIconModule],
  templateUrl: './account-auto.html',
  styleUrl: './account-auto.scss',
})
export class AccountAutoComponent {
  readonly auto = input.required<BankAccountAuto>();
  readonly total = input.required<number>();
  readonly exchangeRate = input(0);
  readonly monthId = input.required<string>();

  protected readonly ago = computed(() => updatedAgo(this.auto().updatedAt, new Date()));
  protected readonly movements = computed(() => byDateDesc(this.auto().movimientos));

  protected readonly fmtArs = formatArs;
  protected readonly formatDate = shortDate;
  protected readonly money = formatMovementAmount;
  protected readonly installmentEnd = installmentEnd;
  protected readonly pesify = pesify;
}
