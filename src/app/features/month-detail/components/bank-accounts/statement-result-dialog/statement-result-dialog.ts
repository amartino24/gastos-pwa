import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { BankAccount } from '../../../../../core/models';

export interface StatementResultData {
  filename: string;
  amount: number | null;
  account: BankAccount;
}

@Component({
  selector: 'app-statement-result-dialog',
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule,
  ],
  template: `
    <div class="dialog-header">
      <mat-icon class="dialog-icon">description</mat-icon>
      <div>
        <div class="dialog-title">Resumen adjunto</div>
        <div class="dialog-subtitle">{{ data.account.name }}</div>
      </div>
    </div>

    <mat-dialog-content>
      <div class="filename-row">
        <mat-icon>picture_as_pdf</mat-icon>
        <span class="filename">{{ data.filename }}</span>
      </div>

      @if (data.amount !== null) {
        <div class="found-label">Importe encontrado</div>
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>Importe a guardar</mat-label>
          <span matTextPrefix>$&nbsp;</span>
          <input matInput type="number" [(ngModel)]="editableAmount" min="0" />
        </mat-form-field>
      } @else {
        <div class="not-found">
          <mat-icon>search_off</mat-icon>
          <p>No encontramos el importe automáticamente.<br>Ingresalo manualmente:</p>
        </div>
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>Importe a guardar</mat-label>
          <span matTextPrefix>$&nbsp;</span>
          <input matInput type="number" [(ngModel)]="editableAmount" min="0" />
        </mat-form-field>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Cancelar</button>
      <button mat-flat-button color="primary" (click)="confirm()" [disabled]="editableAmount <= 0">
        Guardar
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 24px 0;
    }
    .dialog-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #7b1fa2;
    }
    .dialog-title {
      font-weight: 600;
      font-size: 1rem;
      color: #212121;
    }
    .dialog-subtitle {
      font-size: 0.8rem;
      color: #9e9e9e;
      margin-top: 2px;
    }
    .filename-row {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #f3e5f5;
      border-radius: 8px;
      padding: 8px 12px;
      margin-bottom: 16px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #7b1fa2; }
    }
    .filename {
      font-size: 0.8rem;
      color: #5e35b1;
      font-weight: 500;
      word-break: break-all;
    }
    .found-label {
      font-size: 0.75rem;
      color: #9e9e9e;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 8px;
    }
    .not-found {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      color: #9e9e9e;
      padding: 8px 0 12px;
      mat-icon { font-size: 32px; width: 32px; height: 32px; color: #bdbdbd; margin-bottom: 4px; }
      p { font-size: 0.85rem; margin: 0; line-height: 1.5; }
    }
  `],
})
export class StatementResultDialog {
  data = inject<StatementResultData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<StatementResultDialog>);

  editableAmount = this.data.amount ?? 0;

  confirm(): void {
    this.dialogRef.close(this.editableAmount);
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}
