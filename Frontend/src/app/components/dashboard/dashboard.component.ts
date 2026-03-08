import { Component, OnInit, signal, computed, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthenticationService } from '../../services/authentication.service'; // Adjust path

// PrimeNG Imports
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { BadgeModule } from 'primeng/badge';
import { RippleModule } from 'primeng/ripple';
import { TooltipModule } from 'primeng/tooltip';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface NavItem {
  id: string;
  icon: string;
  label: string;
  routerLink: string;
  badge?: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ButtonModule,
    AvatarModule,
    BadgeModule,
    RippleModule,
    TooltipModule,
    MenuModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  @ViewChild('profileMenu') profileMenu!: any;

  // Signals
  isDark = signal(false);
  isCollapsed = signal(false);

  // Computed: Load user from localStorage (reactive)
  currentUser = computed(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        return {
          name: user.name || user.username || 'Admin User',
          email: user.email || '',
          role: this.getUserRole(user),
          avatar: ''
        };
      } catch {
        return this.getDefaultUser();
      }
    }
    return this.getDefaultUser();
  });

  // Profile menu items
  profileMenuItems: MenuItem[] = [];

  // Navigation items for Sentinel AI system
  private readonly sentinelNavItems: NavItem[] = [
    {
      id: 'overview',
      icon: 'th-large',
      label: 'Dashboard',
      routerLink: '/dashboard/overview'
    },
    {
      id: 'live-feed',
      icon: 'video',
      label: 'Live Feed',
      routerLink: '/dashboard/live-feed',
      badge: 3
    },
    {
      id: 'violations',
      icon: 'exclamation-triangle',
      label: 'Violations Report',
      routerLink: '/dashboard/violation-report',
      badge: 12
    },
    {
      id: 'violation-detail',
      icon: 'chart-line',
      label: 'Violation Detail',
      routerLink: '/dashboard/violation-detail'
    },
    {
      id: 'cameras',
      icon: 'camera',
      label: 'Camera Management',
      routerLink: '/dashboard/camera-management'
    },
    {
      id:'pipelines',
      icon: 'wrench',
      label: 'Pipeline Management',
      routerLink: '/dashboard/pipeline-management'
    },
    {
      id: 'analytics',
      icon: 'chart-line',
      label: 'Analytics',
      routerLink: '/dashboard/analytics'
    },
    {
      id: 'settings',
      icon: 'cog',
      label: 'Settings',
      routerLink: '/dashboard/settings'
    }
  ];

  navItems = computed(() => this.sentinelNavItems);

  constructor(
    private router: Router,
    private authService: AuthenticationService // Inject auth service
  ) {
    this.authService.isAuthenticated$.pipe(
      takeUntilDestroyed()
    ).subscribe(isAuth => {
      if (!isAuth) {
        this.router.navigate(['/login']);
      }
    });
  }

  ngOnInit(): void {
    // Load saved theme preference
    const savedTheme = localStorage.getItem('theme');
    this.isDark.set(savedTheme === 'dark');
    this.applyTheme();

    // Load collapsed state
    const savedCollapsed = localStorage.getItem('sidebarCollapsed');
    this.isCollapsed.set(savedCollapsed === 'true');

    // Initialize profile menu items
    this.profileMenuItems = [
      {
        label: 'Profile',
        icon: 'pi pi-user',
        command: () => this.onProfile()
      },
      {
        label: `Email: ${this.currentUser().email}`,
        icon: 'pi pi-envelope',
        disabled: true,
        styleClass: 'profile-email'
      },
      { separator: true },
      {
        label: 'Settings',
        icon: 'pi pi-cog',
        command: () => this.onSettings()
      },
      { separator: true },
      {
        label: 'Logout',
        icon: 'pi pi-sign-out',
        severity: 'danger',
        command: () => this.onLogout()
      }
    ];
  }

  private getDefaultUser(): { name: string; email: string; role: string; avatar: string } {
    return {
      name: 'Admin User',
      email: '',
      role: 'System Administrator',
      avatar: ''
    };
  }

  private getUserRole(user: any): string {
    // Determine role based on user data or email domain
    if (user.email?.includes('@admin')) return 'System Administrator';
    if (user.email?.includes('@city-traffic')) return 'Traffic Officer';
    if (user.email?.includes('@supervisor')) return 'Supervisor';
    return 'Operator';
  }

  trackByFn(index: number, item: NavItem): string {
    return item.id;
  }

  toggleTheme(): void {
    this.isDark.update(v => !v);
    localStorage.setItem('theme', this.isDark() ? 'dark' : 'light');
    this.applyTheme();
  }

  private applyTheme(): void {
    const element = document.documentElement;
    if (this.isDark()) {
      element.classList.add('dark-theme'); // Use custom class instead of p-dark
    } else {
      element.classList.remove('dark-theme');
    }
  }

  toggleCollapse(): void {
    this.isCollapsed.update(v => !v);
    localStorage.setItem('sidebarCollapsed', this.isCollapsed().toString());
  }

  toggleProfileMenu(event: Event): void {
    this.profileMenu.toggle(event);
  }

  onProfile(): void {
    this.router.navigate(['/dashboard/profile']);
  }

  onSettings(): void {
    this.router.navigate(['/dashboard/settings']);
  }

  onLogout(): void {
    this.authService.logout(); // Use auth service logout
  }
}
