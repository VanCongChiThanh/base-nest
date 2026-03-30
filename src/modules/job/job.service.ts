import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Job, JobSkill, JobApplication, JobAssignment } from './entities';
import { CreateJobDto, ApplyJobDto, JobFilterDto, CheckInJobDto } from './dto';
import {
  JOB_ERRORS,
  APPLICATION_ERRORS,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '../../common';
import {
  JobStatus,
  ApplicationStatus,
  AssignmentStatus,
  NotificationType,
  PrivacyVisibility,
} from '../../common/enums';
import { NotificationHelper } from '../notification';
import { EmployerProfile, WorkerProfile } from '../profile/entities';
import { EmployerBadge } from '../../common/enums/employer-badge.enum';

export interface ProgressStep {
  key: string;
  label: string;
  status: 'done' | 'active' | 'pending' | 'failed';
  timestamp?: Date | null;
}

export interface ApplicationProgress {
  applicationId: string;
  applicationStatus: ApplicationStatus;
  jobId: string;
  jobTitle: string;
  jobAddress: string;
  startTime: Date;
  endTime: Date;
  salaryPerHour: number;
  currentStep: number;
  steps: ProgressStep[];
  workerInfo: Record<string, unknown>;
  employerInfo: Record<string, unknown>;
  assignment?: {
    id: string;
    status: AssignmentStatus;
    startedAt: Date | null;
    checkedInAt: Date | null;
    completedAt: Date | null;
    notes: string | null;
  } | null;
}

@Injectable()
export class JobService {
  constructor(
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    @InjectRepository(JobSkill)
    private readonly jobSkillRepository: Repository<JobSkill>,
    @InjectRepository(JobApplication)
    private readonly applicationRepository: Repository<JobApplication>,
    @InjectRepository(JobAssignment)
    private readonly assignmentRepository: Repository<JobAssignment>,
    @InjectRepository(EmployerProfile)
    private readonly employerProfileRepository: Repository<EmployerProfile>,
    @InjectRepository(WorkerProfile)
    private readonly workerProfileRepository: Repository<WorkerProfile>,
    private readonly notificationHelper: NotificationHelper,
  ) {}

  // ==================== JOB CRUD ====================

  async createJob(employerId: string, dto: CreateJobDto): Promise<Job> {
    const { skillIds, ...jobData } = dto;

    if (new Date(dto.endTime) <= new Date(dto.startTime)) {
      throw new BadRequestException(JOB_ERRORS.JOB_INVALID_TIME);
    }

    const job = this.jobRepository.create({
      ...jobData,
      employerId,
    });
    const saved = await this.jobRepository.save(job);

    if (skillIds?.length) {
      const jobSkills = skillIds.map((skillId) =>
        this.jobSkillRepository.create({ jobId: saved.id, skillId }),
      );
      await this.jobSkillRepository.save(jobSkills);
    }

    return this.findJobById(saved.id);
  }

  async findJobs(
    filter: JobFilterDto,
  ): Promise<{ data: Job[]; total: number; page: number; limit: number }> {
    const {
      page = 1,
      limit = 10,
      provinceCode,
      wardCode,
      category,
      salaryMin,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = filter;

    const qb = this.jobRepository
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.employer', 'employer')
      .leftJoinAndSelect('job.category', 'category')
      .leftJoinAndSelect('job.jobSkills', 'jobSkills')
      .leftJoinAndSelect('jobSkills.skill', 'skill')
      .where('job.status = :status', { status: JobStatus.OPEN });

    if (provinceCode) {
      qb.andWhere('job.provinceCode = :provinceCode', { provinceCode });
    }
    if (wardCode) {
      qb.andWhere('job.wardCode = :wardCode', { wardCode });
    }
    if (category) {
      qb.andWhere('job.categoryId = :category', { category });
    }
    if (salaryMin) {
      qb.andWhere('job.salaryPerHour >= :salaryMin', { salaryMin });
    }
    if (search) {
      qb.andWhere(
        '(job.title ILIKE :search OR job.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    let hasLocationFilter = false;
    if (filter.latitude !== undefined && filter.longitude !== undefined && filter.radius !== undefined) {
      hasLocationFilter = true;
      const distanceSql = `(6371 * acos(cos(radians(:latitude)) * cos(radians(job.latitude)) * cos(radians(job.longitude) - radians(:longitude)) + sin(radians(:latitude)) * sin(radians(job.latitude))))`;
      
      qb.addSelect(`${distanceSql}`, 'distance');
      qb.andWhere(`${distanceSql} <= :radius`, { 
        latitude: filter.latitude, 
        longitude: filter.longitude, 
        radius: filter.radius 
      });
    }

    const allowedSortFields = ['createdAt', 'salaryPerHour', 'startTime', 'title'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    qb.orderBy(`job.${safeSortBy}`, sortOrder);
    qb.skip((page - 1) * limit).take(limit);

    const { entities, raw } = await qb.getRawAndEntities();
    const total = await qb.getCount();

    const data = entities.map((entity, index) => {
      const job = entity as any;
      if (hasLocationFilter && raw[index]?.distance !== undefined) {
        job.distance = parseFloat(raw[index].distance);
      }
      return job;
    });
    await this.attachEmployerProfiles(data);
    this.sortByTrustPriority(data);

    return { data, total, page, limit };
  }

  async findJobById(id: string): Promise<Job> {
    const job = await this.jobRepository.findOne({
      where: { id },
      relations: ['employer', 'category', 'jobSkills', 'jobSkills.skill'],
    });
    if (!job) {
      throw new NotFoundException(JOB_ERRORS.JOB_NOT_FOUND);
    }
    await this.attachEmployerProfiles([job]);
    return job;
  }

  async findEmployerJobs(
    employerId: string,
    page = 1,
    limit = 10,
  ): Promise<{ data: Job[]; total: number; page: number; limit: number }> {
    const [data, total] = await this.jobRepository.findAndCount({
      where: { employerId },
      relations: ['category', 'jobSkills', 'jobSkills.skill', 'applications'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  private async attachEmployerProfiles(jobs: Job[]): Promise<void> {
    if (!jobs.length) return;
    const employerIds = [...new Set(jobs.map((j) => j.employerId))];
    const profiles = await this.employerProfileRepository.find({
      where: { userId: In(employerIds) },
    });
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));
    for (const job of jobs) {
      Object.assign(job, { employerProfile: profileMap.get(job.employerId) || null });
    }
  }

  private sortByTrustPriority(jobs: Job[]): void {
    const badgeWeight: Record<string, number> = {
      [EmployerBadge.TOP]: 3,
      [EmployerBadge.TRUSTED]: 2,
      [EmployerBadge.VERIFIED]: 1,
      [EmployerBadge.NONE]: 0,
    };
    jobs.sort((a, b) => {
      const pa = (a as any).employerProfile;
      const pb = (b as any).employerProfile;
      const verA = pa?.isVerifiedBusiness ? 1 : 0;
      const verB = pb?.isVerifiedBusiness ? 1 : 0;
      if (verB !== verA) return verB - verA;
      const badgeA = badgeWeight[pa?.badge] ?? 0;
      const badgeB = badgeWeight[pb?.badge] ?? 0;
      return badgeB - badgeA;
    });
  }

  async cancelJob(jobId: string, employerId: string): Promise<Job> {
    const job = await this.findJobById(jobId);
    if (job.employerId !== employerId) {
      throw new ForbiddenException(JOB_ERRORS.JOB_OWNER_FORBIDDEN);
    }
    if (job.status !== JobStatus.OPEN) {
      throw new BadRequestException(JOB_ERRORS.JOB_ALREADY_CLOSED);
    }

    job.status = JobStatus.CANCELLED;
    const saved = await this.jobRepository.save(job);

    const acceptedApps = await this.applicationRepository.find({
      where: { jobId, status: ApplicationStatus.ACCEPTED },
    });
    for (const app of acceptedApps) {
      await this.notificationHelper.send(
        app.workerId,
        NotificationType.JOB_CANCELLED,
        jobId,
        { jobTitle: job.title },
      );
    }

    return saved;
  }

  // ==================== JOB APPLICATIONS ====================

  async getMyApplication(
    jobId: string,
    workerId: string,
  ): Promise<JobApplication | null> {
    return this.applicationRepository.findOne({
      where: { jobId, workerId },
    });
  }

  async applyForJob(
    jobId: string,
    workerId: string,
    dto: ApplyJobDto,
  ): Promise<JobApplication> {
    const job = await this.findJobById(jobId);

    if (job.status !== JobStatus.OPEN) {
      throw new BadRequestException(JOB_ERRORS.JOB_NOT_OPEN);
    }
    if (job.employerId === workerId) {
      throw new BadRequestException(APPLICATION_ERRORS.APPLICATION_SELF_APPLY);
    }

    const existingApp = await this.applicationRepository.findOne({
      where: { jobId, workerId },
    });
    if (existingApp) {
      throw new ConflictException(APPLICATION_ERRORS.APPLICATION_ALREADY_APPLIED);
    }

    const application = this.applicationRepository.create({
      jobId,
      workerId,
      coverLetter: dto.coverLetter,
    });
    const saved = await this.applicationRepository.save(application);

    await this.notificationHelper.send(
      job.employerId,
      NotificationType.JOB_APPLICATION_RECEIVED,
      jobId,
      { jobTitle: job.title, message: dto.coverLetter, applicationId: saved.id },
    );

    return saved;
  }

  async cancelApplication(
    applicationId: string,
    workerId: string,
  ): Promise<JobApplication> {
    const application = await this.applicationRepository.findOne({
      where: { id: applicationId },
      relations: ['job'],
    });
    if (!application) {
      throw new NotFoundException(APPLICATION_ERRORS.APPLICATION_NOT_FOUND);
    }
    if (application.workerId !== workerId) {
      throw new ForbiddenException(APPLICATION_ERRORS.APPLICATION_ACCESS_FORBIDDEN);
    }
    if (application.status !== ApplicationStatus.PENDING) {
      throw new BadRequestException(APPLICATION_ERRORS.APPLICATION_NOT_PENDING);
    }

    application.status = ApplicationStatus.CANCELLED;
    application.respondedAt = new Date();
    const saved = await this.applicationRepository.save(application);

    await this.notificationHelper.send(
      application.job.employerId,
      NotificationType.APPLICATION_CANCELLED,
      application.jobId,
      { jobTitle: application.job.title, workerName: workerId, applicationId },
    );

    return saved;
  }

  async acceptApplication(
    applicationId: string,
    employerId: string,
  ): Promise<JobApplication> {
    const application = await this.applicationRepository.findOne({
      where: { id: applicationId },
      relations: ['job'],
    });
    if (!application) {
      throw new NotFoundException(APPLICATION_ERRORS.APPLICATION_NOT_FOUND);
    }
    if (application.job.employerId !== employerId) {
      throw new ForbiddenException(APPLICATION_ERRORS.APPLICATION_ACCESS_FORBIDDEN);
    }
    if (application.status !== ApplicationStatus.PENDING) {
      throw new BadRequestException(APPLICATION_ERRORS.APPLICATION_NOT_PENDING);
    }

    const acceptedCount = await this.applicationRepository.count({
      where: { jobId: application.jobId, status: ApplicationStatus.ACCEPTED },
    });
    if (acceptedCount >= application.job.requiredWorkers) {
      throw new BadRequestException(JOB_ERRORS.JOB_WORKERS_FULL);
    }

    application.status = ApplicationStatus.ACCEPTED;
    application.respondedAt = new Date();
    const saved = await this.applicationRepository.save(application);

    const assignment = this.assignmentRepository.create({
      jobId: application.jobId,
      workerId: application.workerId,
      applicationId: application.id,
    });
    await this.assignmentRepository.save(assignment);

    if (acceptedCount + 1 >= application.job.requiredWorkers) {
      await this.jobRepository.update(application.jobId, {
        status: JobStatus.CLOSED,
      });
    }

    await this.notificationHelper.send(
      application.workerId,
      NotificationType.JOB_APPLICATION_ACCEPTED,
      application.id,
      { jobTitle: application.job.title, applicationId: application.id, jobId: application.jobId },
    );

    return saved;
  }

  async rejectApplication(
    applicationId: string,
    employerId: string,
  ): Promise<JobApplication> {
    const application = await this.applicationRepository.findOne({
      where: { id: applicationId },
      relations: ['job'],
    });
    if (!application) {
      throw new NotFoundException(APPLICATION_ERRORS.APPLICATION_NOT_FOUND);
    }
    if (application.job.employerId !== employerId) {
      throw new ForbiddenException(APPLICATION_ERRORS.APPLICATION_ACCESS_FORBIDDEN);
    }
    if (application.status !== ApplicationStatus.PENDING) {
      throw new BadRequestException(APPLICATION_ERRORS.APPLICATION_NOT_PENDING);
    }

    application.status = ApplicationStatus.REJECTED;
    application.respondedAt = new Date();
    const saved = await this.applicationRepository.save(application);

    await this.notificationHelper.send(
      application.workerId,
      NotificationType.JOB_APPLICATION_REJECTED,
      application.id,
      { jobTitle: application.job.title, applicationId: application.id, jobId: application.jobId },
    );

    return saved;
  }

  async getJobApplications(
    jobId: string,
    employerId: string,
    page = 1,
    limit = 10,
  ): Promise<{ data: JobApplication[]; total: number; page: number; limit: number }> {
    const job = await this.findJobById(jobId);
    if (job.employerId !== employerId) {
      throw new ForbiddenException(JOB_ERRORS.JOB_OWNER_FORBIDDEN);
    }

    const [data, total] = await this.applicationRepository.findAndCount({
      where: { jobId },
      relations: ['worker'],
      order: { appliedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  // ==================== WORKER HISTORY ====================

  async getWorkerJobHistory(
    workerId: string,
    page = 1,
    limit = 10,
  ): Promise<{ data: JobApplication[]; total: number; page: number; limit: number }> {
    const [data, total] = await this.applicationRepository.findAndCount({
      where: { workerId },
      relations: ['job', 'job.employer', 'job.category'],
      order: { appliedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  // ==================== CHECK-IN & COMPLETION ====================

  async checkInJob(
    jobId: string,
    workerId: string,
    dto: CheckInJobDto,
  ): Promise<JobAssignment> {
    const assignment = await this.assignmentRepository.findOne({
      where: { jobId, workerId },
      relations: ['job'],
    });
    if (!assignment) {
      throw new NotFoundException(APPLICATION_ERRORS.APPLICATION_NOT_FOUND);
    }
    if (assignment.status !== AssignmentStatus.ASSIGNED) {
      throw new BadRequestException(
        APPLICATION_ERRORS.ASSIGNMENT_MUST_BE_ASSIGNED,
      );
    }

    assignment.status = AssignmentStatus.IN_PROGRESS;
    assignment.startedAt = new Date();
    assignment.checkedInAt = new Date();
    if (dto.notes) assignment.notes = dto.notes;
    const saved = await this.assignmentRepository.save(assignment);

    await this.notificationHelper.send(
      assignment.job.employerId,
      NotificationType.JOB_CHECKED_IN,
      jobId,
      { jobTitle: assignment.job.title },
    );

    return saved;
  }

  async completeJob(jobId: string, workerId: string): Promise<JobAssignment> {
    const assignment = await this.assignmentRepository.findOne({
      where: { jobId, workerId },
      relations: ['job'],
    });
    if (!assignment) {
      throw new NotFoundException(APPLICATION_ERRORS.APPLICATION_NOT_FOUND);
    }
    if (assignment.status !== AssignmentStatus.IN_PROGRESS) {
      throw new BadRequestException(
        APPLICATION_ERRORS.ASSIGNMENT_MUST_BE_IN_PROGRESS,
      );
    }

    assignment.status = AssignmentStatus.COMPLETED;
    assignment.completedAt = new Date();
    const saved = await this.assignmentRepository.save(assignment);

    // Increment totalJobsCompleted on worker profile
    await this.workerProfileRepository
      .createQueryBuilder()
      .update(WorkerProfile)
      .set({ totalJobsCompleted: () => 'total_jobs_completed + 1' })
      .where('user_id = :workerId', { workerId })
      .execute();

    await this.notificationHelper.send(
      assignment.job.employerId,
      NotificationType.JOB_COMPLETED,
      jobId,
      { jobTitle: assignment.job.title },
    );

    return saved;
  }

  // ==================== PROGRESS APIs ====================

  async getApplicationProgress(
    applicationId: string,
    callerId: string,
  ): Promise<ApplicationProgress> {
    const application = await this.applicationRepository.findOne({
      where: { id: applicationId },
      relations: ['job', 'job.employer', 'job.category', 'worker'],
    });
    if (!application) {
      throw new NotFoundException(APPLICATION_ERRORS.APPLICATION_NOT_FOUND);
    }

    // Auth: only worker of this app or employer of this job can see progress
    const isWorker = application.workerId === callerId;
    const isEmployer = application.job.employerId === callerId;
    if (!isWorker && !isEmployer) {
      throw new ForbiddenException(APPLICATION_ERRORS.APPLICATION_ACCESS_FORBIDDEN);
    }

    const assignment = await this.assignmentRepository.findOne({
      where: { applicationId },
    });

    // Build steps
    const steps = this.buildProgressSteps(application, assignment ?? null);
    const currentStep = steps.filter(s => s.status === 'done').length;

    // Worker profile with privacy filter
    const workerProfile = await this.workerProfileRepository.findOne({
      where: { userId: application.workerId },
      relations: ['workerSkills', 'workerSkills.skill'],
    });

    const isAccepted = [
      ApplicationStatus.ACCEPTED,
    ].includes(application.status);
    const isWorking = assignment?.status === AssignmentStatus.IN_PROGRESS
      || assignment?.status === AssignmentStatus.COMPLETED;

    const workerInfo = this.buildWorkerInfo(
      application.worker,
      workerProfile,
      isAccepted || isWorking,
    );

    // Employer info (always safe fields)
    const employerProfile = await this.employerProfileRepository.findOne({
      where: { userId: application.job.employerId },
    });
    const employerInfo = {
      id: application.job.employer.id,
      firstName: application.job.employer.firstName,
      lastName: application.job.employer.lastName,
      avatarUrl: application.job.employer.avatarUrl,
      companyName: employerProfile?.companyName ?? null,
      ratingAvg: employerProfile?.ratingAvg ?? 0,
      badge: employerProfile?.badge ?? null,
      isVerifiedBusiness: employerProfile?.isVerifiedBusiness ?? false,
      // phone only shown when accepted
      phone: isAccepted || isWorking
        ? this.applyPrivacy(
            employerProfile?.phone ?? null,
            employerProfile?.privacySettings?.phone ?? PrivacyVisibility.ACCEPTED_ONLY,
            true,
          )
        : null,
    };

    return {
      applicationId,
      applicationStatus: application.status,
      jobId: application.jobId,
      jobTitle: application.job.title,
      jobAddress: application.job.address,
      startTime: application.job.startTime,
      endTime: application.job.endTime,
      salaryPerHour: application.job.salaryPerHour,
      currentStep,
      steps,
      workerInfo,
      employerInfo,
      assignment: assignment
        ? {
            id: assignment.id,
            status: assignment.status,
            startedAt: assignment.startedAt,
            checkedInAt: assignment.checkedInAt,
            completedAt: assignment.completedAt,
            notes: assignment.notes,
          }
        : null,
    };
  }

  async getJobProgress(
    jobId: string,
    employerId: string,
  ): Promise<{ total: number; workers: ApplicationProgress[] }> {
    const job = await this.findJobById(jobId);
    if (job.employerId !== employerId) {
      throw new ForbiddenException(JOB_ERRORS.JOB_OWNER_FORBIDDEN);
    }

    const applications = await this.applicationRepository.find({
      where: { jobId },
      relations: ['worker'],
    });

    const workers = await Promise.all(
      applications.map((app) =>
        this.getApplicationProgress(app.id, employerId),
      ),
    );

    return { total: applications.length, workers };
  }

  // ==================== HELPERS ====================

  private buildProgressSteps(
    application: JobApplication,
    assignment: JobAssignment | null,
  ): ProgressStep[] {
    const isCancelled = application.status === ApplicationStatus.CANCELLED;
    const isRejected = application.status === ApplicationStatus.REJECTED;

    const steps: ProgressStep[] = [
      {
        key: 'APPLIED',
        label: 'Đã ứng tuyển',
        status: 'done',
        timestamp: application.appliedAt,
      },
      {
        key: 'REVIEWING',
        label: 'Đang xem xét',
        status:
          application.status === ApplicationStatus.PENDING
            ? 'active'
            : isCancelled
              ? 'failed'
              : 'done',
        timestamp: null,
      },
      {
        key: 'ACCEPTED',
        label: isRejected ? 'Đã từ chối' : 'Đã chấp nhận',
        status: isRejected
          ? 'failed'
          : isCancelled
            ? 'failed'
            : application.status === ApplicationStatus.ACCEPTED ||
                assignment !== null
              ? 'done'
              : 'pending',
        timestamp: application.respondedAt,
      },
      {
        key: 'CHECKED_IN',
        label: 'Check-in làm việc',
        status:
          assignment?.checkedInAt
            ? 'done'
            : assignment?.status === AssignmentStatus.ASSIGNED
              ? 'active'
              : 'pending',
        timestamp: assignment?.checkedInAt ?? null,
      },
      {
        key: 'IN_PROGRESS',
        label: 'Đang làm việc',
        status:
          assignment?.status === AssignmentStatus.IN_PROGRESS
            ? 'active'
            : assignment?.status === AssignmentStatus.COMPLETED
              ? 'done'
              : 'pending',
        timestamp: assignment?.startedAt ?? null,
      },
      {
        key: 'COMPLETED',
        label: 'Hoàn thành',
        status:
          assignment?.status === AssignmentStatus.COMPLETED ? 'done' : 'pending',
        timestamp: assignment?.completedAt ?? null,
      },
    ];

    return steps;
  }

  private buildWorkerInfo(
    worker: { id: string; firstName: string; lastName: string; avatarUrl: string | null },
    profile: WorkerProfile | null,
    isAccepted: boolean,
  ): Record<string, unknown> {
    const privacy = profile?.privacySettings ?? {};
    const info: Record<string, unknown> = {
      id: worker.id,
      // Name & avatar always visible
      firstName: worker.firstName,
      lastName: worker.lastName,
      avatarUrl: worker.avatarUrl,
      ratingAvg: profile?.ratingAvg ?? 0,
      totalReviews: profile?.totalReviews ?? 0,
      totalJobsCompleted: profile?.totalJobsCompleted ?? 0,
      isAvailable: profile?.isAvailable ?? true,
      workerSkills: profile?.workerSkills ?? [],
    };

    // Phone — forced shown when accepted
    if (isAccepted) {
      info.phone = profile?.phone ?? null;
    } else {
      const phoneVis = privacy.phone ?? PrivacyVisibility.ACCEPTED_ONLY;
      info.phone = phoneVis === PrivacyVisibility.PUBLIC ? (profile?.phone ?? null) : null;
    }

    // Address
    const addressVis = privacy.address ?? PrivacyVisibility.ACCEPTED_ONLY;
    info.address = this.applyPrivacy(profile?.address ?? null, addressVis, isAccepted);

    // Date of birth
    const dobVis = privacy.dateOfBirth ?? PrivacyVisibility.PRIVATE;
    info.dateOfBirth = this.applyPrivacy(
      profile?.dateOfBirth?.toString() ?? null,
      dobVis,
      isAccepted,
    );

    return info;
  }

  private applyPrivacy(
    value: string | null,
    visibility: PrivacyVisibility,
    isAccepted: boolean,
  ): string | null {
    // If the application is accepted or they are working together, always show personal information
    if (isAccepted) return value;
    
    // Otherwise, follow the standard privacy rules
    if (visibility === PrivacyVisibility.PUBLIC) return value;
    return null;
  }
}
