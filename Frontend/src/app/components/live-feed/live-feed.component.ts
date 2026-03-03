import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, AsyncPipe }       from '@angular/common';
import { FormsModule }                   from '@angular/forms';
import { Observable, interval, Subscription } from 'rxjs';

import { ButtonModule }    from 'primeng/button';
import { TooltipModule }   from 'primeng/tooltip';
import { BadgeModule }     from 'primeng/badge';
import { InputTextModule } from 'primeng/inputtext';

import { CameraStreamService } from '../../services/camera-stream.service';

// ── Types ──────────────────────────────────────────────────
type ViewMode = 'single' | 'grid' | 'grid-large';

interface CameraFeed {
  id:       string;
  dbId:     number;
  name:     string;
  location: string;
  fps:      number;
  isLive:   boolean;
  frame$?:  Observable<string>;   // ✅ live WebSocket stream
}

interface Violation {
  id:            string;
  type:          'Speeding' | 'Red Light' | 'Illegal Turn';
  cameraId:      string;
  cameraName:    string;
  timestamp:     string;
  licensePlate:  string;
  plateImageUrl?: string;
  confidence:    number;
  severity:      'critical' | 'warning' | 'info';
  isNew:         boolean;
}

@Component({
  selector:    'app-live-feed',
  standalone:  true,
  imports: [
    CommonModule,
    AsyncPipe,
    FormsModule,
    ButtonModule,
    TooltipModule,
    BadgeModule,
    InputTextModule,
  ],
  templateUrl: './live-feed.component.html',
  styleUrls:   ['./live-feed.component.css'],
})
export class LiveFeedComponent implements OnInit, OnDestroy {

  // ── View mode ────────────────────────────────────────────
  currentViewMode: ViewMode = 'grid';

  // ── Camera feeds ─────────────────────────────────────────
cameraFeeds: CameraFeed[] = [
  { id: 'CAM-01', dbId: 1,  name: 'CM-01', location: 'Zone 1', fps: 30, isLive: true },
  { id: 'CAM-04', dbId: 4,  name: 'CM-04', location: 'Zone 4', fps: 30, isLive: true },
  { id: 'CAM-09', dbId: 9,  name: 'CM-09', location: 'Zone 9', fps: 30, isLive: true },
  { id: 'CAM-12', dbId: 12, name: 'CM-12', location: 'Zone 12', fps: 30, isLive: true },
];


  fallbackImage = 'assets/images/no-feed.png';

