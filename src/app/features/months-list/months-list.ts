import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MonthsService } from '../../core/services/months';
import { ConfirmDialog } from '../../shared/components/confirm-dialog/confirm-dialog';
import { MONTH_NAMES, MonthData } from '../../core/models';

@Component({
  selector: 'app-months-list',
  imports: [
    CommonModule, ReactiveFormsModule,
    MatToolbarModule, MatCardModule, MatButtonModule, MatIconModule,
    MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatChipsModule,
  ],
  templateUrl: './months-list.html',
  styleUrl: './months-list.scss',
})
export class MonthsListComponent {
  private monthsService = inject(MonthsService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private fb = inject(FormBuilder);

  months = this.monthsService.months;
  monthNames = MONTH_NAMES;
  showNewMonthForm = false;
  currentYear = new Date().getFullYear();
  years = [this.currentYear - 1, this.currentYear, this.currentYear + 1];
  availableMonths = computed(() => {
    return MONTH_NAMES.map((name, i) => ({ value: i + 1, label: name }));
  });

  newMonthForm = this.fb.group({
    year: [this.currentYear, Validators.required],
    month: [new Date().getMonth() + 1, Validators.required],
    exchangeRate: [1420, [Validators.required, Validators.min(1)]],
  });

  getTotalUSD(month: MonthData): number {
    const summary = this.monthsService.calcSummary(month);
    return summary.reduce((sum, s) => sum + s.usdNecesarios, 0);
  }

  getMonthLabel(month: number): string {
    return MONTH_NAMES[month - 1];
  }

  openMonth(id: string): void {
    this.router.navigate(['/month', id]);
  }

  createMonth(): void {
    if (this.newMonthForm.invalid) return;
    const { year, month, exchangeRate } = this.newMonthForm.value;
    if (this.monthsService.monthExists(year!, month!)) {
      alert(`Ya existe el mes ${this.getMonthLabel(month!)} ${year}`);
      return;
    }
    const newMonth = this.monthsService.createMonth(year!, month!, exchangeRate!);
    this.showNewMonthForm = false;
    this.router.navigate(['/month', newMonth.id]);
  }

  deleteMonth(event: Event, monthId: string): void {
    event.stopPropagation();
    const ref = this.dialog.open(ConfirmDialog, {
      data: { title: 'Eliminar mes', message: '¿Seguro que querés eliminar este mes?', confirmLabel: 'Eliminar' },
    });
    ref.afterClosed().subscribe(result => {
      if (result) this.monthsService.deleteMonth(monthId);
    });
  }

  goToTemplate(): void {
    this.router.navigate(['/template']);
  }
}
