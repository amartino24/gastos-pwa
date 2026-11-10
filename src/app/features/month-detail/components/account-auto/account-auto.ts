import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { pesify } from '../../../../core/domain/card-sync';
import { BankAccountAuto } from '../../../../core/models';
import { updatedAgo } from '../../../../shared/utils/cards';
import { formatArs } from '../../../../shared/utils/currency';

/** Scraper detail inside a month's bank account: estimate/closed total, USD split (movements: month cards). */
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

  protected readonly ago = computed(() => updatedAgo(this.auto().updatedAt, new Date()));

  protected readonly fmtArs = formatArs;
  protected readonly pesify = pesify;
}
