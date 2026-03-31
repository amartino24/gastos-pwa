import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MonthsService } from '../../../../core/services/months';
import { PocketSummary, Pocket } from '../../../../core/models';

@Component({
  selector: 'app-summary-table',
  imports: [CommonModule, MatIconModule],
  templateUrl: './summary-table.html',
  styleUrl: './summary-table.scss',
})
export class SummaryTableComponent {
  @Input({ required: true }) summary!: PocketSummary[];
  @Input({ required: true }) exchangeRate!: number;
  @Input({ required: true }) totalUSD!: number;
  @Input() monthId!: string;
  @Input() readonly = false;

  private monthsService = inject(MonthsService);

  // Track which input is focused to show raw number
  focusedInput: string | null = null;

  fmt(n: number): string {
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n);
  }

  onFocus(inputId: string): void { this.focusedInput = inputId; }
  onBlur(inputId: string): void { this.focusedInput = null; }
  isFocused(inputId: string): boolean { return this.focusedInput === inputId; }

  updateSobrante(pocket: Pocket, value: string): void {
    if (!this.monthId) return;
    const sobrante = parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
    this.monthsService.updatePocket(this.monthId, { ...pocket, sobrante });
  }

  updateParaUsar(pocket: Pocket, value: string): void {
    if (!this.monthId) return;
    const paraUsar = parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
    this.monthsService.updatePocket(this.monthId, { ...pocket, paraUsar });
  }
}