  // ── Violations sidebar ───────────────────────────────────
  violations: Violation[] = [
    {
      id: 'V001', type: 'Speeding',
      cameraId: 'CAM-01', cameraName: '5th & Main',
      timestamp: '10:42:05', licensePlate: 'KLA-8921',
      plateImageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDVcvZRS5AYdIfZ02_6LEBiJOMi6WyPcNQaSJCAekVaGRGFkyqboWl5EK0BkCEtZ91kKsZmilKMCnf9pgswsNyRFkMGMYu4zDYivZnbb8-njQ-9l0aBPSBt48SP2rxl8x8lcXLrCMSpanbewqqzy_8_a5ZwzZMPzjR1zPkvJHQUoBvYjLe0z-VcCiM1qwsheTkWagYZ1ccdkeTPKacOcyD0DDE7fddA-bkb18I_0nc5SjWPPkGT1--ki351Betic0CM4OUDZ-L1yQlF',
      confidence: 98, severity: 'critical', isNew: true,
    },
    {
      id: 'V002', type: 'Red Light',
      cameraId: 'CAM-09', cameraName: 'Broadway',
      timestamp: '10:41:22', licensePlate: 'XYZ-552',
      plateImageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuASxikEwcCbQrMMSpej9q1tcegII-YdAjsPlcuGY0CaHqgRUsRz5Xc1iUcj_iRV1soVgaBSI3ccJ5P6crkzKHFK-WweEt5VRyhBi_pwJYkKEXVHB9yJq-r3xKelLsuGOcC5ghhWS8k2UGlsOWS6Ggcl3jZwQ_Drc8h4V8w0BjlZ7cRevSejjM4JwiJAVGWN7Dgxl_HthF4qpVlJLZbeAGuM_pLanIwZoiopbKOpNL9czaTt4Vqfn-szlAdkzf_CFog8ACVrYp5Ocjjb',
      confidence: 94, severity: 'warning', isNew: true,
    },
    {
      id: 'V003', type: 'Illegal Turn',
      cameraId: 'CAM-09', cameraName: 'Broadway',
      timestamp: '10:38:15', licensePlate: 'UNKNOWN',
      confidence: 75, severity: 'warning', isNew: false,
    },
    {
      id: 'V004', type: 'Speeding',
      cameraId: 'CAM-04', cameraName: 'Highway',
      timestamp: '10:35:00', licensePlate: 'ABC-1234',
      plateImageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDi-jvPwFMHmZp78DHON8krS3rH35DQrg9DLd_H934p_st70WoZCoACan_LNg9aKt_NjsHR3LJO7sVOV_kAqL1KJOt7R7s-x0YOZtFgU-zlQVZR465VQI9HIEqCMTWJVJBQUbeBM4PjIYjQUlUJ4ZdDTXWO-TM9D53x5VXYLMeJ_4keH0ChhdlNnwTHsuyPmaHC05dbwr__E0JzQReNmEG2d-e4f-nsYFWWwld5J1j99IxrEj7p2gxioCExjdYBH9gxBW8Vt7Gh8MtS',
      confidence: 99, severity: 'critical', isNew: false,
    },
  ];

  private feedSubscription?: Subscription;

  constructor(private streamService: CameraStreamService) {}

  ngOnInit(): void {
    // ✅ Connect each camera to its live WebSocket stream
    this.cameraFeeds.forEach(cam => {
      cam.frame$ = this.streamService.connectCamera(cam.dbId);
    });

    // Simulate new violations arriving (replace with real API polling later)
    this.feedSubscription = interval(5000).subscribe(() => {
      console.log('[LiveFeed] Tick — poll for new violations here');
    });
  }

  ngOnDestroy(): void {
    this.cameraFeeds.forEach(cam =>
      this.streamService.disconnectCamera(cam.dbId)
    );
    this.feedSubscription?.unsubscribe();
  }

  // ── View mode ────────────────────────────────────────────
  setViewMode(mode: ViewMode): void {
    this.currentViewMode = mode;
  }

  // ── Camera actions ───────────────────────────────────────
  takeSnapshot(camera: CameraFeed): void {
    console.log('Snapshot:', camera.id);
  }

  flagIncident(camera: CameraFeed): void {
    console.log('Flag incident:', camera.id);
  }

  showCameraMenu(camera: CameraFeed, event: Event): void {
    event.stopPropagation();
    console.log('Camera menu:', camera.id);
  }

  // ── Violation actions ─────────────────────────────────────
  verifyViolation(violation: Violation): void {
    console.log('Verify:', violation.id);
  }

  flagViolation(violation: Violation): void {
    console.log('Flag:', violation.id);
  }

  viewAllIncidents(): void {
    console.log('View all incidents');
  }

  // ── UI helpers ────────────────────────────────────────────
  get newViolationsCount(): number {
    return this.violations.filter(v => v.isNew).length;
  }

  getViolationBorderClass(severity: string): string {
    const map: Record<string, string> = {
      critical: 'border-red-500',
      warning:  'border-orange-500',
      info:     'border-yellow-500',
    };
    return map[severity] || 'border-gray-500';
  }

  getViolationTextClass(severity: string): string {
    const map: Record<string, string> = {
      critical: 'text-red-500',
      warning:  'text-orange-500',
      info:     'text-yellow-500',
    };
    return map[severity] || 'text-gray-500';
  }
}
