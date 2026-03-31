import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MonthsService } from './core/services/months';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MatProgressSpinnerModule],
  template: `
    @if (monthsService.loading()) {
      <div class="loading-overlay">
        <mat-spinner diameter="48" />
      </div>
    } @else {
      <router-outlet />
    }
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .loading-overlay {
      height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
    }
  `],
})
export class App implements OnInit {
  monthsService = inject(MonthsService);

  ngOnInit(): void {
    this.monthsService.init();
  }
}
