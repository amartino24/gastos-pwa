import { Component, Input, NgZone, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MonthsService } from '../../../../core/services/months';
import { BankAccount } from '../../../../core/models';
import { StatementParserService } from '../../../../core/services/statement-parser';
import { StatementResultDialog } from './statement-result-dialog/statement-result-dialog';

@Component({
  selector: 'app-bank-accounts',
  imports: [
    CommonModule,
    MatIconModule, MatButtonModule, MatCheckboxModule, MatTooltipModule, MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './bank-accounts.html',
  styleUrl: './bank-accounts.scss',
})
export class BankAccountsComponent {
  @Input({ required: true }) monthId!: string;
  @Input({ required: true }) accounts!: BankAccount[];
  @Input() readonly = false;

  private monthsService = inject(MonthsService);
  private parser = inject(StatementParserService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private zone = inject(NgZone);

  parsing = new Set<string>();

  get total(): number {
    return this.accounts.reduce((s, a) => s + (a.total || 0), 0);
  }

  update(account: BankAccount, value: string): void {
    const total = parseFloat(value) || 0;
    this.monthsService.updateBankAccount(this.monthId, { ...account, total });
  }

  updateDate(account: BankAccount, field: 'fechaCierre' | 'fechaVencimiento', value: string): void {
    this.monthsService.updateBankAccount(this.monthId, {
      ...account,
      [field]: value || undefined,
    });
  }

  // Returns days until date (negative = past, null = no date)
  daysUntil(dateStr?: string): number | null {
    if (!dateStr) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr + 'T00:00:00');
    return Math.round((target.getTime() - today.getTime()) / 86_400_000);
  }

  daysLabel(dateStr?: string): string {
    const d = this.daysUntil(dateStr);
    if (d === null) return '';
    if (d === 0) return 'hoy';
    if (d === 1) return 'mañana';
    if (d > 0) return `en ${d}d`;
    return `hace ${Math.abs(d)}d`;
  }

  daysClass(dateStr?: string): string {
    const d = this.daysUntil(dateStr);
    if (d === null) return '';
    if (d < 0) return 'days-overdue';
    if (d <= 3) return 'days-urgent';
    if (d <= 7) return 'days-soon';
    return 'days-ok';
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    const [, m, d] = dateStr.split('-');
    const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return `${parseInt(d)} ${months[parseInt(m) - 1]}`;
  }

  uploadStatement(account: BankAccount, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    (event.target as HTMLInputElement).value = '';

    this.parsing.add(account.id);

    this.parser.parseFile(file).then(result => {
      this.zone.run(() => {
        this.parsing.delete(account.id);

        const ref = this.dialog.open(StatementResultDialog, {
          data: { filename: result.filename, amount: result.amount, account },
          width: '320px',
        });

        ref.afterClosed().subscribe((confirmed: number | undefined) => {
          if (confirmed !== undefined) {
            this.monthsService.updateBankAccount(this.monthId, {
              ...account,
              total: confirmed,
              statement: {
                filename: result.filename,
                extractedAmount: confirmed,
                uploadedAt: new Date().toISOString(),
              },
            });
          }
        });
      });
    }).catch(err => {
      console.error('[BankAccounts] uploadStatement error:', err);
      this.zone.run(() => {
        this.parsing.delete(account.id);
        this.snackBar.open('No se pudo leer el PDF. Intentá de nuevo.', 'OK', { duration: 4000 });
      });
    });
  }

  removeStatement(account: BankAccount): void {
    const { statement: _, ...rest } = account;
    this.monthsService.updateBankAccount(this.monthId, rest as BankAccount);
  }

  togglePaid(account: BankAccount): void {
    this.monthsService.updateBankAccount(this.monthId, { ...account, paid: !account.paid });
  }

  removeAccount(accountId: string): void {
    this.monthsService.removeBankAccount(this.monthId, accountId);
  }
}
