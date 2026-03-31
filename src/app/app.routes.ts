import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/months-list/months-list').then(m => m.MonthsListComponent),
  },
  {
    path: 'month/:id',
    loadComponent: () =>
      import('./features/month-detail/month-detail').then(m => m.MonthDetailComponent),
  },
  {
    path: 'template',
    loadComponent: () =>
      import('./features/template/template').then(m => m.TemplateComponent),
  },
  { path: '**', redirectTo: '' },
];
