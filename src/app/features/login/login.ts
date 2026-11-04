import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MonthsService } from '../../core/services/months';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatProgressSpinnerModule],
  template: `
    <main class="login">
      <div class="hero">
        <div class="logo" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10h18" /><path d="M16 14.5h2" />
          </svg>
        </div>
        <h1>Tus gastos del mes, en orden.</h1>
        <p class="lead">Cargá lo que pagás, marcá lo que ya salió y sabé cuántos dólares vender.</p>
      </div>

      <div class="actions">
        @if (error()) {
          <div class="error-msg" role="alert">No pudimos iniciar sesión ({{ error() }}). Probá de nuevo.</div>
        }
        <button type="button" class="google-btn" (click)="signIn()" [disabled]="loading()" [attr.aria-busy]="loading()">
          @if (loading()) {
            <mat-spinner diameter="20" />
          } @else {
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.6 17.7 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z"/>
              <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z"/>
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.8 6C6.6 42.6 14.6 48 24 48z"/>
            </svg>
          }
          Continuar con Google
        </button>
        <p class="note">Tus datos se sincronizan entre dispositivos.</p>
      </div>
    </main>
  `,
  styles: [`
    .login {
      min-height: 100dvh;
      max-width: 440px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 32px;
      padding: calc(72px + env(safe-area-inset-top)) 28px calc(32px + env(safe-area-inset-bottom));
      background: var(--g-ground);
      color: var(--g-ink);
    }
    .hero { display: flex; flex-direction: column; gap: 20px; }
    .logo {
      width: 56px; height: 56px; border-radius: 16px;
      background: var(--g-accent);
      display: flex; align-items: center; justify-content: center;
    }
    h1 { margin: 0; font-size: 2.5rem; line-height: 1.05; font-weight: 700; letter-spacing: -1.2px; }
    .lead { margin: 0; font-size: 1rem; line-height: 1.5; color: var(--g-ink-2); }
    .actions { display: flex; flex-direction: column; gap: 14px; }
    .google-btn {
      height: 54px; border-radius: 14px;
      border: 1px solid #D6D3CA; background: var(--g-surface); color: var(--g-ink);
      font: 600 1rem var(--g-font);
      display: flex; align-items: center; justify-content: center; gap: 10px;
      cursor: pointer;
      transition: border-color .15s, background .15s;
      &:hover:not([disabled]) { border-color: var(--g-ink-2); }
      &:focus-visible { outline: 3px solid var(--g-accent); outline-offset: 2px; }
      &[disabled] { cursor: progress; opacity: .7; }
    }
    .note { margin: 0; text-align: center; font-size: .8125rem; color: var(--g-ink-2); }
    .error-msg {
      background: #FDECEA; color: #8C1D18;
      border-radius: 12px; padding: 12px 14px; font-size: .875rem;
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
      // Desktop popup: reaches here after success — authState is already 'ready',
      // app.ts switches to router-outlet and this component unmounts.
      // Mobile redirect: never reaches here — page navigated away.
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      const msg = err instanceof Error ? err.message : String(err);
      if (code !== 'auth/popup-closed-by-user' && !msg.includes('popup-closed')) {
        this.error.set(code || msg);
        console.error('[Login]', err);
      }
      this.loading.set(false);
    }
  }
}
