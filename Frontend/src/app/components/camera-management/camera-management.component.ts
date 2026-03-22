import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfigService } from '../../services/config.service';
import {
  Camera,
  CameraListResponse,
  CameraCreatePayload,
  CameraDetailResponse

} from '../../helpers/model/models';

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
import { MessageService } from 'primeng/api';
import { ConfirmationService } from 'primeng/api';

interface Metrics {
  total_cameras: number;
  active_cameras: number;
  inactive_cameras: number;
  uptimePercentage: number;
}

@Component({
  selector: 'app-camera-management',
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
    ConfirmDialogModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './camera-management.component.html',
  styleUrls: ['./camera-management.component.css']
})
export class CameraManagementComponent implements OnInit {
  // Loading states
  loading = false;
  showDialog = false;

  // Search and pagination
  searchQuery = '';
  first = 0;
  rows = 5;
  totalRecords = 0;
  currentPage = 1;

  // Data
  cameras: Camera[] = [];
  metrics: Metrics = { total_cameras: 0, active_cameras: 0, inactive_cameras: 0, uptimePercentage: 0 };

  // Modal state
  editingCamera: Camera | null = null;
  currentCamera: CameraCreatePayload = {
    name: '',
    rtsp_url: '',
    location: '',
    status: 'active'
  };

  constructor(
    private configService: ConfigService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) { }

  ngOnInit(): void {
  this.activeAndInactiveCameras(); 
  this.loadCameras();
}

total_cameras: number = 0;
active_cameras: number = 0;
inactive_cameras: number = 0
activeAndInactiveCameras(): void {
  this.loading = true;
  this.configService.get('api/cameras/status/').subscribe({
    next: (response: CameraDetailResponse) => {
      this.total_cameras   = response.total_cameras;
      this.active_cameras  = response.active_cameras;
      this.inactive_cameras = response.inactive_cameras;
      this.updateMetrics(); 
      this.loading = false;
    },
    error: (error) => {
      console.error('Error loading camera status:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load camera status'
      });
      this.loading = false;
    }
  });
}

