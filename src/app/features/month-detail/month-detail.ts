import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MonthsService } from '../../core/services/months';
import { MonthData, MONTH_NAMES } from '../../core/models';
import { ExpenseGroupComponent } from './components/expense-group/expense-group';
import { BankAccountsComponent } from './components/bank-accounts/bank-accounts';
import { SummaryTableComponent } from './components/summary-table/summary-table';
import { MonthHeaderComponent } from './components/month-header/month-header';
import { ConfirmDialog } from '../../shared/components/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-month-detail',
  imports: [
    CommonModule,
    MatToolbarModule, MatButtonModule, MatIconModule, MatSnackBarModule, MatChipsModule,
    ExpenseGroupComponent, BankAccountsComponent, SummaryTableComponent, MonthHeaderComponent,
  ],
  templateUrl: './month-detail.html',
  styleUrl: './month-detail.scss',
})
export class MonthDetailComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private monthsService = inject(MonthsService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  monthId = this.route.snapshot.paramMap.get('id')!;
  month = computed(() => this.monthsService.getMonth(this.monthId));
  summary = computed(() => {
    const m = this.month();
    return m ? this.monthsService.calcSummary(m) : [];
  });
  totalUSD = computed(() => this.summary().reduce((s, r) => s + r.usdNecesarios, 0));

  getTitle(month: MonthData): string {
    return `${MONTH_NAMES[month.month - 1]} ${month.year}`;
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  closeMonth(): void {
    const ref = this.dialog.open(ConfirmDialog, {
      data: {
        title: 'Cerrar mes',
        message: 'Una vez cerrado el mes no podrás editar los valores. ¿Confirmás?',
        confirmLabel: 'Cerrar mes',
      },
    });
    ref.afterClosed().subscribe(result => {
      if (result) {
        this.monthsService.closeMonth(this.monthId);
        this.snackBar.open('Mes cerrado', 'OK', { duration: 2000 });
      }
    });
  }

  reopenMonth(): void {
    const ref = this.dialog.open(ConfirmDialog, {
      data: {
        title: 'Reabrir mes',
        message: '¿Querés reabrir este mes para edición?',
        confirmLabel: 'Reabrir',
      },
    });
    ref.afterClosed().subscribe(result => {
      if (result) {
        this.monthsService.reopenMonth(this.monthId);
        this.snackBar.open('Mes reabierto', 'OK', { duration: 2000 });
      }
    });
  }
}
