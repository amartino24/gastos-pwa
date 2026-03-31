import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MonthsService } from '../../../../core/services/months';
import { ExpenseGroup, ExpenseItem } from '../../../../core/models';
import { AddItemDialog } from '../../../../shared/components/add-item-dialog/add-item-dialog';
import { ConfirmDialog } from '../../../../shared/components/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-expense-group',
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatExpansionModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatCheckboxModule,
  ],
  templateUrl: './expense-group.html',
  styleUrl: './expense-group.scss',
})
export class ExpenseGroupComponent {
  @Input({ required: true }) monthId!: string;
  @Input({ required: true }) group!: ExpenseGroup;
  @Input() readonly = false;

  private monthsService = inject(MonthsService);
  private dialog = inject(MatDialog);

  get total(): number {
    return this.group.items.reduce((s, i) => s + (i.amount || 0), 0);
  }

  get paidCount(): number {
    return this.group.items.filter(i => i.paid).length;
  }

  get paidAmount(): number {
    return this.group.items.filter(i => i.paid).reduce((s, i) => s + (i.amount || 0), 0);
  }

  get paidPercent(): number {
    return this.group.items.length ? (this.paidCount / this.group.items.length) * 100 : 0;
  }

  updateItem(item: ExpenseItem, newAmount: string): void {
    const amount = parseFloat(newAmount) || 0;
    this.monthsService.updateExpenseItem(this.monthId, this.group.id, { ...item, amount });
  }

  updateItemName(item: ExpenseItem, newName: string): void {
    if (newName.trim()) {
      this.monthsService.updateExpenseItem(this.monthId, this.group.id, { ...item, name: newName.trim() });
    }
  }

  addItem(): void {
    const ref = this.dialog.open(AddItemDialog, {
      data: { title: `Agregar a ${this.group.name}` },
      width: '320px',
    });
    ref.afterClosed().subscribe(result => {
      if (result?.name) {
        this.monthsService.addExpenseItem(this.monthId, this.group.id, result.name, result.amount ?? 0);
      }
    });
  }

  togglePaid(item: ExpenseItem): void {
    this.monthsService.toggleItemPaid(this.monthId, this.group.id, item);
  }

  removeItem(itemId: string): void {
    const ref = this.dialog.open(ConfirmDialog, {
      data: { title: 'Eliminar ítem', message: '¿Eliminás este gasto?', confirmLabel: 'Eliminar' },
    });
    ref.afterClosed().subscribe(result => {
      if (result) this.monthsService.removeExpenseItem(this.monthId, this.group.id, itemId);
    });
  }
}
