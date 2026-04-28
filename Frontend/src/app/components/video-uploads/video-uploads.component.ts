import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { PaginatorModule } from 'primeng/paginator';
import { ProgressBarModule } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

import {
  Camera,
  MLModel,
  VideoUpload,
  VideoUploadListResponse,
} from '../../helpers/model/models';
import { ConfigService } from '../../services/config.service';

interface UploadViolation {
  id: number;
  violation_type: string;
  plate_number?: string | null;
  time: string;
  frame_image: string | null;
  camera: number;
  camera_name?: string;
  pipeline: number | null;
  source_type: string;
}

interface UploadViolationResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: UploadViolation[];
}

interface DropdownOption {
  label: string;
  value: number;
}

interface UploadForm {
  camera: number | null;
  ml_model: number | null;
}

@Component({
  selector: 'app-video-uploads',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    DropdownModule,
    InputTextModule,
    ToastModule,
    TagModule,
    TooltipModule,
    PaginatorModule,
    ProgressBarModule,
    IconFieldModule,
    InputIconModule,
  ],
  providers: [MessageService],
  templateUrl: './video-uploads.component.html',
  styleUrls: ['./video-uploads.component.css'],
})
export class VideoUploadsComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  loading = false;
  uploading = false;
  showUploadDialog = false;
  showResultsDialog = false;

  searchQuery = '';
  uploads: VideoUpload[] = [];
  totalRecords = 0;
  first = 0;
  rows = 5;
  currentPage = 1;

  cameras: DropdownOption[] = [];
  mlModels: DropdownOption[] = [];

  selectedFile: File | null = null;
  uploadForm: UploadForm = {
    camera: null,
    ml_model: null,
  };

  selectedUpload: VideoUpload | null = null;
  uploadViolations: UploadViolation[] = [];
  uploadViolationsCount = 0;
  violationsFirst = 0;
  violationsRows = 5;
  violationsPage = 1;

  private pollTimer: number | null = null;

  constructor(
    private configService: ConfigService,
    private messageService: MessageService,
  ) {}

  ngOnInit(): void {
    this.loadDropdowns();
    this.loadUploads();
    this.startPolling();
  }

  ngOnDestroy(): void {
    if (this.pollTimer) {
      window.clearInterval(this.pollTimer);
    }
  }

  loadDropdowns(): void {
    this.configService.get('api/cameras/all/').subscribe({
      next: (response: Camera[] | { results?: Camera[] }) => {
        const items = Array.isArray(response) ? response : (response.results ?? []);
        this.cameras = items.map((camera) => ({
          label: `${camera.name} · ${camera.location}`,
          value: camera.id,
        }));
      },
    });

    this.configService.get('api/mlmodels/').subscribe({
      next: (response: MLModel[] | { results?: MLModel[] }) => {
        const items = Array.isArray(response) ? response : (response.results ?? []);
        this.mlModels = items.map((model) => ({
          label: model.name,
          value: model.id,
        }));
      },
    });
  }

  loadUploads(): void {
    this.loading = true;
    const params = new URLSearchParams();
    params.set('page', this.currentPage.toString());
    params.set('page_size', this.rows.toString());
    if (this.searchQuery.trim()) {
      params.set('search', this.searchQuery.trim());
    }

    this.configService.get(`api/video-uploads/?${params.toString()}`).subscribe({
      next: (response: VideoUploadListResponse) => {
        this.uploads = response.results;
        this.totalRecords = response.count;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading uploads:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load video uploads',
        });
        this.loading = false;
      },
    });
  }

  onSearch(): void {
    this.currentPage = 1;
    this.first = 0;
    this.loadUploads();
  }

  onPageChange(event: any): void {
    this.first = event.first;
    this.rows = event.rows;
    this.currentPage = Math.floor(event.first / event.rows) + 1;
    this.loadUploads();
  }

  onViolationPageChange(event: any): void {
    this.violationsFirst = event.first;
    this.violationsRows = event.rows;
    this.violationsPage = Math.floor(event.first / event.rows) + 1;
    if (this.selectedUpload) {
      this.loadViolations(this.selectedUpload.id);
    }
  }

  openUploadDialog(): void {
    this.resetForm();
    this.showUploadDialog = true;
  }

  closeUploadDialog(): void {
    this.showUploadDialog = false;
    this.resetForm();
  }

  chooseFile(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
  }

  submitUpload(): void {
    if (!this.selectedFile || !this.uploadForm.camera || !this.uploadForm.ml_model) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation',
        detail: 'Choose a video file, a camera, and an ML model.',
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', this.selectedFile);
    formData.append('camera', String(this.uploadForm.camera));
    formData.append('ml_model', String(this.uploadForm.ml_model));

    this.uploading = true;
    this.configService.post('api/video-uploads/', formData).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Queued',
          detail: 'Video uploaded and queued for processing.',
        });
        this.closeUploadDialog();
        this.loadUploads();
      },
      error: (error) => {
        console.error('Upload error:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Upload Failed',
          detail: error.error?.detail || 'Failed to upload the video.',
        });
      },
      complete: () => {
        this.uploading = false;
      },
    });
  }

  retryUpload(upload: VideoUpload): void {
    this.configService.post(`api/video-uploads/${upload.id}/retry/`, {}).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Retry Started',
          detail: `${upload.original_name} has been queued again.`,
        });
        this.loadUploads();
      },
      error: (error) => {
        console.error('Retry error:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Retry Failed',
          detail: error.error?.detail || 'Failed to retry this upload.',
        });
      },
    });
  }

  openResults(upload: VideoUpload): void {
    this.selectedUpload = upload;
    this.violationsPage = 1;
    this.violationsFirst = 0;
    this.showResultsDialog = true;
    this.loadViolations(upload.id);
  }

  closeResultsDialog(): void {
    this.showResultsDialog = false;
    this.selectedUpload = null;
    this.uploadViolations = [];
    this.uploadViolationsCount = 0;
  }

  loadViolations(uploadId: number): void {
    const params = new URLSearchParams();
    params.set('page', this.violationsPage.toString());
    params.set('page_size', this.violationsRows.toString());

    this.configService.get(`api/video-uploads/${uploadId}/violations/?${params.toString()}`).subscribe({
      next: (response: UploadViolationResponse) => {
        this.uploadViolations = response.results;
        this.uploadViolationsCount = response.count;
      },
      error: (error) => {
        console.error('Violation results error:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load upload results.',
        });
      },
    });
  }

  get totalUploads(): number {
    return this.totalRecords;
  }

  get processingUploads(): number {
    return this.uploads.filter((upload) => ['queued', 'processing'].includes(upload.status)).length;
  }

  get completedUploads(): number {
    return this.uploads.filter((upload) => upload.status === 'completed').length;
  }

  get totalViolationsFound(): number {
    return this.uploads.reduce((sum, upload) => sum + upload.violations_count, 0);
  }

  getStatusSeverity(status: VideoUpload['status']): 'info' | 'success' | 'warning' | 'danger' {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'danger';
      case 'processing':
        return 'warning';
      default:
        return 'info';
    }
  }

  getStatusLabel(status: VideoUpload['status']): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  getProgressValue(upload: VideoUpload): number {
    return Number(upload.progress_percent ?? 0);
  }

  canRetry(upload: VideoUpload): boolean {
    return upload.status === 'failed';
  }

  canViewResults(upload: VideoUpload): boolean {
    return upload.status === 'completed';
  }

  startPolling(): void {
    this.pollTimer = window.setInterval(() => {
      if (this.uploads.some((upload) => ['queued', 'processing'].includes(upload.status))) {
        this.loadUploads();
      }
    }, 5000);
  }

  private resetForm(): void {
    this.uploadForm = {
      camera: null,
      ml_model: null,
    };
    this.selectedFile = null;
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }
}
