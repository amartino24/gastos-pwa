import { Routes } from '@angular/router';

const monthDetail = () => import('./features/month-detail/month-detail').then(m => m.MonthDetailComponent);

export const routes: Routes = [
  { path: '', loadComponent: monthDetail },
  { path: 'month/:id', loadComponent: monthDetail },
  { path: 'months', loadComponent: () => import('./features/months-list/months-list').then(m => m.MonthsListComponent) },
  { path: 'history', loadComponent: () => import('./features/history/history').then(m => m.History) },
  { path: '**', redirectTo: '' },
];
