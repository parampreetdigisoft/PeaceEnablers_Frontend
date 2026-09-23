import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { SharedModule } from 'src/app/shared/share.module';
import { AiCurrentJobsService } from 'src/app/core/services/ai-current-jobs.service';
import { ToasterService } from 'src/app/core/services/toaster.service';
import {
  AiCurrentJobsHealthDto,
  AiCurrentJobDto,
  AiCurrentJobsFilterDto
} from 'src/app/core/models/aiVm/AiCurrentJobsDtos';

@Component({
  selector: 'app-ai-jobs',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './ai-jobs.component.html',
  styleUrl: './ai-jobs.component.css'
})
export class AiJobsComponent implements OnInit, OnDestroy {
  jobs: AiCurrentJobDto[] = [];
  health: AiCurrentJobsHealthDto | null = null;
  isLoader = false;
  cancellingJobId: string | null = null;
  selectedJob: AiCurrentJobDto | null = null;

  inflightOnly = true;
  filterRole: string | null = null;
  filterUserName = '';
  filterJobName = '';
  totalCount = 0;
  inflightCount = 0;
  autoRefresh = false;

  roleOptions = [
    { label: 'All roles', value: null as string | null },
    { label: 'Admin', value: 'Admin' },
    { label: 'Analyst', value: 'Analyst' },
    { label: 'Evaluator', value: 'Evaluator' },
    { label: 'CountryUser', value: 'CountryUser' }
  ];

  private destroy$ = new Subject<void>();
  private filterChanged$ = new Subject<void>();
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private aiCurrentJobsService: AiCurrentJobsService,
    private toaster: ToasterService
  ) {}

  ngOnInit(): void {
    this.filterChanged$
      .pipe(debounceTime(400), takeUntil(this.destroy$))
      .subscribe(() => this.loadJobs());

    this.loadHealth();
    this.loadJobs();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopAutoRefresh();
  }

  onFilterChanged(): void {
    this.filterChanged$.next();
  }

  loadHealth(): void {
    this.aiCurrentJobsService.getHealth().subscribe({
      next: (res) => {
        if (res.succeeded) {
          this.health = res.result ?? null;
        }
      }
    });
  }

  loadJobs(silent = false): void {
    if (!silent) {
      this.isLoader = true;
    }

    const filter: AiCurrentJobsFilterDto = {
      inflightOnly: this.inflightOnly,
      role: this.filterRole || null,
      userName: this.filterUserName?.trim() || null,
      jobName: this.filterJobName?.trim() || null
    };

    this.aiCurrentJobsService.getJobs(filter).subscribe({
      next: (res) => {
        this.isLoader = false;
        if (res.succeeded && res.result) {
          this.jobs = res.result.jobs ?? [];
          this.totalCount = res.result.totalCount ?? 0;
          this.inflightCount = res.result.inflightCount ?? 0;
        } else {
          this.jobs = [];
          if (!silent) {
            this.toaster.showError(res.errors?.[0] || 'Failed to load AI jobs.');
          }
        }
      },
      error: () => {
        this.isLoader = false;
        if (!silent) {
          this.toaster.showError('Failed to load AI jobs.');
        }
      }
    });
  }

  cancelJob(job: AiCurrentJobDto): void {
    if (!job.canCancel || this.cancellingJobId) {
      return;
    }
    if (!confirm(`Cancel job "${job.jobName}"?`)) {
      return;
    }

    this.cancellingJobId = job.jobId;
    this.aiCurrentJobsService.cancelJob(job.jobId).subscribe({
      next: (res) => {
        this.cancellingJobId = null;
        if (res.succeeded) {
          this.toaster.showSuccess(res.messages?.[0] || 'Job cancelled.');
          this.loadJobs(true);
        } else {
          this.toaster.showError(res.errors?.[0] || 'Failed to cancel job.');
        }
      },
      error: () => {
        this.cancellingJobId = null;
        this.toaster.showError('Failed to cancel job.');
      }
    });
  }

  viewJob(job: AiCurrentJobDto): void {
    this.selectedJob = job;
  }

  closeDetail(): void {
    this.selectedJob = null;
  }

  toggleAutoRefresh(): void {
    this.autoRefresh = !this.autoRefresh;
    if (this.autoRefresh) {
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
    }
  }

  statusClass(status: string): string {
    switch ((status || '').toLowerCase()) {
      case 'running':
        return 'status-running';
      case 'queued':
        return 'status-queued';
      case 'completed':
        return 'status-completed';
      case 'failed':
        return 'status-failed';
      case 'cancelled':
        return 'status-cancelled';
      default:
        return '';
    }
  }

  formatElapsed(seconds: number): string {
    if (seconds == null || isNaN(seconds)) return '—';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  }

  usersLabel(job: AiCurrentJobDto): string {
    if (!job.users?.length) return '—';
    return job.users.map((u) => `${u.fullName} (${u.role})`).join(', ');
  }

  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    this.refreshTimer = setInterval(() => {
      if (this.autoRefresh) {
        this.loadJobs(true);
      }
    }, 10000);
  }

  private stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}
