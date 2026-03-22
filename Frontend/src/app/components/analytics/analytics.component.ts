import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { CalendarModule } from 'primeng/calendar';
import { TooltipModule } from 'primeng/tooltip';
import { RippleModule } from 'primeng/ripple';
import { ToastModule } from 'primeng/toast';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { ConfigService } from '../../services/config.service';
import { MessageService } from 'primeng/api';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LegendPosition } from '@swimlane/ngx-charts';
import { DialogModule } from 'primeng/dialog';
// ── Interfaces ──────────────────────────────────────────────────────────────
interface ModelOption  { id: number; name: string; }
interface CameraOption { id: number; name: string; location?: string; }
interface ChartPoint   { name: string; value: number; }
interface MultiSeries  { name: string; series: ChartPoint[]; }

@Component({
  selector: 'app-analytics-overview',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, DropdownModule, MultiSelectModule,
    CalendarModule, TooltipModule, RippleModule,
    NgxChartsModule, ToastModule ,DialogModule
  ],
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.css'],
  providers: [MessageService]
})
export class AnalyticsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // ── Date filter ────────────────────────────────────────────────────────────
  selectedMonth: Date = new Date();
  maxDate: Date = new Date();

  // ── Summary KPIs ───────────────────────────────────────────────────────────
  totalViolations   = 0;
  mostActiveLocation = '—';
  topViolationType   = '—';
  loadingSummary     = false;

  // ── Chart-type state ───────────────────────────────────────────────────────
  modelChartType:    'bar' | 'pie' | 'line' = 'bar';
  cameraChartType:   'bar' | 'pie' | 'line' = 'bar';
  locationChartType: 'bar' | 'pie'          = 'bar';

  // ── Models ─────────────────────────────────────────────────────────────────
  availableModels: ModelOption[] = [];
  selectedModelA:  ModelOption | null = null;
  selectedModelB:  ModelOption | null = null;
  modelBarData:  ChartPoint[]  = [];
  modelLineData: MultiSeries[] = [];
  loadingModels = false;

  // ── Cameras ────────────────────────────────────────────────────────────────
  availableCameras: CameraOption[] = [];
  selectedCameras:  CameraOption[] = [];
  cameraBarData:  ChartPoint[]  = [];
  cameraLineData: MultiSeries[] = [];
  loadingCameras = false;

  // ── Locations ──────────────────────────────────────────────────────────────
  locationBarData: ChartPoint[] = [];
  topN = 10;
  loadingLocations = false;

  // ── ngx-charts config ──────────────────────────────────────────────────────
  view:    [number, number] = [0, 320];
  pieView: [number, number] = [0, 360];

  legendPosition: LegendPosition = LegendPosition.Right;
  colorSchemeModel: any = { domain: ['#6366f1', '#f59e0b'] };
  colorScheme: any = {
    domain: ['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6']
  };

  // Used for the two half-width cards (Model + Camera) — row 1
cardView: [number, number] = [480, 320];

