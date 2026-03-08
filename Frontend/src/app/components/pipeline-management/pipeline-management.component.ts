import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfigService } from '../../services/config.service';

// PrimeNG Imports
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { BadgeModule } from 'primeng/badge';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { PaginatorModule } from 'primeng/paginator';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DropdownModule } from 'primeng/dropdown';
import { MessageService, ConfirmationService } from 'primeng/api';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
export interface Pipeline {
  id: number;
  camera: number;
  camera_name: string;
  ml_model: number;
  model_name: string;
  is_active: boolean;           // ✅ replaced status string
  queue_name: string;
  created_at: string;
}

export interface PipelineCreatePayload {
  camera: number | null;
  ml_model: number | null;
}

interface PipelineMetrics {
  total: number;
  active: number;
  inactive: number;
}

interface DropdownOption {
  label: string;
  value: number;
}

@Component({
  selector: 'app-pipeline-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    BadgeModule,
    TagModule,
    TooltipModule,
    PaginatorModule,
    DialogModule,
    ToastModule,
    ConfirmDialogModule,
    DropdownModule,
    IconFieldModule,
    InputIconModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './pipeline-management.component.html',
  styleUrls: ['./pipeline-management.component.css'],
  // encapsulation: ViewEncapsulation.None
})
export class PipelineManagementComponent implements OnInit {
  loading = false;
  showDialog = false;

  searchQuery = '';
  first = 0;
  rows = 5;
  totalRecords = 0;

  allPipelines: Pipeline[] = [];
  pipelines: Pipeline[] = [];

  metrics: PipelineMetrics = { total: 0, active: 0, inactive: 0 };

  cameraOptions: DropdownOption[] = [];
  modelOptions: DropdownOption[] = [];

  currentPipeline: PipelineCreatePayload = { camera: null, ml_model: null };

  constructor(
    private configService: ConfigService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.loadPipelines();
    this.loadDropdownOptions();
  }

  // ─── Data Loading ─────────────────────────────────────────────────────────

