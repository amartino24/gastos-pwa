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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MonthsService } from '../../core/services/months';
import { ConfirmDialog } from '../../shared/components/confirm-dialog/confirm-dialog';
import { AppState, MONTH_NAMES, MonthData, PaidSummary } from '../../core/models';

@Component({
  selector: 'app-months-list',
  imports: [
    CommonModule, ReactiveFormsModule,
    MatToolbarModule, MatCardModule, MatButtonModule, MatIconModule,
    MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatChipsModule, MatSnackBarModule, MatTooltipModule,
  ],
  templateUrl: './months-list.html',
  styleUrl: './months-list.scss',
})
export class MonthsListComponent {
  private monthsService = inject(MonthsService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);

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

  getPaidSummary(month: MonthData): PaidSummary {
    return this.monthsService.calcPaidSummary(month);
  }

  getMonthLabel(month: number): string {
    return MONTH_NAMES[month - 1];
  }

  exportData(): void {
    const state = this.monthsService.getState();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gastos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.snackBar.open('Backup exportado', 'OK', { duration: 2000 });
  }

  importData(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const state = JSON.parse(e.target?.result as string) as AppState;
        if (!state.months || !state.template) throw new Error('Formato inválido');
        this.monthsService.loadState(state);
        this.snackBar.open('Datos importados correctamente', 'OK', { duration: 3000 });
      } catch {
        this.snackBar.open('Error: el archivo no es válido', 'OK', { duration: 3000 });
      }
      (event.target as HTMLInputElement).value = '';
    };
    reader.readAsText(file);
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

  goToHistory(): void {
    this.router.navigate(['/history']);
  }

  goToTemplate(): void {
    this.router.navigate(['/template']);
  }
}
