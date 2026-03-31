import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface AddItemDialogData {
  title: string;
  namePlaceholder?: string;
  showAmount?: boolean;
}

@Component({
  selector: 'app-add-item-dialog',
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" style="display:flex;flex-direction:column;gap:12px;padding-top:8px">
        <mat-form-field appearance="outline">
          <mat-label>{{ data.namePlaceholder ?? 'Nombre' }}</mat-label>
          <input matInput formControlName="name" autocomplete="off" />
        </mat-form-field>
        @if (data.showAmount !== false) {
          <mat-form-field appearance="outline">
            <mat-label>Monto</mat-label>
            <span matTextPrefix>$&nbsp;</span>
            <input matInput type="number" formControlName="amount" min="0" />
          </mat-form-field>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-button color="primary" [mat-dialog-close]="form.value" [disabled]="form.invalid">
        Agregar
      </button>
    </mat-dialog-actions>
  `,
})
export class AddItemDialog {
  private fb = inject(FormBuilder);
  data = inject<AddItemDialogData>(MAT_DIALOG_DATA);

  form = this.fb.group({
    name: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(0)]],
  });
}
