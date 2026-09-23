export interface AiCurrentJobsFilterDto {
  inflightOnly?: boolean;
  role?: string | null;
  userName?: string | null;
  jobName?: string | null;
}

export interface AiCurrentJobUserDto {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  isSystem: boolean;
}

export interface AiCurrentJobDto {
  jobId: string;
  jobName: string;
  coalescingKey: string;
  resourceType: string;
  status: string;
  countryId?: number | null;
  pillarId?: number | null;
  questionId?: number | null;
  elapsedSeconds: number;
  provider?: string | null;
  model?: string | null;
  purpose?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
  createdByRole?: string | null;
  users: AiCurrentJobUserDto[];
  error?: string | null;
  createdAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  canCancel: boolean;
}

export interface AiCurrentJobsResultDto {
  jobs: AiCurrentJobDto[];
  totalCount: number;
  inflightCount: number;
}

export interface AiCurrentJobsHealthDto {
  status: string;
}
