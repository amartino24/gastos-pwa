import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { TemplateService } from '../../core/services/template';
import { ExpenseItem, BankAccount } from '../../core/models';
import { AddItemDialog } from '../../shared/components/add-item-dialog/add-item-dialog';
import { ConfirmDialog } from '../../shared/components/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-template',
  imports: [
    CommonModule, FormsModule,
    MatToolbarModule, MatCardModule, MatButtonModule, MatIconModule,
    MatExpansionModule, MatFormFieldModule, MatInputModule,
  ],
  templateUrl: './template.html',
  styleUrl: './template.scss',
})
export class TemplateComponent {
  private templateService = inject(TemplateService);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  template = this.templateService.template;

  goBack(): void {
    this.router.navigate(['/']);
  }

  groupTotal(groupId: string): number {
    const group = this.template().expenseGroups.find(g => g.id === groupId);
    return group?.items.reduce((s, i) => s + (i.amount || 0), 0) ?? 0;
  }

  updateItem(groupId: string, item: ExpenseItem, newAmount: string): void {
    this.templateService.updateTemplateItem(groupId, { ...item, amount: parseFloat(newAmount) || 0 });
  }

  updateItemName(groupId: string, item: ExpenseItem, newName: string): void {
    if (newName.trim()) {
      this.templateService.updateTemplateItem(groupId, { ...item, name: newName.trim() });
    }
  }

  addItem(groupId: string, groupName: string): void {
    const ref = this.dialog.open(AddItemDialog, {
      data: { title: `Agregar a ${groupName}` },
      width: '320px',
    });
    ref.afterClosed().subscribe(result => {
      if (result?.name) {
        this.templateService.addTemplateItem(groupId, result.name, result.amount ?? 0);
      }
    });
  }

  removeItem(groupId: string, itemId: string): void {
    const ref = this.dialog.open(ConfirmDialog, {
      data: { title: 'Eliminar ítem', message: '¿Eliminás este gasto de la plantilla?', confirmLabel: 'Eliminar' },
    });
    ref.afterClosed().subscribe(result => {
      if (result) this.templateService.removeTemplateItem(groupId, itemId);
    });
  }

  updateBankAccount(account: BankAccount, value: string): void {
    // Bank account names can be renamed; amount in template is not used
  }

  resetTemplate(): void {
    const ref = this.dialog.open(ConfirmDialog, {
      data: {
        title: 'Restaurar plantilla',
        message: '¿Restaurar la plantilla a los valores originales? Perderás los cambios actuales.',
        confirmLabel: 'Restaurar',
      },
    });
    ref.afterClosed().subscribe(result => {
      if (result) {
        this.templateService.resetToDefault();
        this.snackBar.open('Plantilla restaurada', 'OK', { duration: 2000 });
      }
    });
  }
}
