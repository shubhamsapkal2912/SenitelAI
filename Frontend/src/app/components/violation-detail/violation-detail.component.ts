import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfigService } from '../../services/config.service';

// PrimeNG
import { TableModule }     from 'primeng/table';
import { ButtonModule }    from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule }       from 'primeng/tag';
import { TooltipModule }   from 'primeng/tooltip';
import { PaginatorModule } from 'primeng/paginator';
import { DialogModule }    from 'primeng/dialog';
import { ToastModule }     from 'primeng/toast';
import { SkeletonModule }  from 'primeng/skeleton';
import { MessageService }  from 'primeng/api';

// ── Interfaces ────────────────────────────────────────────
export interface BBox {
  x1: number; y1: number;
  x2: number; y2: number;
  width: number; height: number;
  cx: number;   cy: number;
}

export interface Detection {
  label:      string;
  class_id:   number;
  confidence: number;
  bbox:       BBox;
}

export interface Violation {
  id:             number;
  frame_image:    string | null;
  detections:     Detection[];
  violation_type: string;
  time:           string;
  created_at:     string;
  pipeline:       number;
  camera:         number;
  ml_model:       number;
}

export interface ViolationListResponse {
  count:    number;
  next:     string | null;
  previous: string | null;
  results:  Violation[];
}

@Component({
  selector:    'app-violation-detail',
  standalone:  true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    TagModule,
    TooltipModule,
    PaginatorModule,
    DialogModule,
    ToastModule,
    SkeletonModule,
  ],
  providers:    [MessageService],
  templateUrl: './violation-detail.component.html',
  styleUrls:   ['./violation-detail.component.css'],
})
export class ViolationDetailComponent implements OnInit {

  loading      = false;
  violations:  Violation[] = [];
  totalRecords = 0;
  currentPage  = 1;
  rows         = 5;           // ✅ matches Django default page_size
  first        = 0;
  searchQuery  = '';

  // ── Preview dialog ──────────────────────────────────
  previewVisible     = false;
  previewImage       = '';
  selectedViolation: Violation | null = null;

  skeletonRows = Array(5);

  constructor(
    private configService: ConfigService,
    private messageService: MessageService,
  ) {}

  ngOnInit(): void {
    this.loadViolations();
  }

  // ── Data ─────────────────────────────────────────────
  loadViolations(): void {
    this.loading = true;

    const params = new URLSearchParams();
    params.set('page',      this.currentPage.toString());
    params.set('page_size', this.rows.toString());         // ✅ server-side page size
    if (this.searchQuery.trim()) {
      params.set('search', this.searchQuery.trim());
    }

    this.configService.get(`api/violations/?${params.toString()}`).subscribe({
      next: (res: ViolationListResponse) => {
        this.violations   = res.results;                   // ✅ paginated results
        this.totalRecords = res.count;                     // ✅ total from server
        this.loading      = false;
      },
      error: (err) => {
        console.error('Error loading violations:', err);
        this.messageService.add({
          severity: 'error',
          summary:  'Error',
          detail:   'Failed to load violations',
        });
        this.loading = false;
      },
    });
  }

  onSearch(): void {
    this.currentPage = 1;
    this.first       = 0;
    this.loadViolations();
  }

  onPageChange(event: any): void {
    this.first       = event.first;
    this.rows        = event.rows;
    this.currentPage = Math.floor(event.first / event.rows) + 1;
    this.loadViolations();                                 // ✅ re-fetches from server
  }

  // No client-side slice needed — server returns exactly one page
  get paginatedViolations(): Violation[] {
    return this.violations;
  }

  // ── Stats ─────────────────────────────────────────────
  // These reflect current page only — move to analytics API for global counts
  get withImageCount(): number {
    return this.violations.filter(v => v.frame_image !== null).length;
  }

  get withDetectionCount(): number {
    return this.violations.filter(v => v.detections.length > 0).length;
  }

  // ── Preview ───────────────────────────────────────────
  openPreview(violation: Violation): void {
    this.selectedViolation = violation;
    this.previewImage      = violation.frame_image ?? '';
    this.previewVisible    = true;
  }

  closePreview(): void {
    this.previewVisible    = false;
    this.previewImage      = '';
    this.selectedViolation = null;
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = 'assets/images/no-snapshot.png';
  }

  // ── UI Helpers ────────────────────────────────────────
  getTopLabels(detections: Detection[]): Detection[] {
    return detections.slice(0, 3);
  }

  getConfidenceSeverity(conf: number): 'success' | 'warning' | 'danger' {
    if (conf >= 0.8) return 'success';
    if (conf >= 0.5) return 'warning';
    return 'danger';
  }

  getViolationSeverity(type: string): 'danger' | 'warning' | 'info' {
    const t = type.toLowerCase();
    if (t.includes('helmet') || t.includes('fire')) return 'danger';
    if (t.includes('vest')   || t.includes('mask'))  return 'warning';
    return 'info';
  }

  formatConfidence(conf: number): string {
    return (conf * 100).toFixed(1) + '%';
  }

  getRelativeTime(dateStr: string): string {
    const diffMs    = Date.now() - new Date(dateStr).getTime();
    const diffMins  = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMs / 3_600_000);
    const diffDays  = Math.floor(diffMs / 86_400_000);
    if (diffMins  < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }
}
