import { Injectable, inject } from '@angular/core';
import { MonthsService } from './months';

/** JSON backup export/import of the whole app state. */
@Injectable({ providedIn: 'root' })
export class BackupService {
  private months = inject(MonthsService);

  export(): void {
    const blob = new Blob([JSON.stringify(this.months.getState(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gastos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Accepts v1 or v2 backups; throws on anything that isn't a backup. */
  async import(file: File): Promise<void> {
    const parsed = JSON.parse(await file.text()) as { months?: unknown };
    if (!parsed || !Array.isArray(parsed.months)) throw new Error('Formato inválido');
    this.months.loadState(parsed);
  }
}
