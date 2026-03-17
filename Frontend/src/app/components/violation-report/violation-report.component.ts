import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// PrimeNG
import { ButtonModule }  from 'primeng/button';
import { BadgeModule }   from 'primeng/badge';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule }     from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule }   from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { ConfigService } from '../../services/config.service';

// ── Interfaces ──────────────────────────────────────────────────────────────

type SeverityLevel = 'critical' | 'warning' | 'info';

interface ViolationStat {
  type:       string;
  count:      number;
  percentage: number;
  severity:   SeverityLevel;
}

interface ViolationEntry {
  id:           number;
  type:         string;
  cameraName:   string;
  licensePlate: string;
  timestamp:    string;
  severity:     SeverityLevel;
}

interface ReportSection {
  label:             string;
  period:            'daily' | 'weekly' | 'monthly';
  apiPeriod:         'today' | 'last_week' | 'current_month';
  totalCount:        number;
  previousCount:     number;
  trend:             number;
  trendDirection:    'up' | 'down' | 'neutral';
  stats:             ViolationStat[];
  recentViolations:  ViolationEntry[];
  loading:           boolean;
  exporting:         boolean;
  error:             boolean;
}

@Component({
  selector:    'app-violation-report',
  standalone:  true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    BadgeModule,
    TooltipModule,
    TagModule,
    SkeletonModule,
    ToastModule,
  ],
  templateUrl: './violation-report.component.html',
  styleUrls:   ['./violation-report.component.css'],
  providers:   [MessageService],
})
export class ViolationReportComponent implements OnInit {

  private readonly SEVERITY_RANKS: SeverityLevel[] = ['critical', 'warning', 'info'];

  reportSections: ReportSection[] = [
    {
      label: 'Daily Violations',   period: 'daily',   apiPeriod: 'today',
      totalCount: 0, previousCount: 0, trend: 0, trendDirection: 'neutral',
      stats: [], recentViolations: [], loading: true, exporting: false, error: false,
    },
    {
      label: 'Weekly Violations',  period: 'weekly',  apiPeriod: 'last_week',
      totalCount: 0, previousCount: 0, trend: 0, trendDirection: 'neutral',
      stats: [], recentViolations: [], loading: true, exporting: false, error: false,
    },
    {
      label: 'Monthly Violations', period: 'monthly', apiPeriod: 'current_month',
      totalCount: 0, previousCount: 0, trend: 0, trendDirection: 'neutral',
      stats: [], recentViolations: [], loading: true, exporting: false, error: false,
    },
  ];

  constructor(
    private configService: ConfigService,
    private messageService: MessageService,
  ) {}

  ngOnInit(): void {
    this.loadAllReports();
  }

  // ── Load ──────────────────────────────────────────────────────────────────

  loadAllReports(): void {
    this.reportSections.forEach(s => {
      s.loading = true;
      s.error   = false;
      this.loadPeriodReport(s);
    });
  }

  refreshSection(section: ReportSection): void {
    section.loading = true;
    section.error   = false;
    this.loadPeriodReport(section);
  }

  private loadPeriodReport(section: ReportSection): void {
    this.configService
      .get(`api/violations/period-report/?period=${section.apiPeriod}`)
      .subscribe({
        next: (res: any) => {
          section.totalCount     = res.total_count    ?? 0;
          section.previousCount  = res.previous_count ?? 0;
          section.trend          = res.trend_percent  ?? 0;
          section.trendDirection = res.trend_direction ?? 'neutral';

          // Breakdown — assign severity by rank (highest count = critical)
          section.stats = (res.breakdown || []).map((item: any, i: number) => ({
            type:       item.violation_type,
            count:      item.count,
            percentage: item.percentage,
            severity:   this.SEVERITY_RANKS[i] ?? 'info',
          }));

          // Build a type → severity map for recent violations
          const typeToSeverity = new Map<string, SeverityLevel>(
            section.stats.map(s => [s.type, s.severity])
          );

          section.recentViolations = (res.recent_violations || []).map((v: any) => ({
            id:           v.id,
            type:         v.violation_type,
            cameraName:   v.camera,
            licensePlate: v.plate_number || 'N/A',
            timestamp:    v.time,
            severity:     typeToSeverity.get(v.violation_type) ?? 'info',
          }));

          section.loading = false;
        },
        error: (err) => {
          console.error(`Error loading ${section.label}:`, err);
          section.loading = false;
          section.error   = true;
          this.messageService.add({
            severity: 'error',
            summary:  'Load Failed',
            detail:   `Could not load ${section.label}`,
            life:     4000,
          });
        },
      });
  }

  // ── Export ────────────────────────────────────────────────────────────────

  exportReport(section: ReportSection): void {
    if (section.exporting) return;

    section.exporting = true;

    this.configService
      .getBlob(`api/violations/export/excel/?period=${section.apiPeriod}`)
      .subscribe({
        next: (blob: Blob) => {
          const url  = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          const date = new Date().toISOString().split('T')[0];

          link.href     = url;
          link.download = `violations_${section.apiPeriod}_${date}.xlsx`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          section.exporting = false;
          this.messageService.add({
            severity: 'success',
            summary:  'Export Ready',
            detail:   `${section.label} downloaded successfully`,
            life:     3000,
          });
        },
        error: () => {
          section.exporting = false;
          this.messageService.add({
            severity: 'error',
            summary:  'Export Failed',
            detail:   'Could not download the Excel report.',
            life:     4000,
          });
        },
      });
  }

  viewDetails(period: string): void {
    console.log('Viewing details for period:', period);
    // TODO: Navigate to detailed view
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  getSeverityTag(severity: string): 'success' | 'info' | 'warning' | 'danger' | undefined {
    const map: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
      critical: 'danger',
      warning:  'warning',
      info:     'info',
    };
    return map[severity];
  }

  getSeverityTextClass(severity: string): string {
    const map: Record<string, string> = {
      critical: 'text-red',
      warning:  'text-orange',
      info:     'text-blue',
    };
    return map[severity] || '';
  }

  getProgressClass(severity: string): string {
    const map: Record<string, string> = {
      critical: 'progress-red',
      warning:  'progress-orange',
      info:     'progress-blue',
    };
    return map[severity] || '';
  }

  getTrendTooltip(section: ReportSection): string {
    const label = section.period === 'daily'
      ? 'yesterday'
      : section.period === 'weekly'
      ? 'the previous 7 days'
      : 'last month';
    return `${section.trend}% vs ${label} (${section.previousCount} violations)`;
  }
}
