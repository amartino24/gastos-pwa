import { Injectable, signal, computed, inject } from '@angular/core';
import { StorageService } from './storage';
import { AppState, ExpenseItem, BankAccount } from '../models';

function uuid(): string {
  return crypto.randomUUID();
}

@Injectable({ providedIn: 'root' })
export class TemplateService {
  private storage = inject(StorageService);
  private state = signal<AppState>(this.storage.load());

  template = computed(() => this.state().template);

  private save(): void {
    this.storage.save(this.state());
  }

  updateTemplateItem(groupId: string, item: ExpenseItem): void {
    this.state.update(s => ({
      ...s,
      template: {
        ...s.template,
        expenseGroups: s.template.expenseGroups.map(g =>
          g.id === groupId
            ? { ...g, items: g.items.map(i => i.id === item.id ? item : i) }
            : g
        ),
      },
    }));
    this.save();
  }

  addTemplateItem(groupId: string, name: string, amount: number): void {
    const item: ExpenseItem = { id: uuid(), name, amount };
    this.state.update(s => ({
      ...s,
      template: {
        ...s.template,
        expenseGroups: s.template.expenseGroups.map(g =>
          g.id === groupId ? { ...g, items: [...g.items, item] } : g
        ),
      },
    }));
    this.save();
  }

  removeTemplateItem(groupId: string, itemId: string): void {
    this.state.update(s => ({
      ...s,
      template: {
        ...s.template,
        expenseGroups: s.template.expenseGroups.map(g =>
          g.id === groupId ? { ...g, items: g.items.filter(i => i.id !== itemId) } : g
        ),
      },
    }));
    this.save();
  }

  updateTemplateBankAccount(account: BankAccount): void {
    this.state.update(s => ({
      ...s,
      template: {
        ...s.template,
        bankAccounts: s.template.bankAccounts.map(b => b.id === account.id ? account : b),
      },
    }));
    this.save();
  }

  resetToDefault(): void {
    const defaultTemplate = this.storage.getDefaultTemplate();
    this.state.update(s => ({ ...s, template: defaultTemplate }));
    this.save();
  }
}
