import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { RippleModule } from 'primeng/ripple';
import { InputTextModule } from 'primeng/inputtext';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { ConfigService } from '../../services/config.service';
import { MessageService } from 'primeng/api';
import { CalendarModule } from 'primeng/calendar';
import { FormsModule } from '@angular/forms';
interface MLModelAnalytics {
  id: number;
  name: string;
  total_violations: number;
}

interface ViolationAnalytics {
  total_violations: number;
  ml_models: MLModelAnalytics[];
}

interface LiveAlert {
  title: string;
  time: string;
  location: string;
  severity: string;
  severityLabel: string;
  camera: string;
  image: string;
}

@Component({
  selector: 'app-dashboard-overview',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TooltipModule,
    RippleModule,
    InputTextModule,
    NgxChartsModule,   // ✅ ngx-charts
    CalendarModule,
    FormsModule
  ],
  templateUrl: './dashboard-overview.component.html',
  styleUrls: ['./dashboard-overview.component.css'],
  providers: [MessageService]
})
export class DashboardOverviewComponent implements OnInit {
  selectedTimeRange: string = 'daily';

  // KPI values
  totalViolations: number = 0;
  helmetMissingCount: number = 0;
  signalJumpCount: number = 0;
  systemHealthPercent: number = 98;
  totalCameras: number = 42;
  activeCameras: number = 41;
  selectedMonth: Date = new Date();
  maxDate: Date = new Date();
yAxisTickFormatting = (value: number) => {
  if (value % 1 !== 0) return ''; // hide 0.25, 0.5, 0.75 etc.
  return Math.round(value).toString();
};


  loadingAnalytics: boolean = false;
  loadingTrends: boolean = false;

  currentMonth: string = '';

  // ✅ CORRECT ngx-charts multi-series format
  // Structure: [{ name: 'Series Label', series: [{ name: 'Day 1', value: 45 }, ...] }]
  lineChartData: any[] = [];

  // ✅ colorScheme must be a string OR object with domain array
  colorScheme: any = {
    domain: ['#6366f1']
  };
view: [number, number] = [0, 300]; // ✅ 0 width = auto-fill container width


  liveAlerts: LiveAlert[] = [
    {
      title: 'Red Light Violation', time: 'Now',
      location: 'Main St & 5th Ave', severity: 'critical',
      severityLabel: 'Critical', camera: 'Cam-04',
      image: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=200&h=200&fit=crop'
    },
    {
      title: 'No Helmet', time: '2m ago',
      location: 'Baker Ave South', severity: 'warning',
      severityLabel: 'Warning', camera: 'Cam-12',
      image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&h=200&fit=crop'
    },
    {
      title: 'Speeding (85km/h)', time: '5m ago',
      location: 'Highway 9', severity: 'fine',
      severityLabel: 'Fine Issued', camera: 'Cam-08',
      image: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=200&h=200&fit=crop'
    },
    {
      title: 'Wrong Way', time: '12m ago',
      location: 'Exit Ramp 4B', severity: 'urgent',
      severityLabel: 'Urgent', camera: 'Cam-15',
      image: 'https://images.unsplash.com/photo-1485463611174-f302f6a5c1c9?w=200&h=200&fit=crop'
    },
    {
      title: 'Triple Riding', time: '18m ago',
      location: 'Market Square', severity: 'review',
      severityLabel: 'Review', camera: 'Cam-23',
      image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=200&h=200&fit=crop'
    }
  ];

  constructor(
    private configService: ConfigService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadViolationAnalytics();
    this.loadMonthlyTrends();
  }
formatMonthYear(date: Date): string {
  const month = date.toLocaleString('default', { month: 'long' });
  const year = date.getFullYear();
  return `${month}_${year}`;
}
  loadViolationAnalytics(): void {
    this.loadingAnalytics = true;
    this.configService.get('api/violations/analytics/').subscribe({
      next: (response: any) => {
        const analytics: ViolationAnalytics = {
          total_violations: response.total_violations ?? 0,
          ml_models: (response.ml_model_wise_violations || []).map((m: any) => ({
            id: m.ml_model__id,
            name: m.ml_model__name,
            total_violations: m.total
          }))
        };
        this.applyAnalyticsToDashboard(analytics);
        this.loadingAnalytics = false;
      },
      error: (error) => {
        console.error('Error loading violation analytics:', error);
        this.messageService.add({
          severity: 'error', summary: 'Error',
          detail: 'Failed to load dashboard analytics'
        });
        this.loadingAnalytics = false;
      }
    });
  }
onMonthChange(): void {
  this.loadMonthlyTrends();
}
loadMonthlyTrends(): void {

  this.loadingTrends = true;

  const monthParam = this.formatMonthYear(this.selectedMonth);

  this.configService
    .get(`api/violations/monthly-trends/${monthParam}/`)
    .subscribe({

      next: (response: any) => {

        this.currentMonth = response.current_month || '';

        const rawTrends = response.monthly_trends || [];

        // Map API data → day : total
        const dataMap = new Map<number, number>();
        rawTrends.forEach((trend: any) => {
          dataMap.set(trend.day, trend.total);
        });


        const today = new Date();

        const selectedYear  = this.selectedMonth.getFullYear();
        const selectedMonth = this.selectedMonth.getMonth();

        const currentYear   = today.getFullYear();
        const currentMonth  = today.getMonth();

        // Determine if selected month is current month
        const isCurrentMonth =
          selectedYear === currentYear &&
          selectedMonth === currentMonth;

        // Determine last day to display
        const lastDay = isCurrentMonth
          ? today.getDate()
          : new Date(selectedYear, selectedMonth + 1, 0).getDate();


        const fullSeries = [];

        for (let day = 1; day <= lastDay; day++) {
          fullSeries.push({
            name: `${day}`,
            value: dataMap.get(day) ?? 0
          });
        }


        // ngx-charts requires multi-series format
        this.lineChartData = [
          {
            name: 'Violations',
            series: fullSeries
          }
        ];

        this.loadingTrends = false;

      },

      error: (error) => {

        console.error('Error loading monthly trends:', error);

        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load monthly trends'
        });

        this.loadingTrends = false;

      }

    });

}

get yScaleMax(): number {
  if (!this.lineChartData.length || !this.lineChartData[0]?.series?.length) {
    return 5;
  }
  const max = Math.max(
    ...this.lineChartData[0].series.map((s: any) => s.value)
  );
  return Math.max(max + 1, 5);
}

  private applyAnalyticsToDashboard(analytics: ViolationAnalytics): void {
    this.totalViolations = analytics.total_violations;

    const helmetModel = analytics.ml_models.find(
      m => m.name.toLowerCase().includes('helmet')
    );
    const signalModel = analytics.ml_models.find(
      m => m.name.toLowerCase().includes('signal') ||
           m.name.toLowerCase().includes('red light') ||
           m.name.toLowerCase().includes('signal jump')
    );

    this.helmetMissingCount = helmetModel ? helmetModel.total_violations : 0;
    this.signalJumpCount    = signalModel ? signalModel.total_violations : 0;
  }
}
