import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentConfirmation, Dispute } from './entities';
import { ConfirmPaymentDto, CreateDisputeDto, ResolveDisputeDto } from './dto';
import { Job, JobAssignment } from '../job/entities';
import {
  PAYMENT_ERRORS,
  DISPUTE_ERRORS,
  JOB_ERRORS,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '../../common';
import {
  PaymentType,
  PaymentStatus,
  DisputeStatus,
  AssignmentStatus,
  NotificationType,
} from '../../common/enums';
import { NotificationHelper } from '../notification';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(PaymentConfirmation)
    private readonly paymentRepo: Repository<PaymentConfirmation>,
    @InjectRepository(Dispute)
    private readonly disputeRepo: Repository<Dispute>,
    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,
    @InjectRepository(JobAssignment)
    private readonly assignmentRepo: Repository<JobAssignment>,
    private readonly notificationHelper: NotificationHelper,
  ) {}

  // ==================== FINAL PAYMENT CONFIRMATION ====================

  async confirmFinalPayment(
    jobId: string,
    workerId: string,
    dto: ConfirmPaymentDto,
  ): Promise<PaymentConfirmation> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException(JOB_ERRORS.JOB_NOT_FOUND);

    // Verify worker is assigned
    const assignment = await this.assignmentRepo.findOne({
      where: { jobId, workerId, status: AssignmentStatus.COMPLETED },
    });
    if (!assignment) {
      throw new BadRequestException(PAYMENT_ERRORS.PAYMENT_JOB_NOT_COMPLETED);
    }

    // Check if already confirmed
    const existing = await this.paymentRepo.findOne({
      where: { jobId, workerId, type: PaymentType.FINAL_PAYMENT },
    });
    if (existing?.confirmedByWorker) {
      throw new ConflictException(PAYMENT_ERRORS.PAYMENT_ALREADY_CONFIRMED);
    }

    const payment =
      existing ||
      this.paymentRepo.create({
        jobId,
        workerId,
        employerId: job.employerId,
        type: PaymentType.FINAL_PAYMENT,
      });

    payment.confirmedByWorker = true;
    payment.confirmedAt = new Date();
    payment.status = PaymentStatus.PAYMENT_CONFIRMED;
    payment.note = dto.note ?? '';

    const saved = await this.paymentRepo.save(payment);

    // Notify employer
    await this.notificationHelper.send(
      job.employerId,
      NotificationType.PAYMENT_CONFIRMED,
      jobId,
      { jobTitle: job.title },
    );

    return saved;
  }

  // ==================== GET PAYMENT STATUS ====================

  async getPaymentsByJob(
    jobId: string,
    userId: string,
  ): Promise<PaymentConfirmation[]> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException(JOB_ERRORS.JOB_NOT_FOUND);

    // Only employer or assigned workers can view
    const payments = await this.paymentRepo.find({
      where: { jobId },
      relations: ['worker'],
      order: { createdAt: 'DESC' },
    });

    return payments;
  }

  async getMyPayments(
    workerId: string,
    page = 1,
    limit = 10,
  ): Promise<{
    data: PaymentConfirmation[];
    total: number;
    page: number;
    limit: number;
  }> {
    const [data, total] = await this.paymentRepo.findAndCount({
      where: { workerId },
      relations: ['job'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  // ==================== DISPUTES ====================

  async createDispute(
    jobId: string,
    userId: string,
    dto: CreateDisputeDto,
  ): Promise<Dispute> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException(JOB_ERRORS.JOB_NOT_FOUND);

    // Verify user is involved (employer or assigned worker)
    const isEmployer = job.employerId === userId;
    const assignment = await this.assignmentRepo.findOne({
      where: { jobId, workerId: userId },
    });
    if (!isEmployer && !assignment) {
      throw new ForbiddenException(DISPUTE_ERRORS.DISPUTE_NOT_INVOLVED);
    }

    // Check for existing open dispute
    const existing = await this.disputeRepo.findOne({
      where: { jobId, raisedById: userId, status: DisputeStatus.OPEN },
    });
    if (existing) {
      throw new ConflictException(DISPUTE_ERRORS.DISPUTE_ALREADY_EXISTS);
    }

    const dispute = this.disputeRepo.create({
      jobId,
      raisedById: userId,
      reason: dto.reason,
    });
    const saved = await this.disputeRepo.save(dispute);

    // Update related payment status to DISPUTED
    await this.paymentRepo.update(
      { jobId },
      { status: PaymentStatus.DISPUTED },
    );

    // Notify the other party
    const notifyUserId = isEmployer ? assignment?.workerId : job.employerId;
    if (notifyUserId) {
      await this.notificationHelper.send(
        notifyUserId,
        NotificationType.PAYMENT_DISPUTED,
        saved.id,
        { jobTitle: job.title },
      );
    }

    return saved;
  }

  async resolveDispute(
    disputeId: string,
    adminId: string,
    dto: ResolveDisputeDto,
  ): Promise<Dispute> {
    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
      relations: ['job'],
    });
    if (!dispute) throw new NotFoundException(DISPUTE_ERRORS.DISPUTE_NOT_FOUND);

    if (
      dispute.status === DisputeStatus.RESOLVED ||
      dispute.status === DisputeStatus.DISMISSED
    ) {
      throw new BadRequestException(DISPUTE_ERRORS.DISPUTE_ALREADY_RESOLVED);
    }

    dispute.status = DisputeStatus.RESOLVED;
    dispute.resolution = dto.resolution;
    dispute.resolvedById = adminId;
    dispute.resolvedAt = new Date();
    const saved = await this.disputeRepo.save(dispute);

    // Notify raiser
    await this.notificationHelper.send(
      dispute.raisedById,
      NotificationType.DISPUTE_RESOLVED,
      dispute.jobId,
      { jobTitle: dispute.job.title, resolution: dto.resolution },
    );

    return saved;
  }

  async dismissDispute(
    disputeId: string,
    adminId: string,
    dto: ResolveDisputeDto,
  ): Promise<Dispute> {
    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
      relations: ['job'],
    });
    if (!dispute) throw new NotFoundException(DISPUTE_ERRORS.DISPUTE_NOT_FOUND);

    if (
      dispute.status === DisputeStatus.RESOLVED ||
      dispute.status === DisputeStatus.DISMISSED
    ) {
      throw new BadRequestException(DISPUTE_ERRORS.DISPUTE_ALREADY_RESOLVED);
    }

    dispute.status = DisputeStatus.DISMISSED;
    dispute.resolution = dto.resolution;
    dispute.resolvedById = adminId;
    dispute.resolvedAt = new Date();
    const saved = await this.disputeRepo.save(dispute);

    await this.notificationHelper.send(
      dispute.raisedById,
      NotificationType.DISPUTE_RESOLVED,
      dispute.jobId,
      { jobTitle: dispute.job.title, resolution: dto.resolution },
    );

    return saved;
  }

  async getDisputes(
    page = 1,
    limit = 10,
    status?: DisputeStatus,
  ): Promise<{ data: Dispute[]; total: number; page: number; limit: number }> {
    const where = status ? { status } : {};
    const [data, total] = await this.disputeRepo.findAndCount({
      where,
      relations: ['job', 'raisedBy', 'resolvedBy'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async getDisputesByJob(jobId: string): Promise<Dispute[]> {
    return this.disputeRepo.find({
      where: { jobId },
      relations: ['raisedBy', 'resolvedBy'],
      order: { createdAt: 'DESC' },
    });
  }
}
