import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';


export const routes: Routes = [
  // Public route - only accessible when NOT logged in
  { 
    path: 'login', 
    component: LoginComponent,
   // Prevent access if already logged in
    pathMatch: 'full' 
  },
  
  // Protected dashboard route
  {
    path: 'dashboard',
    component: SidebarComponent,
    children: [
      {
        path: 'live-feed',
        loadComponent: () => import('./components/live-feed/live-feed.component').then(m => m.LiveFeedComponent),
        title: 'Live Feed'
      },
      {
        path: 'camera-management',
        loadComponent: () => import('./components/camera-management/camera-management.component').then(m => m.CameraManagementComponent),
        title: 'Camera Management'
      },
      {
        path: 'pipeline-management',
        loadComponent: () => import('./components/pipeline-management/pipeline-management.component').then(m => m.PipelineManagementComponent),
        title: 'Pipeline Management'
      },
      {
        path: 'video-uploads',
        loadComponent: () => import('./components/video-uploads/video-uploads.component').then(m => m.VideoUploadsComponent),
        title: 'Video Uploads'
      },
      {
        path: 'overview',
        loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent),
        title: 'Dashboard'
      },
      {
        path:'violation-report',
        loadComponent: () => import('./components/violation-report/violation-report.component').then(m => m.ViolationReportComponent),
        title: 'Violation Report'
      },
      {
        path: 'violation-detail',
        loadComponent: () => import('./components/violation-detail/violation-detail.component').then(m => m.ViolationDetailComponent),
        title: 'Violation Detail'
      },
      {
        path: 'analytics',
        loadComponent: () => import('./components/analytics/analytics.component').then(m => m.AnalyticsComponent),
        title: 'Analytics'
      },
      // Default child route
      { path: '', redirectTo: 'overview', pathMatch: 'full' }
    ]
  },

  // Default redirects
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: '/dashboard' } // Wildcard for 404
];
