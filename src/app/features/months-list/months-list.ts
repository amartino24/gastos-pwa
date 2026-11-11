import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MonthsService } from '../../core/services/months';
import { MonthData } from '../../core/models';
import { totalUsd } from '../../core/domain/month-logic';
import { ConfirmDialog } from '../../shared/components/confirm-dialog/confirm-dialog';
import { NewMonthDialog } from '../../shared/components/new-month-dialog/new-month-dialog';
import { AppMenuComponent } from '../../shared/components/app-menu/app-menu';
import { BankPanelsComponent } from './components/bank-panels/bank-panels';
import { monthTitle, nextMonthToCreate } from '../../shared/utils/months';

/** Home: upcoming card statements and every month, newest first. */
@Component({
  selector: 'app-months-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, RouterLink, MatToolbarModule, MatButtonModule, MatIconModule, AppMenuComponent, BankPanelsComponent],
  templateUrl: './months-list.html',
  styleUrl: './months-list.scss',
})
export class MonthsListComponent {
  private monthsService = inject(MonthsService);
  private dialog = inject(MatDialog);

  months = this.monthsService.months;
  protected readonly title = monthTitle;
  protected readonly usd = totalUsd;

  newMonth(): void {
    this.dialog.open(NewMonthDialog, { data: nextMonthToCreate(this.months(), new Date()), width: '360px' });
  }

  deleteMonth(m: MonthData): void {
    this.dialog.open(ConfirmDialog, {
      data: { title: 'Eliminar mes', message: `¿Eliminás ${monthTitle(m)}? No se puede deshacer.`, confirmLabel: 'Eliminar' },
    }).afterClosed().subscribe(ok => { if (ok) this.monthsService.deleteMonth(m.id); });
  }
}
