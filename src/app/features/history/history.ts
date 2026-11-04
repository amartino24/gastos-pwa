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
import { MEDIOS, MEDIO_LABELS, MONTH_NAMES, MonthData } from '../../core/models';
import { calcPaidSummary, calcSummary, medioTotal, totalUsd } from '../../core/domain/month-logic';

Chart.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, Title, Tooltip, Legend, Filler,
  BarController, LineController, DoughnutController,
);

const COLORS = ['#1F6F54', '#C97A2B', '#2B4C9B', '#7A8B3A', '#9A4A06', '#4F8F86', '#8A6FB0', '#5A5E66'];

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
    const usdValues = months.map(totalUsd);
    const arsValues = months.map(m => calcPaidSummary(m).totalARS);
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
    const summaries = months.map(calcSummary);
    const bars = MEDIOS.map((medio, i) => ({
      type: 'bar' as const,
      label: `A vender · ${MEDIO_LABELS[medio]}`,
      data: summaries.map(s => s.find(r => r.medio === medio)?.usdNecesarios ?? 0),
      backgroundColor: COLORS[i] + 'cc',
      borderColor: COLORS[i],
      borderWidth: 1,
      borderRadius: 4,
      stack: 'aVender',
    }));
    const vendidos = {
      type: 'line' as const,
      label: 'USD vendidos',
      data: months.map(m => m.usdVendidos ?? null),
      borderColor: '#9A4A06',
      backgroundColor: '#9A4A06',
      borderWidth: 2,
      pointRadius: 4,
      spanGaps: true,
      tension: 0.3,
    };

    const config = {
      type: 'bar',
      data: { labels, datasets: [...bars, vendidos] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, ticks: { callback: (v: string | number) => `${v} USD` } },
        },
      },
    } as unknown as ChartConfiguration<'bar'>;
    this.charts.push(new Chart(this.usdRef.nativeElement, config));
  }

  private buildCategoriesChart(months: MonthData[], labels: string[]): void {
    const datasets = MEDIOS.map((medio, i) => {
      const color = COLORS[i % COLORS.length];
      return {
        label: MEDIO_LABELS[medio],
        data: months.map(m => medioTotal(m, medio)),
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
      for (const i of m.items) totals[i.name] = (totals[i.name] || 0) + (i.amount || 0);
      for (const b of m.bankAccounts) totals[b.name] = (totals[b.name] || 0) + (b.total || 0);
    }
    const entries = Object.entries(totals).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 8);

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
