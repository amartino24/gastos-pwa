import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MonthsService } from '../../../../core/services/months';
import { MonthData } from '../../../../core/models';

@Component({
  selector: 'app-month-header',
  imports: [CommonModule, FormsModule, MatCardModule, MatFormFieldModule, MatInputModule],
  templateUrl: './month-header.html',
})
export class MonthHeaderComponent {
  @Input({ required: true }) month!: MonthData;
  private monthsService = inject(MonthsService);

  onRateChange(value: string): void {
    const rate = parseFloat(value);
    if (rate > 0) this.monthsService.updateExchangeRate(this.month.id, rate);
  }
}
