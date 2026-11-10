import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MonthsService } from '../../../../core/services/months';
import { ExpenseItem, MEDIO_LABELS, Medio, MonthData } from '../../../../core/models';
import { itemsOf, medioTotal, sortForDisplay } from '../../../../core/domain/month-logic';
import { AddItemDialog } from '../../../../shared/components/add-item-dialog/add-item-dialog';
import { ConfirmDialog } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { UsdPipe } from '../../../../shared/pipes/usd.pipe';
import { formatArs, parseArs } from '../../../../shared/utils/currency';
import { shortDate } from '../../../../shared/utils/dates';

/** One payment-method section (Banco or Efectivo): its items, totals and, for Banco, the projected cards. */
@Component({
  selector: 'app-medio-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatIconModule, UsdPipe],
  templateUrl: './medio-section.html',
  styleUrl: './medio-section.scss',
})
export class MedioSectionComponent {
  month = input.required<MonthData>();
  medio = input.required<Medio>();

  private monthsService = inject(MonthsService);
  private dialog = inject(MatDialog);

  protected readonly fmtArs = formatArs;
  protected readonly shortDate = shortDate;
  label = computed(() => MEDIO_LABELS[this.medio()]);
  otherLabel = computed(() => MEDIO_LABELS[this.medio() === 'banco' ? 'efectivo' : 'banco']);
  items = computed(() => sortForDisplay(itemsOf(this.month(), this.medio())));
  total = computed(() => medioTotal(this.month(), this.medio()));
  paidCount = computed(() => this.items().filter(i => i.paid).length);

  private update(item: ExpenseItem): void {
    this.monthsService.updateItem(this.month().id, item);
  }

  togglePaid(item: ExpenseItem): void {
    this.update({ ...item, paid: !item.paid });
  }

  rename(item: ExpenseItem, value: string): void {
    const name = value.trim();
    if (name && name !== item.name) this.update({ ...item, name });
  }

  setAmount(item: ExpenseItem, el: HTMLInputElement): void {
    const amount = parseArs(el.value);
    el.value = formatArs(amount);
    if (amount !== item.amount) this.update({ ...item, amount });
  }

  moveToOther(item: ExpenseItem): void {
    this.update({ ...item, medio: item.medio === 'banco' ? 'efectivo' : 'banco' });
  }

  add(): void {
    this.dialog.open(AddItemDialog, { data: { title: `Agregar a ${this.label()}` }, width: '320px' })
      .afterClosed().subscribe(r => {
        if (r?.name) this.monthsService.addItem(this.month().id, this.medio(), r.name, Number(r.amount) || 0);
      });
  }

  remove(item: ExpenseItem): void {
    this.dialog.open(ConfirmDialog, {
      data: { title: 'Eliminar gasto', message: `¿Eliminás "${item.name}"?`, confirmLabel: 'Eliminar' },
    }).afterClosed().subscribe(ok => {
      if (ok) this.monthsService.removeItem(this.month().id, item.id);
    });
  }
}
