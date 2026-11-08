import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MonthsService } from '../../../core/services/months';
import { BackupService } from '../../../core/services/backup';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { NewMonthDialog } from '../new-month-dialog/new-month-dialog';
import { nextMonthToCreate } from '../../utils/months';

/** Toolbar overflow menu: navigation, template, backups and sign-out. */
@Component({
  selector: 'app-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatDividerModule],
  template: `
    <button mat-icon-button [matMenuTriggerFor]="menu" aria-label="Menú">
      <mat-icon>menu</mat-icon>
    </button>
    <mat-menu #menu="matMenu" xPosition="before">
      @if (email) {
        <div class="who" aria-hidden="true">{{ email }}</div>
        <mat-divider />
      }
      <button mat-menu-item (click)="go('/')"><mat-icon>today</mat-icon>Mes actual</button>
      <button mat-menu-item (click)="go('/')"><mat-icon>calendar_month</mat-icon>Meses</button>
      <button mat-menu-item (click)="go('/history')"><mat-icon>bar_chart</mat-icon>Historial</button>
      <button mat-menu-item (click)="newMonth()"><mat-icon>add_circle_outline</mat-icon>Nuevo mes</button>
      @if (monthId()) {
        <button mat-menu-item (click)="saveTemplate()"><mat-icon>bookmark_add</mat-icon>Guardar como plantilla</button>
      }
      <mat-divider />
      <button mat-menu-item (click)="backup.export()"><mat-icon>download</mat-icon>Exportar backup</button>
      <button mat-menu-item (click)="file.click()"><mat-icon>upload</mat-icon>Importar backup</button>
      <mat-divider />
      <button mat-menu-item (click)="signOut()"><mat-icon>logout</mat-icon>Cerrar sesión</button>
    </mat-menu>
    <input #file type="file" accept=".json,application/json" hidden (change)="importFile($event)" />
  `,
  styles: [`.who { padding: 8px 16px; font-size: .8125rem; color: var(--g-ink-2); }`],
})
export class AppMenuComponent {
  /** Month on screen, if any (enables "Guardar como plantilla"). */
  monthId = input<string>();

  private router = inject(Router);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private monthsService = inject(MonthsService);
  protected backup = inject(BackupService);

  email = this.monthsService.userEmail;

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  newMonth(): void {
    this.dialog.open(NewMonthDialog, { data: nextMonthToCreate(this.monthsService.months(), new Date()), width: '360px' });
  }

  saveTemplate(): void {
    const id = this.monthId();
    if (!id) return;
    this.dialog.open(ConfirmDialog, {
      data: { title: 'Guardar como plantilla', message: 'La plantilla pasa a ser una copia de este mes (sin pagos ni montos de tarjetas).', confirmLabel: 'Guardar' },
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      this.monthsService.saveAsTemplate(id);
      this.snackBar.open('Plantilla actualizada', 'OK', { duration: 2000 });
    });
  }

  async importFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    try {
      await this.backup.import(f);
      this.snackBar.open('Datos importados', 'OK', { duration: 2500 });
    } catch {
      this.snackBar.open('El archivo no es un backup válido', 'OK', { duration: 3000 });
    }
  }

  signOut(): void {
    this.dialog.open(ConfirmDialog, {
      data: { title: 'Cerrar sesión', message: `¿Cerrás la sesión${this.email ? ' de ' + this.email : ''}?`, confirmLabel: 'Cerrar sesión' },
    }).afterClosed().subscribe(ok => { if (ok) this.monthsService.signOut(); });
  }
}
