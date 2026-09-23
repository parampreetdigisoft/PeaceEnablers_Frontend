import { Injectable } from '@angular/core';
import { map } from 'rxjs';
import { HttpService } from 'src/app/core/http/http.service';
import { ResultResponseDto } from 'src/app/core/models/ResultResponseDto';
import {
  AiCurrentJobsHealthDto,
  AiCurrentJobDto,
  AiCurrentJobsFilterDto,
  AiCurrentJobsResultDto
} from 'src/app/core/models/aiVm/AiCurrentJobsDtos';

@Injectable({ providedIn: 'root' })
export class AiCurrentJobsService {
  constructor(private http: HttpService) {}

  getHealth() {
    return this.http
      .get(`AiCurrentJobs/health`)
      .pipe(map((x) => x as ResultResponseDto<AiCurrentJobsHealthDto>));
  }

  getJobs(filter: AiCurrentJobsFilterDto) {
    const params: Record<string, string | number | boolean> = {
      inflightOnly: filter.inflightOnly ?? true
    };
    if (filter.role) params['role'] = filter.role;
    if (filter.userName) params['userName'] = filter.userName;
    if (filter.jobName) params['jobName'] = filter.jobName;

    return this.http
      .getWithQueryParams(`AiCurrentJobs/jobs`, params)
      .pipe(map((x) => x as ResultResponseDto<AiCurrentJobsResultDto>));
  }

  getJob(jobId: string) {
    return this.http
      .get(`AiCurrentJobs/jobs/${encodeURIComponent(jobId)}`)
      .pipe(map((x) => x as ResultResponseDto<AiCurrentJobDto>));
  }

  cancelJob(jobId: string) {
    return this.http
      .post(`AiCurrentJobs/jobs/${encodeURIComponent(jobId)}/cancel`, {})
      .pipe(map((x) => x as ResultResponseDto<AiCurrentJobDto>));
  }

  getCountryStatus(countryId: number) {
    return this.http
      .get(`AiCurrentJobs/countries/${countryId}/status`)
      .pipe(map((x) => x as ResultResponseDto<unknown>));
  }
}
