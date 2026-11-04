import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MonthsService } from '../../../core/services/months';
import { DolarService } from '../../../core/services/dolar';
import { MONTH_NAMES, MonthSource } from '../../../core/models';

export interface NewMonthDialogData { year: number; month: number }

/** Creates a month from the previous month (default) or the template, with TC = blue midpoint. */
@Component({
  selector: 'app-new-month-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatRadioModule, MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>Nuevo mes</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form">
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Mes</mat-label>
            <mat-select formControlName="month">
              @for (name of monthNames; track $index) {
                <mat-option [value]="$index + 1">{{ name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Año</mat-label>
            <mat-select formControlName="year">
              @for (y of years; track y) { <mat-option [value]="y">{{ y }}</mat-option> }
            </mat-select>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Tipo de cambio (ARS/USD)</mat-label>
          <span matTextPrefix>$&nbsp;</span>
          <input matInput type="number" formControlName="exchangeRate" min="1" />
          @if (loadingRate()) {
            <mat-spinner matSuffix diameter="18" />
          }
          <mat-hint>{{ rateHint() }}</mat-hint>
        </mat-form-field>

        <fieldset class="source">
          <legend>Arrancar desde</legend>
          <mat-radio-group formControlName="source" aria-label="Arrancar desde">
            <mat-radio-button value="previous" [disabled]="!hasPrevious">Mes anterior</mat-radio-button>
            <mat-radio-button value="template">Plantilla</mat-radio-button>
          </mat-radio-group>
        </fieldset>

        @if (exists()) {
          <p class="error" role="alert">Ese mes ya existe.</p>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">Cancelar</button>
      <button mat-flat-button type="button" (click)="create()" [disabled]="form.invalid">Crear mes</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .form { display: flex; flex-direction: column; gap: 4px; padding-top: 8px; }
    .row { display: flex; gap: 8px; > * { flex: 1; min-width: 0; } }
    .source { border: 0; padding: 0; margin: 8px 0 0; }
    .source legend { font-size: .8125rem; color: var(--g-ink-2); margin-bottom: 4px; }
    mat-radio-group { display: flex; gap: 16px; }
    .error { color: #8C1D18; font-size: .875rem; margin: 4px 0 0; }
  `],
})
export class NewMonthDialog {
  private data = inject<NewMonthDialogData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<NewMonthDialog>);
  private monthsService = inject(MonthsService);
  private dolar = inject(DolarService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  monthNames = MONTH_NAMES;
  years = [this.data.year - 1, this.data.year, this.data.year + 1];
  hasPrevious = this.monthsService.months().length > 0;
  loadingRate = signal(true);
  rateHint = signal('Buscando dólar blue…');
  exists = signal(false);

  form = this.fb.nonNullable.group({
    month: [this.data.month, Validators.required],
    year: [this.data.year, Validators.required],
    exchangeRate: [this.monthsService.lastExchangeRate() ?? 0, [Validators.required, Validators.min(1)]],
    source: [(this.hasPrevious ? 'previous' : 'template') as MonthSource, Validators.required],
  });

  constructor() {
    this.dolar.blueMid()
      .then(rate => {
        this.form.controls.exchangeRate.setValue(rate);
        this.rateHint.set('Dólar blue, promedio compra/venta');
      })
      .catch(() => this.rateHint.set('No se pudo traer el blue: último TC usado'))
      .finally(() => this.loadingRate.set(false));
  }

  create(): void {
    const { year, month, exchangeRate, source } = this.form.getRawValue();
    if (this.monthsService.monthExists(year, month)) {
      this.exists.set(true);
      return;
    }
    const created = this.monthsService.createMonth(year, month, exchangeRate, source);
    this.ref.close(created.id);
    this.router.navigate(['/month', created.id]);
  }
}
