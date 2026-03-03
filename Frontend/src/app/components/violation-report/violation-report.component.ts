import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// PrimeNG Imports
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';

interface ViolationStat {
  type: 'Speeding' | 'Red Light' | 'Illegal Turn';
  count: number;
  percentage: number;
  severity: 'critical' | 'warning' | 'info';
}

interface ViolationEntry {
  id: string;
  type: 'Speeding' | 'Red Light' | 'Illegal Turn';
  cameraName: string;
  licensePlate: string;
  timestamp: string;
  severity: 'critical' | 'warning' | 'info';
}

interface ReportSection {
  label: string;
  period: 'daily' | 'weekly' | 'monthly';
  totalCount: number;
  trend: number;
  trendDirection: 'up' | 'down' | 'neutral';
  stats: ViolationStat[];
  recentViolations: ViolationEntry[];
}

@Component({
  selector: 'app-violation-report',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    BadgeModule,
    TooltipModule,
    TagModule,
  ],
  templateUrl: './violation-report.component.html',
  styleUrls: ['./violation-report.component.css'],
})
export class ViolationReportComponent implements OnInit {

  reportSections: ReportSection[] = [
    {
      label: 'Daily Violations',
      period: 'daily',
      totalCount: 24,
      trend: 8.3,
      trendDirection: 'up',
      stats: [
        { type: 'Speeding',      count: 12, percentage: 50, severity: 'critical' },
        { type: 'Red Light',     count: 7,  percentage: 29, severity: 'warning'  },
        { type: 'Illegal Turn',  count: 5,  percentage: 21, severity: 'info'     },
      ],
      recentViolations: [
        { id: 'D001', type: 'Speeding',     cameraName: '5th & Main',      licensePlate: 'KLA-8921', timestamp: '10:42:05', severity: 'critical' },
        { id: 'D002', type: 'Red Light',    cameraName: 'Broadway Jct',    licensePlate: 'XYZ-552',  timestamp: '10:38:22', severity: 'warning'  },
        { id: 'D003', type: 'Illegal Turn', cameraName: 'Highway Exit 4B', licensePlate: 'ABC-1234', timestamp: '09:15:10', severity: 'info'     },
      ],
    },
    {
      label: 'Weekly Violations',
      period: 'weekly',
      totalCount: 157,
      trend: 3.2,
      trendDirection: 'down',
      stats: [
        { type: 'Speeding',     count: 82, percentage: 52, severity: 'critical' },
        { type: 'Red Light',    count: 45, percentage: 29, severity: 'warning'  },
        { type: 'Illegal Turn', count: 30, percentage: 19, severity: 'info'     },
      ],
      recentViolations: [
        { id: 'W001', type: 'Speeding',     cameraName: 'Tunnel Entrance', licensePlate: 'MNP-4456', timestamp: 'Mon 14:22', severity: 'critical' },
        { id: 'W002', type: 'Red Light',    cameraName: '5th & Main',      licensePlate: 'LKJ-9900', timestamp: 'Mon 09:05', severity: 'warning'  },
        { id: 'W003', type: 'Speeding',     cameraName: 'Broadway Jct',    licensePlate: 'DEF-7823', timestamp: 'Sun 18:44', severity: 'critical' },
      ],
    },
    {
      label: 'Monthly Violations',
      period: 'monthly',
      totalCount: 643,
      trend: 12.5,
      trendDirection: 'up',
      stats: [
        { type: 'Speeding',     count: 321, percentage: 50, severity: 'critical' },
        { type: 'Red Light',    count: 196, percentage: 30, severity: 'warning'  },
        { type: 'Illegal Turn', count: 126, percentage: 20, severity: 'info'     },
      ],
      recentViolations: [
        { id: 'M001', type: 'Speeding',     cameraName: 'Highway Exit 4B', licensePlate: 'TRY-3321', timestamp: 'Feb 22', severity: 'critical' },
        { id: 'M002', type: 'Illegal Turn', cameraName: 'City Center',     licensePlate: 'GHI-6654', timestamp: 'Feb 21', severity: 'info'     },
        { id: 'M003', type: 'Red Light',    cameraName: 'Downtown',        licensePlate: 'POI-1122', timestamp: 'Feb 20', severity: 'warning'  },
      ],
    },
  ];

  ngOnInit(): void {}

  getSeverityTag(severity: string): 'success' | 'info' | 'warning' | 'danger' | undefined {
    const map: { [key: string]: 'success' | 'info' | 'warning' | 'danger' } = {
      critical: 'danger',
      warning: 'warning',
      info: 'info',
    };
    return map[severity];
  }

  getSeverityTextClass(severity: string): string {
    const map: { [key: string]: string } = {
      critical: 'text-red',
      warning: 'text-orange',
      info: 'text-blue',
    };
    return map[severity] || '';
  }

  getProgressClass(severity: string): string {
    const map: { [key: string]: string } = {
      critical: 'progress-red',
      warning:  'progress-orange',
      info:     'progress-blue',
    };
    return map[severity] || '';
  }

  exportReport(period: string): void {
    console.log('Exporting report for period:', period);
    // TODO: Implement export functionality
  }

  viewDetails(period: string): void {
    console.log('Viewing details for period:', period);
    // TODO: Navigate to detailed view
  }
}
