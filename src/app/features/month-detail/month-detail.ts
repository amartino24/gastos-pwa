import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MonthsService } from '../../core/services/months';
import { MEDIOS, MONTH_NAMES } from '../../core/models';
import { calcPaidSummary, monthId, totalUsd, upcomingDue } from '../../core/domain/month-logic';
import { MedioSectionComponent } from './components/medio-section/medio-section';
import { BankAccountsComponent } from './components/bank-accounts/bank-accounts';
import { SummaryTableComponent } from './components/summary-table/summary-table';
import { MonthHeaderComponent } from './components/month-header/month-header';
import { AppMenuComponent } from '../../shared/components/app-menu/app-menu';
import { NewMonthDialog } from '../../shared/components/new-month-dialog/new-month-dialog';
import { daysClass, daysLabel, shortDate } from '../../shared/utils/dates';
import { monthTitle, nextMonthToCreate } from '../../shared/utils/months';

/** A month's screen. Without an :id route param it is the home screen and shows the current month. */
@Component({
  selector: 'app-month-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, MatToolbarModule, MatButtonModule, MatIconModule,
    MedioSectionComponent, BankAccountsComponent, SummaryTableComponent, MonthHeaderComponent, AppMenuComponent,
  ],
  templateUrl: './month-detail.html',
  styleUrl: './month-detail.scss',
})
export class MonthDetailComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private monthsService = inject(MonthsService);
  private dialog = inject(MatDialog);

  protected readonly medios = MEDIOS;
  protected readonly title = monthTitle;
  protected readonly daysLabel = daysLabel;
  protected readonly daysClass = daysClass;
  protected readonly shortDate = shortDate;

  private paramId = toSignal(this.route.paramMap.pipe(map(p => p.get('id'))));
  isHome = computed(() => !this.paramId());
  month = computed(() => {
    const id = this.paramId();
    return id ? this.monthsService.getMonth(id) : this.monthsService.current();
  });

  totalUSD = computed(() => { const m = this.month(); return m ? totalUsd(m) : 0; });
  paid = computed(() => { const m = this.month(); return m ? calcPaidSummary(m) : null; });
  due = computed(() => { const m = this.month(); return m ? upcomingDue(m) : []; });
  saveError = this.monthsService.saveError;

  /** On home, offer to create the calendar month when it doesn't exist yet. */
  missingCalendarMonth = computed(() => {
    if (!this.isHome()) return null;
    const t = new Date();
    const id = monthId(t.getFullYear(), t.getMonth() + 1);
    return this.monthsService.getMonth(id) ? null : MONTH_NAMES[t.getMonth()];
  });

  newMonth(): void {
    this.dialog.open(NewMonthDialog, { data: nextMonthToCreate(this.monthsService.months(), new Date()), width: '360px' });
  }

  goBack(): void {
    this.router.navigate(['/months']);
  }
}
