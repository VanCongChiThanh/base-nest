import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job, JobApplication, JobAssignment } from '../job/entities';
import { User } from '../user/entities';
import { PaymentConfirmation, Dispute } from '../payment/entities';
import { Report } from '../report/entities';
import { Review } from '../review/entities';
import {
  JobStatus,
  ApplicationStatus,
  AssignmentStatus,
  PaymentStatus,
  DisputeStatus,
  ReportStatus,
} from '../../common/enums';

export interface DashboardStats {
  overview: {
    totalUsers: number;
    totalJobs: number;
    totalApplications: number;
    totalCompletedJobs: number;
    totalReviews: number;
    openDisputes: number;
    pendingReports: number;
  };
  jobsByStatus: { status: string; count: number }[];
  recentJobs: Job[];
  recentUsers: User[];
}

@Injectable()
export class AdminStatsService {
  constructor(
    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,
    @InjectRepository(JobApplication)
    private readonly applicationRepo: Repository<JobApplication>,
    @InjectRepository(JobAssignment)
    private readonly assignmentRepo: Repository<JobAssignment>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(PaymentConfirmation)
    private readonly paymentRepo: Repository<PaymentConfirmation>,
    @InjectRepository(Dispute)
    private readonly disputeRepo: Repository<Dispute>,
    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
  ) {}

  async getDashboardStats(): Promise<DashboardStats> {
    const [
      totalUsers,
      totalJobs,
      totalApplications,
      totalCompletedJobs,
      totalReviews,
      openDisputes,
      pendingReports,
    ] = await Promise.all([
      this.userRepo.count(),
      this.jobRepo.count(),
      this.applicationRepo.count(),
      this.assignmentRepo.count({
        where: { status: AssignmentStatus.COMPLETED },
      }),
      this.reviewRepo.count(),
      this.disputeRepo.count({
        where: { status: DisputeStatus.OPEN },
      }),
      this.reportRepo.count({
        where: { status: ReportStatus.PENDING },
      }),
    ]);

    // Jobs by status
    const jobsByStatusRaw = await this.jobRepo
      .createQueryBuilder('job')
      .select('job.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('job.status')
      .getRawMany();

    const jobsByStatus = jobsByStatusRaw.map((r) => ({
      status: r.status,
      count: parseInt(r.count, 10),
    }));

    // Recent jobs
    const recentJobs = await this.jobRepo.find({
      relations: ['employer', 'category'],
      order: { createdAt: 'DESC' },
      take: 5,
    });

    // Recent users
    const recentUsers = await this.userRepo.find({
      order: { createdAt: 'DESC' },
      take: 5,
    });

    return {
      overview: {
        totalUsers,
        totalJobs,
        totalApplications,
        totalCompletedJobs,
        totalReviews,
        openDisputes,
        pendingReports,
      },
      jobsByStatus,
      recentJobs,
      recentUsers,
    };
  }

  // ==================== ADMIN JOB MANAGEMENT ====================

  async findAllJobs(
    page = 1,
    limit = 10,
    status?: string,
    search?: string,
  ): Promise<{ data: Job[]; total: number; page: number; limit: number }> {
    const qb = this.jobRepo
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.employer', 'employer')
      .leftJoinAndSelect('job.category', 'category');

    if (status) {
      qb.andWhere('job.status = :status', { status });
    }
    if (search) {
      qb.andWhere(
        '(job.title ILIKE :search OR job.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.orderBy('job.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async closeJob(jobId: string): Promise<Job> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new Error('Job not found');
    job.status = JobStatus.CLOSED;
    return this.jobRepo.save(job);
  }

  async deleteJob(jobId: string): Promise<void> {
    await this.jobRepo.delete(jobId);
  }

  // ==================== ADMIN PAYMENT OVERVIEW ====================

  async getPaymentOverview(
    page = 1,
    limit = 10,
    status?: string,
  ): Promise<{
    data: PaymentConfirmation[];
    total: number;
    page: number;
    limit: number;
  }> {
    const where = status ? { status: status as PaymentStatus } : {};
    const [data, total] = await this.paymentRepo.findAndCount({
      where,
      relations: ['job', 'worker'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }
}
