import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MonthsService } from '../../../../core/services/months';
import { BankAccount } from '../../../../core/models';

@Component({
  selector: 'app-bank-accounts',
  imports: [CommonModule, MatIconModule],
  templateUrl: './bank-accounts.html',
  styleUrl: './bank-accounts.scss',
})
export class BankAccountsComponent {
  @Input({ required: true }) monthId!: string;
  @Input({ required: true }) accounts!: BankAccount[];
  @Input() readonly = false;

  private monthsService = inject(MonthsService);

  get total(): number {
    return this.accounts.reduce((s, a) => s + (a.total || 0), 0);
  }

  update(account: BankAccount, value: string): void {
    const total = parseFloat(value) || 0;
    this.monthsService.updateBankAccount(this.monthId, { ...account, total });
  }
}
