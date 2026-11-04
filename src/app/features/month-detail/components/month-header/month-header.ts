import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MonthsService } from '../../../../core/services/months';
import { DolarService } from '../../../../core/services/dolar';
import { MonthData } from '../../../../core/models';
import { formatArs, parseArs } from '../../../../shared/utils/currency';

/** Exchange-rate bar: editable real TC plus a button to load the current blue midpoint. */
@Component({
  selector: 'app-month-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  templateUrl: './month-header.html',
  styleUrl: './month-header.scss',
})
export class MonthHeaderComponent {
  month = input.required<MonthData>();

  private monthsService = inject(MonthsService);
  private dolar = inject(DolarService);
  private snackBar = inject(MatSnackBar);

  protected readonly fmt = formatArs;
  refreshing = signal(false);

  onRateChange(el: HTMLInputElement): void {
    const rate = parseArs(el.value);
    if (rate > 0) {
      el.value = formatArs(rate);
      this.monthsService.updateExchangeRate(this.month().id, rate);
    } else {
      el.value = formatArs(this.month().exchangeRate);
    }
  }

  async refreshBlue(): Promise<void> {
    this.refreshing.set(true);
    try {
      const rate = await this.dolar.blueMid();
      this.monthsService.updateExchangeRate(this.month().id, rate);
      this.snackBar.open(`TC actualizado: blue promedio $${formatArs(rate)}`, 'OK', { duration: 2500 });
    } catch (err) {
      console.error('[TC] blue fetch failed', err);
      this.snackBar.open('No se pudo traer el dólar blue', 'OK', { duration: 3000 });
    } finally {
      this.refreshing.set(false);
    }
  }
}