  loadPipelines(): void {
    this.loading = true;
    this.configService.get('api/pipelines/').subscribe({
      next: (response: any) => {
        this.allPipelines = Array.isArray(response)
          ? response
          : (response.results ?? []);
        this.updateMetrics();
        this.applyFilters();
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading pipelines:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load pipelines',
        });
        this.loading = false;
      },
    });
  }

  loadDropdownOptions(): void {
    this.configService.get('api/cameras/active/').subscribe({
      next: (response: any) => {
        const items: any[] = Array.isArray(response) ? response : (response.results ?? []);
        this.cameraOptions = items.map((c) => ({ label: c.name, value: c.id }));
      },
      error: () => {},
    });

    this.configService.get('api/mlmodels/').subscribe({
      next: (response: any) => {
        const items: any[] = Array.isArray(response) ? response : (response.results ?? []);
        this.modelOptions = items.map((m) => ({ label: m.name, value: m.id }));
      },
      error: () => {},
    });
  }

  // ─── Client-side Search + Pagination ──────────────────────────────────────

  applyFilters(): void {
    const q = this.searchQuery.trim().toLowerCase();

    const filtered = q
      ? this.allPipelines.filter(
          (p) =>
            p.camera_name.toLowerCase().includes(q) ||
            p.model_name.toLowerCase().includes(q) ||
            p.queue_name.toLowerCase().includes(q) ||
            this.getStatusLabel(p.is_active).toLowerCase().includes(q)  // ✅
        )
      : [...this.allPipelines];

    this.totalRecords = filtered.length;
    this.pipelines = filtered.slice(this.first, this.first + this.rows);
  }

  onSearch(): void {
    this.first = 0;
    this.applyFilters();
  }

  onPageChange(event: any): void {
    this.first = event.first;
    this.rows = event.rows;
    this.applyFilters();
  }

  // ─── Dialog ───────────────────────────────────────────────────────────────

  addNewPipeline(): void {
    this.currentPipeline = { camera: null, ml_model: null };
    this.showDialog = true;
  }

  onDialogVisibleChange(visible: boolean): void {
    this.showDialog = visible;
    if (!visible) this.closeDialog();
  }

  closeDialog(): void {
    this.showDialog = false;
    this.currentPipeline = { camera: null, ml_model: null };
  }

  savePipeline(): void {
    if (!this.isFormValid()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation Error',
        detail: 'Please select both a camera and an ML model',
      });
      return;
    }

    this.loading = true;
    this.configService.post('api/pipelines/', this.currentPipeline).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Created',
          detail: 'Pipeline created successfully',
        });
        this.closeDialog();
        this.loadPipelines();
      },
      error: (error: any) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.detail || 'Failed to create pipeline',
        });
        this.loading = false;
      },
      complete: () => (this.loading = false),
    });
  }

  // ─── Pipeline Actions ─────────────────────────────────────────────────────

  startPipeline(pipeline: Pipeline): void {
    this.confirmationService.confirm({
      message: `Start pipeline for camera "${pipeline.camera_name}" using model "${pipeline.model_name}"?`,
      header: 'Confirm Start',
      icon: 'pi pi-play',
      acceptLabel: 'Start',
      rejectLabel: 'Cancel',
      accept: () => {
        this.loading = true;
        this.configService.post(`api/pipelines/${pipeline.id}/start/`, {}).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Started',
              detail: 'Pipeline started successfully',
            });
            this.loadPipelines();
          },
          error: (error: any) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: error.error?.detail || 'Failed to start pipeline',
            });
            this.loading = false;
          },
          complete: () => (this.loading = false),
        });
      },
    });
  }

  stopPipeline(pipeline: Pipeline): void {
    this.confirmationService.confirm({
      message: `Stop pipeline for camera "${pipeline.camera_name}"?`,
      header: 'Confirm Stop',
      icon: 'pi pi-stop',
      acceptLabel: 'Stop',
      rejectLabel: 'Cancel',
      accept: () => {
        this.loading = true;
        this.configService.post(`api/pipelines/${pipeline.id}/stop/`, {}).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Stopped',
              detail: 'Pipeline stopped successfully',
            });
            this.loadPipelines();
          },
          error: (error: any) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: error.error?.detail || 'Failed to stop pipeline',
            });
            this.loading = false;
          },
          complete: () => (this.loading = false),
        });
      },
    });
  }

  deletePipeline(pipeline: Pipeline): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete the pipeline for camera "${pipeline.camera_name}"? This action cannot be undone.`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => {
        this.loading = true;
        this.configService.delete(`api/pipelines/${pipeline.id}/`).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Deleted',
              detail: 'Pipeline deleted successfully',
            });
            this.loadPipelines();
          },
          error: () => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to delete pipeline',
            });
            this.loading = false;
          },
          complete: () => (this.loading = false),
        });
      },
    });
  }

  // ─── UI Helpers ───────────────────────────────────────────────────────────

  openNotifications(): void { console.log('Open notifications'); }
  openSupport(): void { console.log('Open support'); }

  isFormValid(): boolean {
    return !!(this.currentPipeline.camera && this.currentPipeline.ml_model);
  }

  canStart(pipeline: Pipeline): boolean {
    return !pipeline.is_active;           // ✅ simply not active
  }

  canStop(pipeline: Pipeline): boolean {
    return pipeline.is_active;            // ✅ simply active
  }

  getStatusSeverity(isActive: boolean): 'success' | 'danger' {
    return isActive ? 'success' : 'danger';   // ✅ two states only
  }

  getStatusLabel(isActive: boolean): string {
    return isActive ? 'Active' : 'Inactive';  // ✅ two states only
  }

  getRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    return diff === 0 ? 'Today' : `${diff}d ago`;
  }

  get paginatedPipelines(): Pipeline[] {
    return this.pipelines;
  }

  private updateMetrics(): void {
    const active = this.allPipelines.filter((p) => p.is_active).length;   // ✅
    this.metrics = {
      total:    this.allPipelines.length,
      active:   active,
      inactive: this.allPipelines.length - active,
    };
  }
}
