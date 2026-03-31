import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatDividerModule } from '@angular/material/divider';
import { MonthsService } from '../../../../core/services/months';
import { PocketSummary, Pocket } from '../../../../core/models';

@Component({
  selector: 'app-summary-table',
  imports: [CommonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatTableModule, MatDividerModule],
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

  displayedColumns = ['name', 'gastos', 'sobrante', 'diferencia', 'paraUsar', 'usdNecesarios', 'arsNecesarios'];

  updateSobrante(pocket: Pocket, value: string): void {
    if (!this.monthId) return;
    const sobrante = parseFloat(value) || 0;
    this.monthsService.updatePocket(this.monthId, { ...pocket, sobrante });
  }

  updateParaUsar(pocket: Pocket, value: string): void {
    if (!this.monthId) return;
    const paraUsar = parseFloat(value) || 0;
    this.monthsService.updatePocket(this.monthId, { ...pocket, paraUsar });
  }
}