// Used for the full-width Location card — row 2
wideView: [number, number] = [900, 360];

  yAxisTickFormatting = (v: number) =>
    v % 1 !== 0 ? '' : Math.round(v).toString();

  constructor(
    private configService: ConfigService,
    private messageService: MessageService
  ) {}

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadSummaryAnalytics();
    this.loadAvailableModels();
    this.loadAvailableCameras();
    this.loadLocationAnalytics();
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  // ── Helpers ────────────────────────────────────────────────────────────────
  formatMonthYear(date: Date): string {
    return `${date.toLocaleString('default', { month: 'long' })}_${date.getFullYear()}`;
  }

  private getDaysInMonth(): number {
    const today = new Date();
    const y = this.selectedMonth.getFullYear();
    const m = this.selectedMonth.getMonth();
    const isCurrent = y === today.getFullYear() && m === today.getMonth();
    return isCurrent ? today.getDate() : new Date(y, m + 1, 0).getDate();
  }

  private buildSeries(dailyData: any[]): ChartPoint[] {
    const map = new Map<number, number>(dailyData.map((d: any) => [d.day, d.total]));
    const days = this.getDaysInMonth();
    return Array.from({ length: days }, (_, i) => ({
      name: `${i + 1}`,
      value: map.get(i + 1) ?? 0
    }));
  }

  // ── Global month change ────────────────────────────────────────────────────
  onMonthChange(): void {
    this.loadSummaryAnalytics();
    if (this.selectedModelA && this.selectedModelB) this.loadModelComparison();
    if (this.selectedCameras.length) this.loadCameraComparison();
    this.loadLocationAnalytics();
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  loadSummaryAnalytics(): void {
    this.loadingSummary = true;
    this.configService
      .get(`api/violations/analytics/?month=${this.formatMonthYear(this.selectedMonth)}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.totalViolations = res.total_violations ?? 0;
          const models: any[] = res.ml_model_wise_violations ?? [];
          if (models.length) {
            this.topViolationType =
              [...models].sort((a, b) => b.total - a.total)[0]?.ml_model__name ?? '—';
          }
          this.loadingSummary = false;
        },
        error: () => { this.loadingSummary = false; }
      });
  }

 // ── Model list — auto-select first two on load ─────────────────────────────
loadAvailableModels(): void {
  this.configService.get('api/mlmodels/')
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (res: any) => {
        this.availableModels = (res.results ?? res ?? [])
          .map((m: any) => ({ id: m.id, name: m.name }));

        // ✅ Pre-select first two models so the chart renders immediately
        if (this.availableModels.length >= 1) {
          this.selectedModelA = this.availableModels[0];
        }
        if (this.availableModels.length >= 2) {
          this.selectedModelB = this.availableModels[1];
        }

        // Fire comparison if we have at least two models
        if (this.selectedModelA && this.selectedModelB) {
          this.loadModelComparison();
        }
      },
      error: () => {}
    });
}

// ── Camera list — auto-select first two on load ────────────────────────────
loadAvailableCameras(): void {
  this.configService.get('api/cameras/all/')
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (res: any) => {
        this.availableCameras = (res.results ?? res ?? []).map((c: any) => ({
          id: c.id,
          name: c.name ?? `Camera ${c.id}`,
          location: c.location ?? ''
        }));

        // ✅ Pre-select up to the first 3 cameras so the chart renders immediately
        if (this.availableCameras.length) {
          this.selectedCameras = this.availableCameras.slice(0, Math.min(3, this.availableCameras.length));
          this.loadCameraComparison();
        }
      },
      error: () => {}
    });
}


  // ── Model comparison ───────────────────────────────────────────────────────
  onModelSelectionChange(): void {
    if (this.selectedModelA && this.selectedModelB) this.loadModelComparison();
  }

  loadModelComparison(): void {
    if (!this.selectedModelA || !this.selectedModelB) return;
    this.loadingModels = true;
    const mp = this.formatMonthYear(this.selectedMonth);

    forkJoin([
      this.configService.get(
        `api/violations/analytics/model/${this.selectedModelA.id}/?month=${mp}`),
      this.configService.get(
        `api/violations/analytics/model/${this.selectedModelB.id}/?month=${mp}`)
    ]).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ([rA, rB]: [any, any]) => {
          this.modelBarData = [
            { name: this.selectedModelA!.name, value: rA.total_violations ?? 0 },
            { name: this.selectedModelB!.name, value: rB.total_violations ?? 0 }
          ];
          this.modelLineData = [
            { name: this.selectedModelA!.name, series: this.buildSeries(rA.daily_trends ?? []) },
            { name: this.selectedModelB!.name, series: this.buildSeries(rB.daily_trends ?? []) }
          ];
          this.loadingModels = false;
        },
        error: () => {
          this.messageService.add({
            severity: 'error', summary: 'Error', detail: 'Failed to load model comparison'
          });
          this.loadingModels = false;
        }
      });
  }

  // ── Camera comparison ──────────────────────────────────────────────────────
  onCameraSelectionChange(): void {
    if (this.selectedCameras.length >= 1) this.loadCameraComparison();
  }

  loadCameraComparison(): void {
    if (!this.selectedCameras.length) return;
    this.loadingCameras = true;
    const mp  = this.formatMonthYear(this.selectedMonth);
    const ids = this.selectedCameras.map(c => c.id).join(',');

    this.configService
      .get(`api/violations/analytics/camera-wise/?cameras=${ids}&month=${mp}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          const cams: any[] = res.cameras ?? res ?? [];
          this.cameraBarData = cams.map(c => ({
            name:  c.camera_name ?? `Camera ${c.camera_id}`,
            value: c.total_violations ?? 0
          }));
          this.cameraLineData = cams.map(c => ({
            name:   c.camera_name ?? `Camera ${c.camera_id}`,
            series: this.buildSeries(c.daily_trends ?? [])
          }));
          this.loadingCameras = false;
        },
        error: () => {
          this.messageService.add({
            severity: 'error', summary: 'Error', detail: 'Failed to load camera comparison'
          });
          this.loadingCameras = false;
        }
      });
  }

  // ── Location analytics ─────────────────────────────────────────────────────
  loadLocationAnalytics(): void {
    this.loadingLocations = true;
    const mp = this.formatMonthYear(this.selectedMonth);

    this.configService
      .get(`api/violations/analytics/location-wise/?month=${mp}&top=${this.topN}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          const locs: any[] = res.locations ?? res ?? [];
          this.locationBarData = locs.map(l => ({
            name: l.location ?? 'Unknown',
            value: l.total_violations ?? 0
          }));
          this.mostActiveLocation = this.locationBarData[0]?.name ?? '—';
          this.loadingLocations = false;
        },
        error: () => { this.loadingLocations = false; }
      });
  }

  // ── Y-scale helpers ────────────────────────────────────────────────────────
  yMax(data: ChartPoint[]): number {
    if (!data.length) return 5;
    return Math.max(...data.map(d => d.value)) + 1;
  }

  yMaxMulti(data: MultiSeries[]): number {
    if (!data.length) return 5;
    const all = data.flatMap(s => s.series.map(p => p.value));
    return all.length ? Math.max(...all) + 1 : 5;
  }
  showDownloadDialog  = false;
isDownloading       = false;
downloadSection:    'model' | 'camera' | 'location' = 'model';
downloadChartType:  'bar' | 'pie' | 'line'          = 'bar';
downloadPreviewView: [number, number]                = [580, 300];

// Computed data routed to the preview chart
get downloadBarData(): ChartPoint[] {
  if (this.downloadSection === 'model')    return this.modelBarData;
  if (this.downloadSection === 'camera')   return this.cameraBarData;
  return this.locationBarData;
}

get downloadLineData(): MultiSeries[] {
  if (this.downloadSection === 'model')  return this.modelLineData;
  if (this.downloadSection === 'camera') return this.cameraLineData;
  return [];
}

get downloadColorScheme(): any {
  return this.downloadSection === 'model' ? this.colorSchemeModel : this.colorScheme;
}

get downloadYMax(): number { return this.yMax(this.downloadBarData); }
get downloadYMaxMulti(): number { return this.yMaxMulti(this.downloadLineData); }

get availableChartTypes(): Array<{ label: string; value: string; icon: string }> {
  const types = [
    { label: 'Bar',  value: 'bar',  icon: 'pi pi-chart-bar'  },
    { label: 'Pie',  value: 'pie',  icon: 'pi pi-chart-pie'  },
  ];
  if (this.downloadSection !== 'location') {
    types.push({ label: 'Line', value: 'line', icon: 'pi pi-chart-line' });
  }
  return types;
}

get downloadSectionLabel(): string {
  if (this.downloadSection === 'model')    return 'Model Comparison';
  if (this.downloadSection === 'camera')   return 'Camera Comparison';
  return 'Location Hotspots';
}

openDownloadDialog(): void {
  this.downloadSection   = 'model';
  this.downloadChartType = 'bar';
  this.showDownloadDialog = true;
}

onDownloadSectionChange(section: 'model' | 'camera' | 'location'): void {
  this.downloadSection = section;
  if (section === 'location' && this.downloadChartType === 'line') {
    this.downloadChartType = 'bar';
  }
}

setDownloadChartType(value: string): void {
  this.downloadChartType = value as 'bar' | 'pie' | 'line';
}

downloadPng(): void {
  this.isDownloading = true;

  // Small delay lets the chart render after type switch
  setTimeout(() => {
    const box = document.querySelector('.dl-preview-box') as HTMLElement;
    if (!box) { this.isDownloading = false; return; }

    const svgEl = box.querySelector('svg');
    if (!svgEl) { this.isDownloading = false; return; }

    // Clone and add a white background rect for clean export
    const clone = svgEl.cloneNode(true) as SVGElement;
    const bg    = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width',  '100%');
    bg.setAttribute('height', '100%');
    bg.setAttribute('fill',   '#ffffff');
    clone.insertBefore(bg, clone.firstChild);

    const svgStr  = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url     = URL.createObjectURL(svgBlob);

    const img     = new Image();
    img.onload    = () => {
      const w = svgEl.clientWidth  || 580;
      const h = svgEl.clientHeight || 300;

      const canvas  = document.createElement('canvas');
      canvas.width  = w * 2;   // 2× for retina sharpness
      canvas.height = h * 2;
      const ctx     = canvas.getContext('2d')!;
      ctx.scale(2, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);

      const link      = document.createElement('a');
      link.download   = `violations_${this.downloadSection}_${this.formatMonthYear(this.selectedMonth)}.png`;
      link.href       = canvas.toDataURL('image/png');
      link.click();
      this.isDownloading = false;
    };
    img.onerror = () => { this.isDownloading = false; };
    img.src = url;
  }, 300);
}
}
