import { Injectable, inject } from '@angular/core';
import { MonthsService } from './months';
import { ExpenseItem, BankAccount } from '../models';

/**
 * Thin facade over MonthsService for template operations.
 * All state lives in MonthsService so template changes are
 * immediately visible when creating new months.
 */
@Injectable({ providedIn: 'root' })
export class TemplateService {
  private months = inject(MonthsService);

  template = this.months.template;

  updateTemplateItem(groupId: string, item: ExpenseItem): void {
    this.months.updateTemplateItem(groupId, item);
  }

  addTemplateItem(groupId: string, name: string, amount: number): void {
    this.months.addTemplateItem(groupId, name, amount);
  }

  removeTemplateItem(groupId: string, itemId: string): void {
    this.months.removeTemplateItem(groupId, itemId);
  }

  updateTemplateBankAccount(_account: BankAccount): void {
    // not implemented yet
  }

  resetToDefault(): void {
    this.months.resetTemplateToDefault();
  }
}
