import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MonthsService } from './core/services/months';
import { LoginComponent } from './features/login/login';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MatProgressSpinnerModule, LoginComponent],
  template: `
    @switch (state()) {
      @case ('loading') {
        <div class="loading-overlay">
          <mat-spinner diameter="48" />
        </div>
      }
      @case ('unauthenticated') {
        <app-login />
      }
      @default {
        <router-outlet />
      }
    }
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .loading-overlay {
      height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8fafc;
    }
  `],
})
export class App implements OnInit {
  private monthsService = inject(MonthsService);

  state() {
    if (this.monthsService.loading()) return 'loading';
    return this.monthsService.authState();
  }

  ngOnInit(): void {
    this.monthsService.init();
  }
}
