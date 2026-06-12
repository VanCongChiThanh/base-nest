import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  Job,
  JobSkill,
  JobApplication,
  JobAssignment,
  JobInvitation,
} from './entities';
import { Escrow, Milestone } from '../payment/entities';
import { CreateJobDto, ApplyJobDto, JobFilterDto, CheckInJobDto } from './dto';
import {
  JOB_ERRORS,
  APPLICATION_ERRORS,
  ESCROW_ERRORS,
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
  JobType,
  JobSalaryType,
  OnlinePaymentType,
  PaymentMethod,
  EscrowStatus,
  MilestoneStatus,
} from '../../common/enums';
import { JobInvitationStatus } from './entities/job-invitation.entity';
import { NotificationHelper } from '../notification';
import { EmployerProfile, WorkerProfile } from '../profile/entities';
import { AiSyncCronService } from '../ai/ai-sync-cron.service';

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
  jobType: JobType;
  paymentMethod?: PaymentMethod;
  salaryType: JobSalaryType | null;
  totalBudget: number | null;
  onlinePaymentType: OnlinePaymentType | null;
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
    loggedHours?: number | null;
    hoursSubmittedBy?: string | null;
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
    @InjectRepository(JobInvitation)
    private readonly invitationRepository: Repository<JobInvitation>,
    @InjectRepository(EmployerProfile)
    private readonly employerProfileRepository: Repository<EmployerProfile>,
    @InjectRepository(WorkerProfile)
    private readonly workerProfileRepository: Repository<WorkerProfile>,
    @InjectRepository(Escrow)
    private readonly escrowRepository: Repository<Escrow>,
    @InjectRepository(Milestone)
    private readonly milestoneRepository: Repository<Milestone>,
    private readonly notificationHelper: NotificationHelper,
    private readonly aiSyncCronService: AiSyncCronService,
  ) {}

  // ==================== JOB CRUD ====================

  async createJob(
    employerId: string,
    postedById: string | null,
    dto: CreateJobDto,
  ): Promise<Job> {
    const { skillIds, ...jobData } = dto;

    if (dto.startTime && dto.endTime) {
      if (new Date(dto.endTime) <= new Date(dto.startTime)) {
        throw new BadRequestException(JOB_ERRORS.JOB_INVALID_TIME);
      }
    }

    const job = this.jobRepository.create({
      ...jobData,
      employerId,
      postedById,
    });
    const saved = await this.jobRepository.save(job);

    if (skillIds?.length) {
      const jobSkills = skillIds.map((skillId) =>
        this.jobSkillRepository.create({ jobId: saved.id, skillId }),
      );
      await this.jobSkillRepository.save(jobSkills);
    }

    const fullJob = await this.findJobById(saved.id);

    // Enqueue AI embedding in background (non-blocking)
    this.aiSyncCronService
      .enqueueJobSync(saved.id)
      .catch((err) =>
        console.warn('Failed to enqueue AI embedding for job:', err?.message),
      );

    // Enqueue Scam Analysis
    this.aiSyncCronService
      .enqueueScamAnalysis(saved.id)
      .catch((err) =>
        console.warn('Failed to enqueue Scam Analysis for job:', err?.message),
      );

    return fullJob;
  }

  async createDirectHire(
    employerId: string,
    postedById: string | null,
    targetWorkerId: string,
    dto: Partial<CreateJobDto>,
  ): Promise<Job> {
    const job = this.jobRepository.create({
      ...dto,
      employerId,
      postedById,
      isDirectHire: true,
      targetWorkerId,
      status: JobStatus.OPEN, // Auto open
    });
    const saved = await this.jobRepository.save(job);

    // Create an application automatically for the target worker
    const application = this.applicationRepository.create({
      jobId: saved.id,
      workerId: targetWorkerId,
      status: ApplicationStatus.EMPLOYER_ACCEPTED, // Employer already approved the offer, pending worker's acceptance
      coverLetter: 'Direct hire request from employer',
    });
    await this.applicationRepository.save(application);

    // Notify the worker
    await this.notificationHelper.send(
      targetWorkerId,
      NotificationType.JOB_APPLICATION_RECEIVED,
      saved.id,
      {
        jobTitle: saved.title,
        message: 'Bạn có một yêu cầu Thuê ngay mới!',
        isDirectHire: true,
      },
    );

    // Enqueue Scam Analysis
    this.aiSyncCronService
      .enqueueScamAnalysis(saved.id)
      .catch((err) =>
        console.warn('Failed to enqueue Scam Analysis for job:', err?.message),
      );

    return this.findJobById(saved.id);
  }

  // ==================== INVITATIONS ====================

  async negotiateDirectHirePrice(
    jobId: string,
    userId: string,
    proposedPrice: number,
  ): Promise<JobApplication> {
    const job = await this.findJobById(jobId);
    if (!job.isDirectHire) {
      throw new BadRequestException(JOB_ERRORS.JOB_NEGOTIATE_DIRECT_HIRE_ONLY);
    }

    const application = await this.applicationRepository.findOne({
      where: { jobId },
    });
    if (!application) {
      throw new NotFoundException(
        APPLICATION_ERRORS.APPLICATION_NEGOTIATE_NOT_FOUND,
      );
    }

    const isEmployer = job.employerId === userId || job.postedById === userId;
    const isWorker = application.workerId === userId;

    if (!isEmployer && !isWorker) {
      throw new ForbiddenException(JOB_ERRORS.JOB_NEGOTIATE_ACCESS_FORBIDDEN);
    }

    if (application.status === ApplicationStatus.ACCEPTED) {
      throw new BadRequestException(JOB_ERRORS.JOB_NEGOTIATE_ALREADY_ACCEPTED);
    }

    // Update job price

    if (job.onlinePaymentType === OnlinePaymentType.FIXED_PRICE) {
      job.totalBudget = proposedPrice;
    } else {
      job.salaryPerHour = proposedPrice;
    }
    await this.jobRepository.save(job);

    // Flip application status so the other party has to approve
    if (isEmployer) {
      application.status = ApplicationStatus.EMPLOYER_ACCEPTED; // Waiting for worker
    } else {
      application.status = ApplicationStatus.PENDING; // Waiting for employer
    }

    return this.applicationRepository.save(application);
  }

  async inviteWorkerToJob(
    employerId: string,
    jobId: string,
    workerId: string,
  ): Promise<JobInvitation> {
    const job = await this.findJobById(jobId);
    if (job.employerId !== employerId && job.postedById !== employerId) {
      throw new ForbiddenException(JOB_ERRORS.JOB_INVITE_OWNER_ONLY);
    }

    if (job.status !== JobStatus.OPEN) {
      throw new BadRequestException(JOB_ERRORS.JOB_NOT_OPEN);
    }

    // Check if invitation already exists
    const existingInv = await this.invitationRepository.findOne({
      where: { jobId, workerId },
    });

    if (existingInv) {
      throw new ConflictException(JOB_ERRORS.JOB_WORKER_ALREADY_INVITED);
    }

    // Check if worker already applied
    const existingApp = await this.applicationRepository.findOne({
      where: { jobId, workerId },
    });

    if (existingApp) {
      throw new ConflictException(
        APPLICATION_ERRORS.APPLICATION_ALREADY_APPLIED,
      );
    }

    const invitation = this.invitationRepository.create({
      jobId,
      workerId,
      employerId,
      status: JobInvitationStatus.PENDING,
    });

    const saved = await this.invitationRepository.save(invitation);

    await this.notificationHelper.send(
      workerId,
      NotificationType.JOB_APPLICATION_RECEIVED, // Use a suitable notification type
      jobId,
      {
        jobTitle: job.title,
        message: 'You have been invited to apply for a job!',
      },
    );

    return saved;
  }

  async respondToInvitation(
    workerId: string,
    invitationId: string,
    accept: boolean,
  ): Promise<any> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId },
      relations: ['job'],
    });

    if (!invitation)
      throw new NotFoundException(JOB_ERRORS.JOB_INVITATION_NOT_FOUND);
    if (invitation.workerId !== workerId)
      throw new ForbiddenException(JOB_ERRORS.JOB_INVITATION_FORBIDDEN);
    if (invitation.status !== JobInvitationStatus.PENDING) {
      throw new BadRequestException(
        JOB_ERRORS.JOB_INVITATION_ALREADY_RESPONDED,
      );
    }

    if (accept) {
      invitation.status = JobInvitationStatus.ACCEPTED;
      await this.invitationRepository.save(invitation);

      // Create a pending application automatically
      const app = this.applicationRepository.create({
        jobId: invitation.jobId,
        workerId: workerId,
        status: ApplicationStatus.PENDING,
        coverLetter: 'Accepted invitation',
      });
      await this.applicationRepository.save(app);

      await this.notificationHelper.send(
        invitation.employerId,
        NotificationType.JOB_APPLICATION_RECEIVED,
        invitation.jobId,
        {
          jobTitle: invitation.job.title,
          message: 'A worker has accepted your job invitation and applied.',
        },
      );

      return { invitation, application: app };
    } else {
      invitation.status = JobInvitationStatus.DECLINED;
      await this.invitationRepository.save(invitation);
      return { invitation };
    }
  }

  async getMyInvitations(workerId: string): Promise<JobInvitation[]> {
    return this.invitationRepository.find({
      where: { workerId },
      relations: ['job', 'employer'],
      order: { createdAt: 'DESC' },
    });
  }

  // ==================== JOB CRUD ====================

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
      employerId,
      status = JobStatus.OPEN,
    } = filter;

    // Step 1: rank + paginate at the ID level. We join only single-row
    // relations (employer, employer_profile) here so the composite ORDER BY
    // (trust + rating) can run in SQL before LIMIT, ranking across the whole
    // result set rather than just one page (the previous in-memory sort only
    // reordered the current page). Collection joins are added in step 2.
    const distanceSql = `(6371 * acos(cos(radians(:latitude)) * cos(radians(job.latitude)) * cos(radians(job.longitude) - radians(:longitude)) + sin(radians(:latitude)) * sin(radians(job.latitude))))`;
    const hasLocationFilter =
      filter.latitude !== undefined &&
      filter.longitude !== undefined &&
      filter.radius !== undefined;

    const rankQb = this.jobRepository
      .createQueryBuilder('job')
      .leftJoin('job.employer', 'employer')
      .leftJoin(EmployerProfile, 'ep', 'ep.user_id = job.employer_id')
      .where('job.status = :status', { status })
      .andWhere('job.isDirectHire = false')
      .andWhere('(job.endTime IS NULL OR job.endTime >= NOW())')
      .andWhere('(job.deadline IS NULL OR job.deadline >= NOW())');

    if (employerId) {
      rankQb.andWhere(
        '(job.employerId = :employerId OR job.postedById = :employerId)',
        { employerId },
      );
    }
    if (provinceCode) {
      rankQb.andWhere('job.provinceCode = :provinceCode', { provinceCode });
    }
    if (wardCode) {
      rankQb.andWhere('job.wardCode = :wardCode', { wardCode });
    }
    if (category) {
      rankQb.andWhere('job.categoryId = :category', { category });
    }
    if (salaryMin) {
      rankQb.andWhere('job.salaryPerHour >= :salaryMin', { salaryMin });
    }
    if (search) {
      rankQb.andWhere(
        '(job.title ILIKE :search OR job.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }
    if (filter.jobType) {
      rankQb.andWhere('job.jobType = :jobType', { jobType: filter.jobType });
    }
    if (hasLocationFilter) {
      rankQb.andWhere(`${distanceSql} <= :radius`, {
        latitude: filter.latitude,
        longitude: filter.longitude,
        radius: filter.radius,
      });
    }

    const total = await rankQb.getCount();

    const allowedSortFields = ['salaryPerHour', 'startTime', 'title'];
    if (sortBy && sortBy !== 'createdAt' && allowedSortFields.includes(sortBy)) {
      // Explicit user-chosen sort wins.
      rankQb.orderBy(`job.${sortBy}`, sortOrder);
    } else {
      // Default browse order: trust signals, then employer rating, then recency.
      rankQb
        .orderBy(
          `CASE WHEN employer.verification_level IN ('BASIC','BUSINESS') THEN 1 ELSE 0 END`,
          'DESC',
        )
        .addOrderBy(`CASE WHEN ep.is_verified_business THEN 1 ELSE 0 END`, 'DESC')
        .addOrderBy(
          `CASE ep.badge WHEN 'TOP' THEN 3 WHEN 'TRUSTED' THEN 2 WHEN 'VERIFIED' THEN 1 ELSE 0 END`,
          'DESC',
        )
        .addOrderBy('ep.rating_avg', 'DESC')
        .addOrderBy('job.createdAt', 'DESC');
    }

    rankQb.select('job.id', 'id');
    if (hasLocationFilter) {
      rankQb.addSelect(distanceSql, 'distance');
    }
    rankQb.offset((page - 1) * limit).limit(limit);

    const rankedRows = await rankQb.getRawMany<{
      id: string;
      distance?: string;
    }>();
    const orderedIds = rankedRows.map((r) => r.id);

    if (orderedIds.length === 0) {
      return { data: [], total, page, limit };
    }

    const distanceMap = new Map<string, number>();
    if (hasLocationFilter) {
      for (const row of rankedRows) {
        if (row.distance !== undefined && row.distance !== null) {
          distanceMap.set(row.id, parseFloat(row.distance));
        }
      }
    }

    // Step 2: hydrate the page with all relations, then restore rank order.
    const entities = await this.jobRepository
      .createQueryBuilder('job')
      .leftJoin('job.employer', 'employer')
      .addSelect([
        'employer.id',
        'employer.email',
        'employer.firstName',
        'employer.lastName',
        'employer.role',
        'employer.avatarUrl',
        'employer.verificationLevel',
        'employer.organizationId',
      ])
      .leftJoin('job.postedBy', 'postedBy')
      .addSelect([
        'postedBy.id',
        'postedBy.email',
        'postedBy.firstName',
        'postedBy.lastName',
        'postedBy.role',
        'postedBy.avatarUrl',
        'postedBy.verificationLevel',
        'postedBy.organizationId',
      ])
      .leftJoinAndSelect('job.category', 'category')
      .leftJoinAndSelect('job.jobSkills', 'jobSkills')
      .leftJoinAndSelect('jobSkills.skill', 'skill')
      .where('job.id IN (:...orderedIds)', { orderedIds })
      .getMany();

    const byId = new Map(entities.map((e) => [e.id, e]));
    const data = orderedIds
      .map((id) => byId.get(id))
      .filter((j): j is Job => Boolean(j));

    if (hasLocationFilter) {
      for (const job of data) {
        const distance = distanceMap.get(job.id);
        if (distance !== undefined) {
          (job as any).distance = distance;
        }
      }
    }

    await this.attachEmployerProfiles(data);

    return { data, total, page, limit };
  }

  async findJobById(id: string): Promise<Job> {
    const job = await this.jobRepository
      .createQueryBuilder('job')
      .leftJoin('job.employer', 'employer')
      .addSelect([
        'employer.id',
        'employer.email',
        'employer.firstName',
        'employer.lastName',
        'employer.role',
        'employer.avatarUrl',
        'employer.verificationLevel',
        'employer.organizationId'
      ])
      .leftJoin('job.postedBy', 'postedBy')
      .addSelect([
        'postedBy.id',
        'postedBy.email',
        'postedBy.firstName',
        'postedBy.lastName',
        'postedBy.role',
        'postedBy.avatarUrl',
        'postedBy.verificationLevel',
        'postedBy.organizationId'
      ])
      .leftJoinAndSelect('job.category', 'category')
      .leftJoinAndSelect('job.jobSkills', 'jobSkills')
      .leftJoinAndSelect('jobSkills.skill', 'skill')
      .where('job.id = :id', { id })
      .getOne();
    if (!job) {
      throw new NotFoundException(JOB_ERRORS.JOB_NOT_FOUND);
    }
    this.applyExpirationStatus(job);
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
      relations: ['category', 'jobSkills', 'jobSkills.skill', 'applications', 'postedBy'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    data.forEach(job => this.applyExpirationStatus(job));
    return { data, total, page, limit };
  }

  private applyExpirationStatus(job: Job): void {
    if (job.status === JobStatus.OPEN) {
      const now = new Date();
      if ((job.endTime && new Date(job.endTime) < now) || (job.deadline && new Date(job.deadline) < now)) {
        job.status = JobStatus.CLOSED;
      }
    }
  }

  private async attachEmployerProfiles(jobs: Job[]): Promise<void> {
    if (!jobs.length) return;
    const employerIds = [...new Set(jobs.map((j) => j.employerId))];
    const profiles = await this.employerProfileRepository.find({
      where: { userId: In(employerIds) },
    });
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));
    for (const job of jobs) {
      Object.assign(job, {
        employerProfile: profileMap.get(job.employerId) || null,
      });
    }
  }

  async cancelJob(jobId: string, employerId: string): Promise<Job> {
    const job = await this.findJobById(jobId);
    if (job.employerId !== employerId && job.postedById !== employerId) {
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

    this.aiSyncCronService
      .enqueueJobSync(jobId)
      .catch((err) =>
        console.warn(
          'Failed to enqueue AI embedding for cancelled job:',
          err?.message,
        ),
      );

    this.aiSyncCronService.deleteScamAnalysisCache(jobId);

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
    const now = new Date();
    if ((job.endTime && new Date(job.endTime) < now) || (job.deadline && new Date(job.deadline) < now)) {
      throw new BadRequestException(JOB_ERRORS.JOB_EXPIRED);
    }
    if (job.employerId === workerId) {
      throw new BadRequestException(APPLICATION_ERRORS.APPLICATION_SELF_APPLY);
    }
    if (job.isDirectHire && job.targetWorkerId !== workerId) {
      throw new ForbiddenException(
        APPLICATION_ERRORS.APPLICATION_ACCESS_FORBIDDEN,
      );
    }

    const existingApp = await this.applicationRepository.findOne({
      where: { jobId, workerId },
    });
    if (existingApp) {
      throw new ConflictException(
        APPLICATION_ERRORS.APPLICATION_ALREADY_APPLIED,
      );
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
      {
        jobTitle: job.title,
        message: dto.coverLetter,
        applicationId: saved.id,
      },
    );

    if (job.postedById && job.postedById !== job.employerId) {
      await this.notificationHelper.send(
        job.postedById,
        NotificationType.JOB_APPLICATION_RECEIVED,
        jobId,
        {
          jobTitle: job.title,
          message: dto.coverLetter,
          applicationId: saved.id,
        },
      );
    }

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
      throw new ForbiddenException(
        APPLICATION_ERRORS.APPLICATION_ACCESS_FORBIDDEN,
      );
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

    if (application.job.postedById && application.job.postedById !== application.job.employerId) {
      await this.notificationHelper.send(
        application.job.postedById,
        NotificationType.APPLICATION_CANCELLED,
        application.jobId,
        { jobTitle: application.job.title, workerName: workerId, applicationId },
      );
    }

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
    if (application.job.employerId !== employerId && application.job.postedById !== employerId) {
      throw new ForbiddenException(
        APPLICATION_ERRORS.APPLICATION_ACCESS_FORBIDDEN,
      );
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

    application.status = ApplicationStatus.EMPLOYER_ACCEPTED;
    application.respondedAt = new Date();
    const saved = await this.applicationRepository.save(application);

    await this.notificationHelper.send(
      application.workerId,
      NotificationType.JOB_APPLICATION_ACCEPTED,
      application.id,
      {
        jobTitle: application.job.title,
        applicationId: application.id,
        jobId: application.jobId,
      },
    );

    return saved;
  }

  async respondApplicationAcceptance(
    applicationId: string,
    workerId: string,
    accept: boolean,
  ): Promise<JobApplication> {
    const application = await this.applicationRepository.findOne({
      where: { id: applicationId },
      relations: ['job'],
    });
    if (!application) {
      throw new NotFoundException(APPLICATION_ERRORS.APPLICATION_NOT_FOUND);
    }
    if (application.workerId !== workerId) {
      throw new ForbiddenException(
        APPLICATION_ERRORS.APPLICATION_ACCESS_FORBIDDEN,
      );
    }
    if (application.status !== ApplicationStatus.EMPLOYER_ACCEPTED) {
      throw new BadRequestException(APPLICATION_ERRORS.APPLICATION_NOT_PENDING);
    }

    if (!accept) {
      application.status = ApplicationStatus.CANCELLED;
      application.respondedAt = new Date();
      const cancelled = await this.applicationRepository.save(application);

      await this.notificationHelper.send(
        application.job.employerId,
        NotificationType.APPLICATION_CANCELLED,
        application.jobId,
        {
          jobTitle: application.job.title,
          applicationId,
        },
      );

      return cancelled;
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

    await this.notificationHelper.send(
      application.job.employerId,
      NotificationType.JOB_APPLICATION_ACCEPTED,
      application.id,
      {
        jobTitle: application.job.title,
        applicationId: application.id,
        jobId: application.jobId,
        message: 'Ứng viên đã đồng ý nhận việc. Công việc hiện đã bắt đầu!',
      },
    );

    if (
      application.job.postedById &&
      application.job.postedById !== application.job.employerId
    ) {
      await this.notificationHelper.send(
        application.job.postedById,
        NotificationType.JOB_APPLICATION_ACCEPTED,
        application.id,
        {
          jobTitle: application.job.title,
          applicationId: application.id,
          jobId: application.jobId,
          message: 'Ứng viên đã đồng ý nhận việc. Công việc hiện đã bắt đầu!',
        },
      );
    }

    if (acceptedCount + 1 >= application.job.requiredWorkers) {
      await this.jobRepository.update(application.jobId, {
        status: JobStatus.CLOSED,
      });
      this.aiSyncCronService
        .enqueueJobSync(application.jobId)
        .catch((err) =>
          console.warn(
            'Failed to enqueue AI embedding for closed job:',
            err?.message,
          ),
        );
      
      this.aiSyncCronService.deleteScamAnalysisCache(application.jobId);
    }

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
    if (application.job.employerId !== employerId && application.job.postedById !== employerId) {
      throw new ForbiddenException(
        APPLICATION_ERRORS.APPLICATION_ACCESS_FORBIDDEN,
      );
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
      {
        jobTitle: application.job.title,
        applicationId: application.id,
        jobId: application.jobId,
      },
    );

    return saved;
  }

  async getJobApplications(
    jobId: string,
    employerId: string,
    page = 1,
    limit = 10,
  ): Promise<{
    data: JobApplication[];
    total: number;
    page: number;
    limit: number;
  }> {
    const job = await this.findJobById(jobId);
    if (job.employerId !== employerId && job.postedById !== employerId) {
      throw new ForbiddenException(JOB_ERRORS.JOB_OWNER_FORBIDDEN);
    }

    const [data, total] = await this.applicationRepository
      .createQueryBuilder('app')
      .leftJoinAndSelect('app.worker', 'worker')
      .leftJoinAndMapOne(
        'worker.workerProfile',
        'WorkerProfile',
        'workerProfile',
        'workerProfile.userId = worker.id',
      )
      .leftJoinAndMapOne(
        'app.assignment',
        'JobAssignment',
        'assignment',
        'assignment.applicationId = app.id',
      )
      .where('app.jobId = :jobId', { jobId })
      .orderBy('app.appliedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  // ==================== WORKER HISTORY ====================

  async getWorkerJobHistory(
    workerId: string,
    page = 1,
    limit = 10,
  ): Promise<{
    data: JobApplication[];
    total: number;
    page: number;
    limit: number;
  }> {
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
    if (assignment.job.jobType && assignment.job.jobType !== JobType.GIG) {
      throw new BadRequestException(JOB_ERRORS.JOB_CHECK_IN_ONLY_GIG);
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
      {
        jobTitle: assignment.job.title,
        applicationId: assignment.applicationId,
      },
    );

    if (
      assignment.job.postedById &&
      assignment.job.postedById !== assignment.job.employerId
    ) {
      await this.notificationHelper.send(
        assignment.job.postedById,
        NotificationType.JOB_CHECKED_IN,
        jobId,
        {
          jobTitle: assignment.job.title,
          applicationId: assignment.applicationId,
        },
      );
    }

    return saved;
  }

  async completeJob(jobId: string, userId: string): Promise<JobAssignment> {
    const assignment = await this.assignmentRepository
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.job', 'job')
      .where('assignment.jobId = :jobId', { jobId })
      .andWhere('(assignment.workerId = :userId OR job.employerId = :userId)', {
        userId,
      })
      .getOne();

    if (!assignment) {
      throw new NotFoundException(APPLICATION_ERRORS.APPLICATION_NOT_FOUND);
    }
    const canComplete =
      assignment.status === AssignmentStatus.IN_PROGRESS ||
      assignment.status === AssignmentStatus.ASSIGNED;

    if (!canComplete) {
      throw new BadRequestException(
        APPLICATION_ERRORS.ASSIGNMENT_MUST_BE_IN_PROGRESS,
      );
    }

    const isEmployer = assignment.job.employerId === userId || assignment.job.postedById === userId;

    if (isEmployer) {
      assignment.status = AssignmentStatus.PAYMENT_SENT;
      await this.notificationHelper.send(
        assignment.workerId,
        NotificationType.JOB_COMPLETED,
        jobId,
        {
          jobTitle: assignment.job.title,
          message:
            'Người thuê đã xác nhận hoàn thành công việc và thanh toán. Vui lòng xác nhận đã nhận đủ tiền.',
          applicationId: assignment.applicationId,
        },
      );
    } else {
      assignment.status = AssignmentStatus.PAYMENT_PENDING;
      await this.notificationHelper.send(
        assignment.job.employerId,
        NotificationType.JOB_COMPLETED,
        jobId,
        {
          jobTitle: assignment.job.title,
          message:
            'Người làm đã đánh dấu công việc hoàn thành. Vui lòng kiểm tra và xác nhận thanh toán.',
          applicationId: assignment.applicationId,
        },
      );

      if (
        assignment.job.postedById &&
        assignment.job.postedById !== assignment.job.employerId
      ) {
        await this.notificationHelper.send(
          assignment.job.postedById,
          NotificationType.JOB_COMPLETED,
          jobId,
          {
            jobTitle: assignment.job.title,
            message:
              'Người làm đã đánh dấu công việc hoàn thành. Vui lòng kiểm tra và xác nhận thanh toán.',
            applicationId: assignment.applicationId,
          },
        );
      }
    }

    const saved = await this.assignmentRepository.save(assignment);
    return saved;
  }

  async completeJobByEmployer(jobId: string, employerId: string): Promise<Job> {
    const job = await this.findJobById(jobId);
    if (job.employerId !== employerId && job.postedById !== employerId) {
      throw new ForbiddenException(JOB_ERRORS.JOB_COMPLETE_EMPLOYER_ONLY);
    }

    if (job.status !== JobStatus.OPEN && job.status !== JobStatus.CLOSED) {
      throw new BadRequestException(JOB_ERRORS.JOB_NOT_OPEN);
    }

    // Block completing ONLINE + ESCROW jobs if escrow is not funded
    if (
      job.jobType === JobType.ONLINE &&
      (job as any).paymentMethod === PaymentMethod.ESCROW
    ) {
      const escrow = await this.escrowRepository.findOne({ where: { jobId } });
      if (!escrow || escrow.status === EscrowStatus.PENDING) {
        throw new BadRequestException(ESCROW_ERRORS.ESCROW_NOT_FUNDED);
      }
    }

    // Set job to COMPLETED
    job.status = JobStatus.COMPLETED as any;
    await this.jobRepository.save(job);

    // Also mark assignments as PAYMENT_SENT if Employer completes first
    // This allows the Worker to confirm receipt of money (P2P) or confirm completion (Escrow)
    const assignments = await this.assignmentRepository.find({
      where: { jobId },
    });
    for (const assignment of assignments) {
      if (
        assignment.status === AssignmentStatus.ASSIGNED ||
        assignment.status === AssignmentStatus.IN_PROGRESS ||
        assignment.status === AssignmentStatus.PAYMENT_PENDING
      ) {
        assignment.status = AssignmentStatus.PAYMENT_SENT;
        await this.assignmentRepository.save(assignment);
      }
    }

    return this.findJobById(jobId);
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
    const isEmployer = application.job.employerId === callerId || application.job.postedById === callerId;
    if (!isWorker && !isEmployer) {
      throw new ForbiddenException(
        APPLICATION_ERRORS.APPLICATION_ACCESS_FORBIDDEN,
      );
    }

    const assignment = await this.assignmentRepository.findOne({
      where: { applicationId },
    });

    // Build steps
    const steps = this.buildProgressSteps(
      application,
      assignment ?? null,
      application.job.jobType || JobType.GIG,
    );
    const currentStep = steps.filter((s) => s.status === 'done').length;

    // Worker profile with privacy filter
    const workerProfile = await this.workerProfileRepository.findOne({
      where: { userId: application.workerId },
      relations: ['workerSkills', 'workerSkills.skill'],
    });

    const isAccepted = [ApplicationStatus.ACCEPTED].includes(
      application.status,
    );
    const isWorking =
      assignment?.status === AssignmentStatus.IN_PROGRESS ||
      assignment?.status === AssignmentStatus.COMPLETED;

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
      phone:
        isAccepted || isWorking
          ? this.applyPrivacy(
              employerProfile?.phone ?? null,
              employerProfile?.privacySettings?.phone ??
                PrivacyVisibility.ACCEPTED_ONLY,
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
      jobType: application.job.jobType,
      salaryType: application.job.salaryType,
      totalBudget: application.job.totalBudget,
      onlinePaymentType: application.job.onlinePaymentType,
      paymentMethod: (application.job as any).paymentMethod,
      startTime:
        application.job.startTime ||
        application.job.deadline ||
        application.job.createdAt,
      endTime:
        application.job.endTime ||
        application.job.deadline ||
        application.job.createdAt,
      salaryPerHour: application.job.salaryPerHour || 0,
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
            loggedHours: assignment.loggedHours,
            hoursSubmittedBy: assignment.hoursSubmittedBy,
          }
        : null,
    };
  }

  async getJobProgress(
    jobId: string,
    employerId: string,
  ): Promise<{ total: number; workers: ApplicationProgress[] }> {
    const job = await this.findJobById(jobId);
    if (job.employerId !== employerId && job.postedById !== employerId) {
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
    jobType: JobType,
  ): ProgressStep[] {
    const isCancelled = application.status === ApplicationStatus.CANCELLED;
    const isRejected = application.status === ApplicationStatus.REJECTED;

    const baseSteps: ProgressStep[] = [
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
    ];

    if (jobType === JobType.GIG) {
      return [
        ...baseSteps,
        {
          key: 'CHECKED_IN',
          label: 'Check-in làm việc',
          status: assignment?.checkedInAt
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
            assignment?.status === AssignmentStatus.COMPLETED
              ? 'done'
              : 'pending',
          timestamp: assignment?.completedAt ?? null,
        },
      ];
    } else if (jobType === JobType.PART_TIME) {
      return [
        ...baseSteps,
        {
          key: 'IN_PROGRESS',
          label: 'Đang làm việc',
          status:
            assignment?.status === AssignmentStatus.IN_PROGRESS
              ? 'active'
              : assignment?.status === AssignmentStatus.COMPLETED
                ? 'done'
                : assignment?.status === AssignmentStatus.ASSIGNED
                  ? 'active' // Auto active once accepted
                  : 'pending',
          timestamp: assignment?.startedAt ?? null,
        },
        {
          key: 'COMPLETED',
          label: 'Kết thúc hợp đồng',
          status:
            assignment?.status === AssignmentStatus.COMPLETED
              ? 'done'
              : 'pending',
          timestamp: assignment?.completedAt ?? null,
        },
      ];
    } else {
      // ONLINE
      return [
        ...baseSteps,
        {
          key: 'MILESTONES',
          label: 'Thực hiện',
          status:
            assignment?.status === AssignmentStatus.IN_PROGRESS ||
            assignment?.status === AssignmentStatus.HOURS_SUBMITTED ||
            assignment?.status === AssignmentStatus.PAYMENT_PENDING ||
            assignment?.status === AssignmentStatus.PAYMENT_SENT ||
            assignment?.status === AssignmentStatus.ASSIGNED
              ? 'active'
              : assignment?.status === AssignmentStatus.COMPLETED
                ? 'done'
                : 'pending',
          timestamp: assignment?.startedAt ?? null,
        },
        {
          key: 'COMPLETED',
          label: 'Hoàn thành toàn bộ',
          status:
            assignment?.status === AssignmentStatus.COMPLETED
              ? 'done'
              : 'pending',
          timestamp: assignment?.completedAt ?? null,
        },
      ];
    }
  }

  private buildWorkerInfo(
    worker: {
      id: string;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
    },
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
      info.phone =
        phoneVis === PrivacyVisibility.PUBLIC ? (profile?.phone ?? null) : null;
    }

    // Address
    const addressVis = privacy.address ?? PrivacyVisibility.ACCEPTED_ONLY;
    info.address = this.applyPrivacy(
      profile?.address ?? null,
      addressVis,
      isAccepted,
    );

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

  // ==================== HOURLY PAYMENT WORKFLOW ====================

  async logHours(
    jobId: string,
    userId: string,
    loggedHours: number,
  ): Promise<JobAssignment> {
    const assignment = await this.assignmentRepository.findOne({
      where: {
        jobId,
        status: In([AssignmentStatus.IN_PROGRESS, AssignmentStatus.ASSIGNED]),
      },
      relations: ['job'],
    });

    if (!assignment) {
      throw new BadRequestException(APPLICATION_ERRORS.ASSIGNMENT_NOT_ACTIVE);
    }

    if (
      assignment.workerId !== userId &&
      assignment.job.employerId !== userId &&
      assignment.job.postedById !== userId
    ) {
      throw new ForbiddenException(
        APPLICATION_ERRORS.ASSIGNMENT_NOT_PARTICIPANT,
      );
    }

    assignment.loggedHours = loggedHours;
    assignment.hoursSubmittedBy = userId;
    assignment.status = AssignmentStatus.HOURS_SUBMITTED;

    await this.assignmentRepository.save(assignment);

    // Notify the other party
    const targetUserId =
      userId === assignment.workerId
        ? assignment.job.employerId
        : assignment.workerId;
    await this.notificationHelper.send(
      targetUserId,
      NotificationType.HOURS_LOGGED,
      assignment.jobId,
      {
        jobTitle: assignment.job.title,
        message: `Số giờ thực tế đã làm cho công việc "${assignment.job.title}" là ${loggedHours} giờ. Vui lòng xác nhận.`,
      },
    );

    if (
      userId === assignment.workerId &&
      assignment.job.postedById &&
      assignment.job.postedById !== assignment.job.employerId
    ) {
      await this.notificationHelper.send(
        assignment.job.postedById,
        NotificationType.HOURS_LOGGED,
        assignment.jobId,
        {
          jobTitle: assignment.job.title,
          message: `Số giờ thực tế đã làm cho công việc "${assignment.job.title}" là ${loggedHours} giờ. Vui lòng xác nhận.`,
        },
      );
    }

    return assignment;
  }

  async confirmHours(jobId: string, userId: string): Promise<JobAssignment> {
    const assignment = await this.assignmentRepository.findOne({
      where: { jobId, status: AssignmentStatus.HOURS_SUBMITTED },
      relations: ['job'],
    });

    if (!assignment) {
      throw new BadRequestException(
        APPLICATION_ERRORS.ASSIGNMENT_NOT_PENDING_HOURS,
      );
    }

    if (assignment.hoursSubmittedBy === userId) {
      throw new BadRequestException(
        APPLICATION_ERRORS.ASSIGNMENT_CONFIRM_OWN_HOURS,
      );
    }

    if (
      assignment.workerId !== userId &&
      assignment.job.employerId !== userId &&
      assignment.job.postedById !== userId
    ) {
      throw new ForbiddenException(
        APPLICATION_ERRORS.ASSIGNMENT_NOT_PARTICIPANT,
      );
    }

    // Check payment method. Note: If paymentMethod isn't explicitly P2P, we default to P2P logic here unless ESCROW is defined.
    // For this boilerplate, assuming P2P flow. If Escrow, we just complete it.
    if ((assignment.job.paymentMethod as any) === 'ESCROW' || (assignment.job.paymentMethod as any) === PaymentMethod.ESCROW) {
      assignment.status = AssignmentStatus.COMPLETED;
      assignment.completedAt = new Date();
      assignment.job.status = JobStatus.COMPLETED as any;
      await this.jobRepository.save(assignment.job);
      
      const application = await this.applicationRepository.findOne({
        where: { jobId: assignment.jobId, workerId: assignment.workerId },
        order: { appliedAt: 'DESC' }
      });
      if (application) {
        const escrow = await this.escrowRepository.findOne({
          where: { jobId: assignment.jobId, applicationId: application.id }
        });
        if (escrow) {
          await this.milestoneRepository.update(
            { escrowId: escrow.id },
            { status: MilestoneStatus.APPROVED, approvedAt: new Date() }
          );
        }
      }
    } else {
      assignment.status = AssignmentStatus.PAYMENT_PENDING;
    }

    await this.assignmentRepository.save(assignment);

    await this.notificationHelper.send(
      assignment.hoursSubmittedBy,
      NotificationType.JOB_COMPLETED,
      assignment.jobId,
      {
        jobTitle: assignment.job.title,
        message: `Số giờ làm việc cho công việc "${assignment.job.title}" đã được xác nhận.`,
      },
    );

    return assignment;
  }

  async markPaid(jobId: string, userId: string): Promise<JobAssignment> {
    const assignment = await this.assignmentRepository.findOne({
      where: { jobId, status: AssignmentStatus.PAYMENT_PENDING },
      relations: ['job'],
    });

    if (!assignment) {
      throw new BadRequestException(
        APPLICATION_ERRORS.ASSIGNMENT_NOT_PENDING_PAYMENT,
      );
    }

    if (assignment.job.employerId !== userId && assignment.job.postedById !== userId) {
      throw new ForbiddenException(
        APPLICATION_ERRORS.ASSIGNMENT_MARK_PAID_EMPLOYER_ONLY,
      );
    }

    // For ESCROW jobs, markPaid means Employer confirms the work is done, so we skip PAYMENT_SENT and go straight to COMPLETED.
    if ((assignment.job.paymentMethod as any) === PaymentMethod.ESCROW) {
      assignment.status = AssignmentStatus.COMPLETED;
      assignment.completedAt = new Date();
      assignment.job.status = JobStatus.COMPLETED as any;
      await this.jobRepository.save(assignment.job);
      
      const application = await this.applicationRepository.findOne({
        where: { jobId, workerId: assignment.workerId },
        order: { appliedAt: 'DESC' }
      });
      if (application) {
        const escrow = await this.escrowRepository.findOne({
          where: { jobId, applicationId: application.id }
        });
        if (escrow) {
          await this.milestoneRepository.update(
            { escrowId: escrow.id },
            { status: MilestoneStatus.APPROVED, approvedAt: new Date() }
          );
        }
      }
    } else {
      assignment.status = AssignmentStatus.PAYMENT_SENT;
    }

    await this.assignmentRepository.save(assignment);

    await this.notificationHelper.send(
      assignment.workerId,
      NotificationType.JOB_COMPLETED,
      assignment.jobId,
      {
        jobTitle: assignment.job.title,
        message: `Khách hàng báo đã thanh toán cho công việc "${assignment.job.title}". Vui lòng kiểm tra và xác nhận.`,
      },
    );

    return assignment;
  }

  async confirmPaymentReceipt(
    jobId: string,
    userId: string,
  ): Promise<JobAssignment> {
    const assignment = await this.assignmentRepository.findOne({
      where: { jobId, status: AssignmentStatus.PAYMENT_SENT },
      relations: ['job'],
    });

    if (!assignment) {
      throw new BadRequestException(
        APPLICATION_ERRORS.ASSIGNMENT_PAYMENT_NOT_SENT,
      );
    }

    if (assignment.workerId !== userId) {
      throw new ForbiddenException(
        APPLICATION_ERRORS.ASSIGNMENT_CONFIRM_RECEIPT_WORKER_ONLY,
      );
    }

    assignment.status = AssignmentStatus.COMPLETED;
    assignment.completedAt = new Date();
    await this.assignmentRepository.save(assignment);

    // Increment totalJobsCompleted on worker profile
    await this.workerProfileRepository
      .createQueryBuilder()
      .update(WorkerProfile)
      .set({ totalJobsCompleted: () => 'total_jobs_completed + 1' })
      .where('user_id = :workerId', { workerId: assignment.workerId })
      .execute();

    assignment.job.status = JobStatus.COMPLETED as any;
    await this.jobRepository.save(assignment.job);

    await this.notificationHelper.send(
      assignment.job.employerId,
      NotificationType.JOB_COMPLETED,
      assignment.jobId,
      {
        jobTitle: assignment.job.title,
        message: `Người làm đã xác nhận nhận đủ thanh toán. Công việc "${assignment.job.title}" đã hoàn thành!`,
        applicationId: assignment.applicationId,
      },
    );

    if (
      assignment.job.postedById &&
      assignment.job.postedById !== assignment.job.employerId
    ) {
      await this.notificationHelper.send(
        assignment.job.postedById,
        NotificationType.JOB_COMPLETED,
        assignment.jobId,
        {
          jobTitle: assignment.job.title,
          message: `Người làm đã xác nhận nhận đủ thanh toán. Công việc "${assignment.job.title}" đã hoàn thành!`,
          applicationId: assignment.applicationId,
        },
      );
    }

    return assignment;
  }
}
