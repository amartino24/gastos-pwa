import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MonthsService } from '../../../../core/services/months';
import { MEDIO_LABELS, Medio, MonthData } from '../../../../core/models';
import { calcSummary, totalUsd } from '../../../../core/domain/month-logic';
import { sobranteHint } from '../../../../shared/utils/cards';
import { formatArs, parseArs } from '../../../../shared/utils/currency';

/** Collapsible "Cálculo de venta": balances per medio, USD to sell and USD actually sold. */
@Component({
  selector: 'app-summary-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatIconModule],
  templateUrl: './summary-table.html',
  styleUrl: './summary-table.scss',
})
export class SummaryTableComponent {
  month = input.required<MonthData>();

  private monthsService = inject(MonthsService);

  protected readonly fmt = formatArs;
  protected readonly labels = MEDIO_LABELS;
  rows = computed(() => calcSummary(this.month()));
  /** Where the Banco sobrante came from, when the scraper filled it. */
  sobranteHint = computed(() => sobranteHint(this.month().balances.banco, new Date()));
  totalUSD = computed(() => totalUsd(this.month()));

  setBalance(medio: Medio, field: 'sobrante' | 'paraUsar', el: HTMLInputElement): void {
    const value = parseArs(el.value);
    el.value = formatArs(value);
    this.monthsService.updateBalance(this.month().id, medio, { [field]: value });
  }

  setUsdVendidos(el: HTMLInputElement): void {
    const raw = el.value.trim();
    const value = raw ? parseArs(raw) : undefined;
    this.monthsService.updateUsdVendidos(this.month().id, value);
  }
}
