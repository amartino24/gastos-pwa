import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MonthsService } from '../../core/services/months';
import { MEDIOS } from '../../core/models';
import { calcPaidSummary, totalUsd, upcomingDue } from '../../core/domain/month-logic';
import { MedioSectionComponent } from './components/medio-section/medio-section';
import { BankAccountsComponent } from './components/bank-accounts/bank-accounts';
import { MonthCardsComponent } from './components/month-cards/month-cards';
import { MonthMovementsComponent } from './components/month-movements/month-movements';
import { SummaryTableComponent } from './components/summary-table/summary-table';
import { MonthHeaderComponent } from './components/month-header/month-header';
import { AppMenuComponent } from '../../shared/components/app-menu/app-menu';
import { daysClass, daysLabel, shortDate } from '../../shared/utils/dates';
import { monthTitle } from '../../shared/utils/months';

/** One month's screen (route `month/:id`). */
@Component({
  selector: 'app-month-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, MatToolbarModule, MatButtonModule, MatIconModule,
    MedioSectionComponent, BankAccountsComponent, MonthCardsComponent, MonthMovementsComponent, SummaryTableComponent, MonthHeaderComponent, AppMenuComponent,
  ],
  templateUrl: './month-detail.html',
  styleUrl: './month-detail.scss',
})
export class MonthDetailComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private monthsService = inject(MonthsService);

  protected readonly medios = MEDIOS;
  protected readonly title = monthTitle;
  protected readonly daysLabel = daysLabel;
  protected readonly daysClass = daysClass;
  protected readonly shortDate = shortDate;

  private paramId = toSignal(this.route.paramMap.pipe(map(p => p.get('id'))));
  month = computed(() => {
    const id = this.paramId();
    return id ? this.monthsService.getMonth(id) : undefined;
  });

  totalUSD = computed(() => { const m = this.month(); return m ? totalUsd(m) : 0; });
  paid = computed(() => { const m = this.month(); return m ? calcPaidSummary(m) : null; });
  due = computed(() => { const m = this.month(); return m ? upcomingDue(m) : []; });
  saveError = this.monthsService.saveError;

  goBack(): void {
    this.router.navigate(['/']);
  }
}
