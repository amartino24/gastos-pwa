import { Component, Input, NgZone, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
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
    MatIconModule, MatButtonModule, MatTooltipModule, MatProgressSpinnerModule,
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

  removeAccount(accountId: string): void {
    this.monthsService.removeBankAccount(this.monthId, accountId);
  }
}