loadCameras(): void {
  this.loading = true;

  const params = new URLSearchParams();
  params.set('page', this.currentPage.toString());
  params.set('page_size', this.rows.toString());

  if (this.searchQuery.trim()) {
    params.set('search', this.searchQuery.trim());
  }

  this.configService.get(`api/cameras/?${params.toString()}`).subscribe({
    next: (response: CameraListResponse) => {
      this.cameras      = response.results;
      this.totalRecords = response.count;
     
      this.loading = false;
    },
    error: (error) => {
      console.error('Error loading cameras:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load cameras'
      });
      this.loading = false;
    }
  });
}


  onSearch(): void {
    this.currentPage = 1;
    this.first = 0;
    this.loadCameras();
  }

  onPageChange(event: any): void {
    this.first = event.first;
    this.rows = event.rows;
    this.currentPage = Math.floor(event.first / this.rows) + 1;
    this.loadCameras();
  }

  addNewCamera(): void {
    this.editingCamera = null;
    this.currentCamera = {
      name: '',
      rtsp_url: '',
      location: '',
      status: 'active'
    };
    this.showDialog = true;
  }

  editCamera(camera: Camera): void {
    this.editingCamera = camera;

    this.currentCamera = {
      name: camera.name || '',
      rtsp_url: camera.rtsp_url || '',
      location: camera.location || '',
      status: camera.status || 'active'
    };

    this.showDialog = true;
  }

  onDialogVisibleChange(visible: boolean): void {
    this.showDialog = visible;
    if (!visible) {
      this.closeDialog();
    }
  }

  closeDialog(): void {
    this.showDialog = false;
    this.editingCamera = null;
    this.currentCamera = { name: '', rtsp_url: '', location: '' };
  }

  saveCamera(): void {
    if (!this.isFormValid()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation Error',
        detail: 'Please fill all required fields'
      });
      return;
    }

    this.loading = true;

    if (this.editingCamera) {
      // Update existing
      this.configService.patch(`api/cameras/${this.editingCamera.id}/`, this.currentCamera).subscribe({
        next: (updated: Camera) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Updated',
            detail: `Camera "${updated.name}" updated successfully`
          });
          this.closeDialog();
          this.loadCameras();
          this.activeAndInactiveCameras(); 
        },
        error: (error) => {
          console.error('Update error:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to update camera'
          });
        },
        complete: () => this.loading = false
      });
    } else {
      // Create new
      this.configService.post('api/cameras/', this.currentCamera).subscribe({
        next: (camera: Camera) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Created',
            detail: `Camera "${camera.name}" created successfully`
          });
          this.closeDialog();
          this.loadCameras();
        },
        error: (error) => {
          console.error('Create error:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'Failed to create camera'
          });
        },
        complete: () => this.loading = false
      });
    }
  }

  toggleCameraStatus(camera: Camera): void {
    const newStatus = camera.status === 'active' ? 'inactive' : 'active';
    const action = camera.status === 'active' ? 'pause' : 'activate';

    this.confirmationService.confirm({
      message: `Are you sure you want to ${action} camera "${camera.name}"?`,
      header: `Confirm ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: `${action.charAt(0).toUpperCase() + action.slice(1)}`,
      rejectLabel: 'Cancel',
      accept: () => {
        this.loading = true;
        const payload = { status: newStatus };

        this.configService.patch(`api/cameras/${camera.id}/`, payload).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: `Camera "${camera.name}" ${action}d successfully`
            });
            this.loadCameras();
            this.activeAndInactiveCameras(); 
          },
          error: (error) => {
            console.error('Toggle error:', error);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: `Failed to ${action} camera`
            });
          },
          complete: () => this.loading = false
        });
      }
    });
  }

  deleteCamera(camera: Camera): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete camera "${camera.name}"? This action cannot be undone.`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => {
        this.loading = true;
        this.configService.delete(`api/cameras/${camera.id}/`).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Deleted',
              detail: `Camera "${camera.name}" deleted successfully`
            });
            this.loadCameras();
            this.activeAndInactiveCameras();
          },
          error: (error) => {
            console.error('Delete error:', error);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to delete camera'
            });
          },
          complete: () => this.loading = false
        });
      }
    });
  }

  // UI Helpers
  openNotifications(): void {
    console.log('Open notifications');
  }

  openSupport(): void {
    console.log('Open support');
  }

  viewFeed(camera: Camera): void {
    console.log('View feed:', camera);
  }

  copyRtsp(rtsp: string): void {
    navigator.clipboard.writeText(rtsp).then(() => {
      this.messageService.add({
        severity: 'info',
        summary: 'Copied',
        detail: 'RTSP URL copied to clipboard'
      });
    });
  }

  getRtspPreview(rtsp: string): string {
    return rtsp.length > 40 ? rtsp.substring(0, 40) + '...' : rtsp;
  }

  getRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    return diff === 0 ? 'Today' : `${diff}d ago`;
  }

  getRowClass(status: Camera['status']): string {
    const classes: Record<string, string> = {
      active: 'row-active',
      inactive: 'row-inactive',


    };
    return classes[status] || '';
  }

  isFormValid(): boolean {
    return !!(
      this.currentCamera.name?.trim() &&
      this.currentCamera.rtsp_url?.trim() &&
      this.currentCamera.location?.trim()
    );
  }

  getStatusSeverity(status: Camera['status']): 'success' | 'danger' | 'warning' {
    const severityMap: Record<Camera['status'], 'success' | 'danger' | 'warning'> = {
      active: 'success',
      inactive: 'danger',
      maintenance: 'warning'
    };
    return severityMap[status] || 'info';
  }

  getStatusLabel(status: Camera['status']): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  get paginatedCameras(): Camera[] {
    return this.cameras;
  }

private updateMetrics(): void {
  this.metrics = {
    total_cameras:    this.total_cameras,    
    active_cameras:   this.active_cameras,   
    inactive_cameras: this.inactive_cameras, 
    uptimePercentage: 97.3
  };
}

}
