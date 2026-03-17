import { Component, OnInit, NgZone, ElementRef, AfterViewInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfigService } from '../../services/config.service';

// PrimeNG
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { PaginatorModule } from 'primeng/paginator';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';

// ── Interfaces ─────────────────────────────────────────────────────────────────
export interface BBox {
  x1: number; y1: number;
  x2: number; y2: number;
  width: number; height: number;
  cx: number; cy: number;
}

export interface Detection {
  label: string;
  class_id: number;
  confidence: number;
  bbox: BBox;
}

export interface Violation {
  id: number;
  frame_image: string | null;
  detections: Detection[];
  violation_type: string;
  plate_number?: string;
  time: string;
  created_at: string;
  pipeline: number;
  camera: number;
  ml_model: number;
}

export interface ViolationListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Violation[];
}

@Component({
  selector: 'app-violation-detail',
  standalone: true,
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
  providers: [MessageService],
  templateUrl: './violation-detail.component.html',
  styleUrls: ['./violation-detail.component.css'],
})
export class ViolationDetailComponent implements OnInit, AfterViewInit {

  // ── Table state ─────────────────────────────────────────────────────────────
  loading = false;
  violations: Violation[] = [];
  totalRecords = 0;
  currentPage = 1;
  rows = 5;
  first = 0;
  searchQuery = '';
  skeletonRows = Array(5);

  // ── Preview dialog ──────────────────────────────────────────────────────────
  previewVisible = false;
  previewImage = '';
  selectedViolation: Violation | null = null;

  // ── Zoom & Pan state ────────────────────────────────────────────────────────
  zoomLevel  = 1;
  readonly minZoom  = 0.5;
  readonly maxZoom  = 5;
  readonly zoomStep = 0.25;

  panX = 0;
  panY = 0;

  isDragging   = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private panStartX  = 0;
  private panStartY  = 0;

  // Reference to the image-wrap div (used for the non-passive wheel listener)
  @ViewChild('imgWrapRef') imgWrapRef!: ElementRef<HTMLDivElement>;

  constructor(
    private configService: ConfigService,
    private messageService: MessageService,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    this.loadViolations();
  }

  /**
   * Attach the wheel listener outside Angular zone with { passive: false }
   * so we can call event.preventDefault() and prevent page scroll while zooming.
   * We re-attach after each dialog open via attachWheelListener().
   */
  ngAfterViewInit(): void {
    // Initial attachment is done via attachWheelListener() called from openPreview()
  }

  attachWheelListener(): void {
    // Use a small timeout to let the dialog render the #imgWrapRef element
    setTimeout(() => {
      if (!this.imgWrapRef?.nativeElement) return;
      this.ngZone.runOutsideAngular(() => {
        this.imgWrapRef.nativeElement.addEventListener(
          'wheel',
          (e: WheelEvent) => this.ngZone.run(() => this.onWheelZoom(e)),
          { passive: false },
        );
      });
    }, 100);
  }

  // ── Data ─────────────────────────────────────────────────────────────────────
  loadViolations(): void {
    this.loading = true;
    const params = new URLSearchParams();
    params.set('page', this.currentPage.toString());
    params.set('page_size', this.rows.toString());
    if (this.searchQuery.trim()) params.set('search', this.searchQuery.trim());

    this.configService.get(`api/violations/?${params.toString()}`).subscribe({
      next: (res: ViolationListResponse) => {
        this.violations   = res.results;
        this.totalRecords = res.count;
        this.loading      = false;
      },
      error: (err) => {
        console.error('Error loading violations:', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load violations' });
        this.loading = false;
      },
    });
  }

  onSearch(): void {
    this.currentPage = 1;
    this.first = 0;
    this.loadViolations();
  }

  onPageChange(event: any): void {
    this.first       = event.first;
    this.rows        = event.rows;
    this.currentPage = Math.floor(event.first / event.rows) + 1;
    this.loadViolations();
  }

  get paginatedViolations(): Violation[] {
    return this.violations;
  }

  get withImageCount(): number {
    return this.violations.filter(v => v.frame_image !== null).length;
  }

  get withDetectionCount(): number {
    return this.violations.filter(v => v.detections.length > 0).length;
  }

  // ── Preview ───────────────────────────────────────────────────────────────
  openPreview(violation: Violation): void {
    this.selectedViolation = violation;
    this.previewImage      = violation.frame_image ?? '';
    this.previewVisible    = true;
    this.resetZoom();
    this.attachWheelListener();   // attach non-passive wheel after render
  }

  closePreview(): void {
    this.previewVisible    = false;
    this.previewImage      = '';
    this.selectedViolation = null;
    this.resetZoom();
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = 'assets/images/no-snapshot.png';
  }

  // ── Zoom ─────────────────────────────────────────────────────────────────
  zoomIn(): void {
    this.zoomLevel = parseFloat(Math.min(this.zoomLevel + this.zoomStep, this.maxZoom).toFixed(2));
  }

  zoomOut(): void {
    this.zoomLevel = parseFloat(Math.max(this.zoomLevel - this.zoomStep, this.minZoom).toFixed(2));
    if (this.zoomLevel <= 1) this.clampPan();
  }

  resetZoom(): void {
    this.zoomLevel = 1;
    this.panX      = 0;
    this.panY      = 0;
  }

  onWheelZoom(event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY < 0 ? this.zoomStep : -this.zoomStep;
    this.zoomLevel = parseFloat(
      Math.min(Math.max(this.zoomLevel + delta, this.minZoom), this.maxZoom).toFixed(2),
    );
    if (this.zoomLevel <= 1) { this.panX = 0; this.panY = 0; }
  }

  // ── Pan (drag) ───────────────────────────────────────────────────────────
  onMouseDown(event: MouseEvent): void {
    if (this.zoomLevel <= 1) return;
    this.isDragging  = true;
    this.dragStartX  = event.clientX;
    this.dragStartY  = event.clientY;
    this.panStartX   = this.panX;
    this.panStartY   = this.panY;
    event.preventDefault();
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.isDragging) return;
    this.panX = this.panStartX + (event.clientX - this.dragStartX);
    this.panY = this.panStartY + (event.clientY - this.dragStartY);
  }

  onMouseUp(): void {
    if (this.isDragging) {
      this.isDragging = false;
      this.clampPan();
    }
  }

  /**
   * Keep the image from being dragged so far it disappears from view.
   * Allows panning up to (zoom-1) * half-container-size.
   */
  private clampPan(): void {
    if (this.zoomLevel <= 1) { this.panX = 0; this.panY = 0; return; }
    const maxPanX = (this.zoomLevel - 1) * 220;   // ~half of 440px typical img width
    const maxPanY = (this.zoomLevel - 1) * 190;   // ~half of 380px max-height
    this.panX = Math.max(-maxPanX, Math.min(maxPanX, this.panX));
    this.panY = Math.max(-maxPanY, Math.min(maxPanY, this.panY));
  }

  // ── Computed transform ────────────────────────────────────────────────────
  get imageTransform(): string {
    return `translate(${this.panX}px, ${this.panY}px) scale(${this.zoomLevel})`;
  }

  get zoomPercent(): string {
    return Math.round(this.zoomLevel * 100) + '%';
  }

  // ── UI Helpers ────────────────────────────────────────────────────────────
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
    if (t.includes('vest')   || t.includes('mask')) return 'warning';
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
