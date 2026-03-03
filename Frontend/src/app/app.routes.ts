import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';


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
    component: DashboardComponent,
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
        path: 'overview',
        loadComponent: () => import('./components/dashboard-overview/dashboard-overview.component').then(m => m.DashboardOverviewComponent),
        title: 'Dashboard Overview'
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
      // Default child route
      { path: '', redirectTo: 'overview', pathMatch: 'full' }
    ]
  },

  // Default redirects
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: '/dashboard' } // Wildcard for 404
];
