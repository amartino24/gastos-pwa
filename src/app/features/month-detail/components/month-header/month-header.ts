import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MonthsService } from '../../../../core/services/months';
import { MonthData } from '../../../../core/models';

@Component({
  selector: 'app-month-header',
  imports: [CommonModule, MatIconModule],
  templateUrl: './month-header.html',
  styleUrl: './month-header.scss',
})
export class MonthHeaderComponent {
  @Input({ required: true }) month!: MonthData;
  private monthsService = inject(MonthsService);

  onRateChange(value: string): void {
    const rate = parseFloat(value);
    if (rate > 0) this.monthsService.updateExchangeRate(this.month.id, rate);
  }
}
