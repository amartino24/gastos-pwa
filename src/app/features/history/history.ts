import {
  Component, computed, inject, AfterViewInit,
  ViewChild, ElementRef, OnDestroy, signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatChipsModule } from '@angular/material/chips';
import {
  Chart, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler,
  BarController, LineController, DoughnutController,
  ChartConfiguration,
} from 'chart.js';
import { MonthsService } from '../../core/services/months';
import { MONTH_NAMES, MonthData } from '../../core/models';

Chart.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, Title, Tooltip, Legend, Filler,
  BarController, LineController, DoughnutController,
);

const COLORS = ['#6366f1','#22c55e','#f59e0b','#06b6d4','#f43f5e','#8b5cf6','#10b981','#f97316'];

@Component({
  selector: 'app-history',
  imports: [CommonModule, MatToolbarModule, MatButtonModule, MatIconModule, MatChipsModule, DecimalPipe],
  templateUrl: './history.html',
  styleUrl: './history.scss',
})
export class History implements AfterViewInit, OnDestroy {
  private monthsService = inject(MonthsService);
  private router = inject(Router);

  @ViewChild('usdChart')          usdRef!:  ElementRef<HTMLCanvasElement>;
  @ViewChild('categoriesChart')   catRef!:  ElementRef<HTMLCanvasElement>;
  @ViewChild('tcChart')           tcRef!:   ElementRef<HTMLCanvasElement>;
  @ViewChild('distributionChart') distRef!: ElementRef<HTMLCanvasElement>;

  private charts: Chart[] = [];

  // Months sorted chronologically (oldest → newest) for charts
  private chronoMonths = computed(() => [...this.monthsService.months()].reverse());

  hasData = computed(() => this.chronoMonths().length >= 1);
  selectedRange = signal<'all' | '6' | '12'>('all');

  private displayMonths = computed(() => {
    const months = this.chronoMonths();
    const range = this.selectedRange();
    if (range === '6')  return months.slice(-6);
    if (range === '12') return months.slice(-12);
    return months;
  });

  // Stats for the summary header
  stats = computed(() => {
    const months = this.displayMonths();
    if (!months.length) return null;
    const usdValues = months.map(m =>
      this.monthsService.calcSummary(m).reduce((s, p) => s + p.usdNecesarios, 0)
    );
    const arsValues = months.map(m =>
      m.expenseGroups.reduce((s, g) => s + g.items.reduce((a, i) => a + (i.amount || 0), 0), 0)
    );
    return {
      avgUSD: usdValues.reduce((a, b) => a + b, 0) / usdValues.length,
      maxUSD: Math.max(...usdValues),
      avgARS: arsValues.reduce((a, b) => a + b, 0) / arsValues.length,
      totalMonths: months.length,
    };
  });

  ngAfterViewInit(): void {
    this.buildCharts();
  }

  ngOnDestroy(): void {
    this.charts.forEach(c => c.destroy());
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  setRange(range: 'all' | '6' | '12'): void {
    this.selectedRange.set(range);
    this.rebuildCharts();
  }

  private rebuildCharts(): void {
    this.charts.forEach(c => c.destroy());
    this.charts = [];
    this.buildCharts();
  }

  private buildCharts(): void {
    const months = this.displayMonths();
    if (!months.length) return;

    const labels = months.map(m => `${MONTH_NAMES[m.month - 1].slice(0, 3)} ${String(m.year).slice(2)}`);

    this.buildUSDChart(months, labels);
    this.buildCategoriesChart(months, labels);
    this.buildTCChart(months, labels);
    this.buildDistributionChart(months);
  }

  private buildUSDChart(months: MonthData[], labels: string[]): void {
    const summaries = months.map(m => this.monthsService.calcSummary(m));
    const pocketNames = [...new Set(months.flatMap(m => m.pockets.map(p => p.name)))];

    const datasets = pocketNames.map((name, i) => ({
      label: name,
      data: summaries.map(s => s.find(p => p.pocket.name === name)?.usdNecesarios ?? 0),
      backgroundColor: COLORS[i % COLORS.length] + 'cc',
      borderColor: COLORS[i % COLORS.length],
      borderWidth: 1,
      borderRadius: 4,
    }));

    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: pocketNames.length > 1 }, title: { display: false } },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, ticks: { callback: v => `$${v}` } },
        },
      },
    };
    this.charts.push(new Chart(this.usdRef.nativeElement, config));
  }

  private buildCategoriesChart(months: MonthData[], labels: string[]): void {
    // Collect all unique category names across all months (preserve first-seen order)
    const allNames = [...new Set(months.flatMap(m => m.expenseGroups.map(g => g.name)))];

    const datasets = allNames.map((name, i) => {
      const color = COLORS[i % COLORS.length];
      return {
        label: name,
        data: months.map(m => {
          const group = m.expenseGroups.find(g => g.name === name);
          return group ? group.items.reduce((s, item) => s + (item.amount || 0), 0) : 0;
        }),
        borderColor: color,
        backgroundColor: color + '22',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: color,
        tension: 0.3,
        fill: false,
      };
    });

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, padding: 12, font: { size: 11 } },
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: $${(ctx.raw as number).toLocaleString('es-AR')}`,
            },
          },
        },
        scales: {
          x: { grid: { display: false } },
          y: { ticks: { callback: v => `$${Number(v).toLocaleString('es-AR')}` } },
        },
      },
    };
    this.charts.push(new Chart(this.catRef.nativeElement, config));
  }

  private buildTCChart(months: MonthData[], labels: string[]): void {
    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'ARS/USD',
          data: months.map(m => m.exchangeRate),
          borderColor: '#f59e0b',
          backgroundColor: '#fef3c7',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: '#f59e0b',
          fill: true,
          tension: 0.3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { ticks: { callback: v => `$${Number(v).toLocaleString('es-AR')}` } },
        },
      },
    };
    this.charts.push(new Chart(this.tcRef.nativeElement, config));
  }

  private buildDistributionChart(months: MonthData[]): void {
    const totals: Record<string, number> = {};
    for (const m of months) {
      for (const g of m.expenseGroups) {
        totals[g.name] = (totals[g.name] || 0) + g.items.reduce((s, i) => s + (i.amount || 0), 0);
      }
    }
    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);

    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels: entries.map(([k]) => k),
        datasets: [{
          data: entries.map(([, v]) => v),
          backgroundColor: COLORS.map(c => c + 'cc'),
          borderColor: COLORS,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 12, padding: 10, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const v = ctx.raw as number;
                const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
                return ` $${v.toLocaleString('es-AR')} (${((v / total) * 100).toFixed(0)}%)`;
              },
            },
          },
        },
      },
    };
    this.charts.push(new Chart(this.distRef.nativeElement, config));
  }
}
