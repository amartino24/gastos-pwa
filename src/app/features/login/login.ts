import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MonthsService } from '../../core/services/months';

@Component({
  selector: 'app-login',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="login-container">
      <div class="login-card">
        <div class="app-icon">
          <mat-icon>account_balance_wallet</mat-icon>
        </div>
        <h1>Mis Gastos</h1>
        <p class="subtitle">Ingresá con tu cuenta de Google para sincronizar tus datos entre dispositivos</p>

        @if (error()) {
          <div class="error-msg">{{ error() }}</div>
        }

        <button mat-flat-button class="google-btn" (click)="signIn()" [disabled]="loading()">
          @if (loading()) {
            <mat-spinner diameter="20" />
          } @else {
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width="18" height="18" />
          }
          Continuar con Google
        </button>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8fafc;
      padding: 16px;
    }

    .login-card {
      background: #fff;
      border-radius: 20px;
      padding: 40px 32px;
      max-width: 360px;
      width: 100%;
      text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,.08);
    }

    .app-icon {
      width: 64px;
      height: 64px;
      border-radius: 16px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;

      mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
        color: #fff;
      }
    }

    h1 {
      font-size: 1.6rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 8px;
    }

    .subtitle {
      font-size: 0.875rem;
      color: #64748b;
      line-height: 1.5;
      margin: 0 0 28px;
    }

    .google-btn {
      width: 100%;
      height: 48px;
      border-radius: 12px !important;
      background: #fff !important;
      color: #1e293b !important;
      border: 1.5px solid #e2e8f0;
      font-size: 0.95rem;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      box-shadow: 0 1px 4px rgba(0,0,0,.06);
      transition: box-shadow 0.15s;

      &:hover:not([disabled]) {
        box-shadow: 0 2px 8px rgba(0,0,0,.12);
        border-color: #cbd5e1;
      }
    }

    .error-msg {
      background: #fef2f2;
      color: #dc2626;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 0.8rem;
      margin-bottom: 16px;
      text-align: left;
    }
  `],
})
export class LoginComponent {
  private monthsService = inject(MonthsService);
  loading = signal(false);
  error = signal('');

  async signIn(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.monthsService.signInWithGoogle();
    } catch (err: unknown) {
      const code = (err as {code?: string}).code ?? '';
      const msg = err instanceof Error ? err.message : String(err);
      if (!code.includes('popup-closed') && !msg.includes('popup-closed')) {
        const detail = code || msg;
        this.error.set(detail);
        console.error('[Login]', err);
      }
    } finally {
      this.loading.set(false);
    }
  }
}
