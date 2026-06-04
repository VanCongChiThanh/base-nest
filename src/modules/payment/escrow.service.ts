import { Injectable, Logger, Inject } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { PayOS } from '@payos/node';
import { Repository, DataSource } from 'typeorm';
import {
  EscrowStatus,
  MilestoneStatus,
  NotificationType,
  JobType,
  JobStatus,
  AssignmentStatus,
} from '../../common/enums';
import payosConfig from '../../config/payos.config';
import { Job, JobAssignment } from '../job/entities';
import { NotificationHelper } from '../notification';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '../../common/exceptions/business.exception';
import {
  ESCROW_ERRORS,
  MILESTONE_ERRORS,
  JOB_ERRORS,
  SUBSCRIPTION_ERRORS,
} from '../../common/constants/error-codes.constant';
import { Escrow, Milestone } from './entities';
import {
  CreateEscrowDto,
  SubmitMilestoneDto,
  ReviewMilestoneDto,
  ReleaseMilestoneDto,
  ProposeMilestoneDto,
} from './dto';

const SERVICE_FEE_RATE = 0.05; // 5% phí dịch vụ

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);
  private payosClient: PayOS | null = null;

  constructor(
    @Inject(payosConfig.KEY)
    private readonly payosConf: ConfigType<typeof payosConfig>,
    @InjectRepository(Escrow)
    private readonly escrowRepo: Repository<Escrow>,
    @InjectRepository(Milestone)
    private readonly milestoneRepo: Repository<Milestone>,
    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,
    @InjectRepository(JobAssignment)
    private readonly assignmentRepo: Repository<JobAssignment>,
    private readonly notificationHelper: NotificationHelper,
    private readonly dataSource: DataSource,
  ) {}

  private getPayOSClient(): PayOS {
    if (!this.payosClient) {
      if (!this.payosConf.clientId || !this.payosConf.apiKey || !this.payosConf.checksumKey) {
        throw new BadRequestException(SUBSCRIPTION_ERRORS.PAYMENT_CONFIG_ERROR);
      }
      this.payosClient = new PayOS({
        clientId: this.payosConf.clientId,
        apiKey: this.payosConf.apiKey,
        checksumKey: this.payosConf.checksumKey,
      });
    }
    return this.payosClient;
  }

  // ==================== TẠO ESCROW ====================

  /**
   * Employer tạo escrow + milestones cho job ONLINE
   * → Tạo PayOS link để employer thanh toán ký quỹ
   */
  async createEscrow(employerId: string, dto: CreateEscrowDto) {
    const job = await this.jobRepo.findOne({ where: { id: dto.jobId } });
    if (!job) throw new NotFoundException(JOB_ERRORS.JOB_NOT_FOUND);
    if (job.employerId !== employerId) {
      throw new ForbiddenException(JOB_ERRORS.JOB_OWNER_FORBIDDEN);
    }
    if (job.jobType !== JobType.ONLINE) {
      throw new BadRequestException(ESCROW_ERRORS.ESCROW_JOB_NOT_ONLINE);
    }
    if (!dto.milestones || dto.milestones.length === 0) {
      throw new BadRequestException(MILESTONE_ERRORS.MILESTONE_LIMIT_EXCEEDED);
    }

    // Kiểm tra đã có escrow chưa
    const existing = await this.escrowRepo.findOne({ where: { jobId: dto.jobId } });
    if (existing) {
      if (existing.status === EscrowStatus.PENDING) {
        await this.escrowRepo.remove(existing);
      } else {
        throw new BadRequestException(ESCROW_ERRORS.ESCROW_ALREADY_EXISTS);
      }
    }

    const totalAmount = dto.milestones.reduce((s, m) => s + m.amount, 0);
    const serviceFee = Math.round(totalAmount * SERVICE_FEE_RATE);
    const chargeAmount = totalAmount + serviceFee;

    // Tạo order code unique
    const orderCode = Number(
      String(Date.now()).slice(-7) + String(Math.floor(Math.random() * 100)).padStart(2, '0'),
    );

    const escrow = this.escrowRepo.create({
      jobId: dto.jobId,
      employerId,
      totalAmount,
      serviceFee,
      chargeAmount,
      releasedAmount: 0,
      status: EscrowStatus.PENDING,
      payosOrderCode: orderCode,
    });
    const savedEscrow = await this.escrowRepo.save(escrow);

    // Tạo milestones
    const milestones = dto.milestones.map((m, idx) =>
      this.milestoneRepo.create({
        escrowId: savedEscrow.id,
        orderIndex: idx + 1,
        title: m.title,
        description: m.description,
        amount: m.amount,
        status: MilestoneStatus.PENDING,
        proposalAccepted: true,
      }),
    );
    await this.milestoneRepo.save(milestones);

    // Tạo PayOS payment link
    const payos = this.getPayOSClient();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    try {
      const paymentLinkRes = await payos.paymentRequests.create({
        orderCode,
        amount: chargeAmount,
        description: `Ky quy ${job.title}`.substring(0, 25),
        returnUrl: `${frontendUrl}/jobs/${dto.jobId}/escrow/result`,
        cancelUrl: `${frontendUrl}/jobs/${dto.jobId}/escrow/result`,
      });

      savedEscrow.payosPaymentLinkId = paymentLinkRes.paymentLinkId;
      savedEscrow.payosCheckoutUrl = paymentLinkRes.checkoutUrl;
      await this.escrowRepo.save(savedEscrow);

      return {
        escrowId: savedEscrow.id,
        totalAmount,
        serviceFee,
        chargeAmount,
        checkoutUrl: paymentLinkRes.checkoutUrl,
        milestones: milestones.map((m, idx) => ({
          id: milestones[idx].id,
          orderIndex: m.orderIndex,
          title: m.title,
          amount: m.amount,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to create PayOS payment link for escrow', error);
      await this.escrowRepo.remove(savedEscrow);
      throw new BadRequestException(ESCROW_ERRORS.ESCROW_PAYOS_ERROR);
    }
  }

  // ==================== XỬ LÝ WEBHOOK DEPOSIT ====================

  /**
   * Gọi từ webhook khi PayOS xác nhận employer đã thanh toán
   * orderCode → identify escrow vs subscription bằng cách tra DB
   */
  async handleEscrowDeposit(orderCode: number, amountReceived?: number): Promise<boolean> {
    const escrow = await this.escrowRepo.findOne({
      where: { payosOrderCode: orderCode },
      relations: ['job'],
    });
    if (!escrow) return false; // Không phải escrow deposit

    if (escrow.status === EscrowStatus.FUNDED) {
      this.logger.warn(`Escrow ${escrow.id} already funded, ignoring duplicate webhook`);
      return true;
    }

    if (amountReceived !== undefined && amountReceived < Number(escrow.totalAmount)) {
      this.logger.warn(`Escrow ${escrow.id} underpaid. Expected ${escrow.totalAmount}, received ${amountReceived}`);
      return true; // Return true to ack webhook but do NOT fund it
    }

    escrow.status = EscrowStatus.FUNDED;
    escrow.fundedAt = new Date();
    await this.escrowRepo.save(escrow);

    // Cập nhật tất cả milestones sang IN_PROGRESS (worker có thể bắt đầu)
    await this.milestoneRepo.update(
      { escrowId: escrow.id, status: MilestoneStatus.PENDING },
      { status: MilestoneStatus.IN_PROGRESS },
    );

    // Thông báo cho worker(s) được assign job
    const assignments = await this.assignmentRepo.find({
      where: { jobId: escrow.jobId },
    });
    for (const assignment of assignments) {
      await this.notificationHelper.send(
        assignment.workerId,
        NotificationType.ESCROW_DEPOSITED,
        escrow.id,
        { jobTitle: escrow.job?.title ?? '', jobId: escrow.jobId },
      );
    }

    this.logger.log(`Escrow ${escrow.id} funded successfully`);
    return true;
  }

  /**
   * Sync PayOS status cho escrow (polling fallback)
   */
  async syncEscrowDepositStatus(orderCode: number) {
    const escrow = await this.escrowRepo.findOne({ where: { payosOrderCode: orderCode } });
    if (!escrow) throw new NotFoundException(ESCROW_ERRORS.ESCROW_NOT_FOUND);
    if (escrow.status === EscrowStatus.FUNDED) return { status: 'FUNDED', escrowId: escrow.id };

    const payos = this.getPayOSClient();
    try {
      const paymentLink = await payos.paymentRequests.get(orderCode);
      if (paymentLink.status === 'PAID' || paymentLink.amountRemaining === 0) {
        await this.handleEscrowDeposit(orderCode);
        return { status: 'FUNDED', escrowId: escrow.id };
      }
      return { status: paymentLink.status, escrowId: escrow.id };
    } catch (error) {
      this.logger.error(`Failed to sync PayOS escrow order ${orderCode}`, error);
      return { status: 'UNKNOWN', escrowId: escrow.id };
    }
  }

  // ==================== GET ESCROW ====================

  async getAdminMilestones(page: number = 1, limit: number = 10, status?: string) {
    const query = this.milestoneRepo.createQueryBuilder('milestone')
      .leftJoinAndSelect('milestone.escrow', 'escrow')
      .leftJoinAndSelect('escrow.job', 'job')
      .leftJoinAndSelect('milestone.worker', 'worker')
      .leftJoinAndSelect('worker.bankAccounts', 'bankAccounts')
      .orderBy('milestone.createdAt', 'DESC');

    if (status) {
      query.andWhere('milestone.status = :status', { status });
    }

    const [data, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async getEscrowByJob(jobId: string, requesterId: string) {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException(JOB_ERRORS.JOB_NOT_FOUND);

    const isEmployer = job.employerId === requesterId;
    const assignment = await this.assignmentRepo.findOne({
      where: { jobId, workerId: requesterId },
    });
    if (!isEmployer && !assignment) {
      throw new ForbiddenException(JOB_ERRORS.JOB_OWNER_FORBIDDEN);
    }

    const escrow = await this.escrowRepo.findOne({
      where: { jobId },
      relations: ['milestones'],
    });
    if (!escrow) throw new NotFoundException(ESCROW_ERRORS.ESCROW_NOT_FOUND);

    escrow.milestones = escrow.milestones.sort((a, b) => a.orderIndex - b.orderIndex);
    return escrow;
  }

  // ==================== WORKER: NỘP DELIVERABLE ====================

  async submitMilestone(milestoneId: string, workerId: string, dto: SubmitMilestoneDto) {
    const milestone = await this.milestoneRepo.findOne({
      where: { id: milestoneId },
      relations: ['escrow', 'escrow.job'],
    });
    if (!milestone) throw new NotFoundException(MILESTONE_ERRORS.MILESTONE_NOT_FOUND);
    if (milestone.escrow.status !== EscrowStatus.FUNDED) {
      throw new BadRequestException(ESCROW_ERRORS.ESCROW_NOT_FUNDED);
    }

    // Kiểm tra worker có liên quan job
    const assignment = await this.assignmentRepo.findOne({
      where: { jobId: milestone.escrow.jobId, workerId },
    });
    if (!assignment) {
      throw new ForbiddenException(MILESTONE_ERRORS.MILESTONE_ACCESS_FORBIDDEN);
    }

    if (
      milestone.status !== MilestoneStatus.IN_PROGRESS &&
      milestone.status !== MilestoneStatus.REVISION_REQUESTED
    ) {
      throw new BadRequestException(MILESTONE_ERRORS.MILESTONE_WRONG_STATUS);
    }

    milestone.status = MilestoneStatus.SUBMITTED;
    milestone.submissionNote = dto.note ?? '';
    milestone.submittedAt = new Date();
    milestone.workerId = workerId;
    await this.milestoneRepo.save(milestone);

    // Notify employer
    await this.notificationHelper.send(
      milestone.escrow.employerId,
      NotificationType.MILESTONE_SUBMITTED,
      milestone.id,
      {
        milestoneTitle: milestone.title,
        jobTitle: milestone.escrow.job?.title ?? '',
        jobId: milestone.escrow.jobId,
      },
    );

    return milestone;
  }

  // ==================== EMPLOYER: DUYỆT / YÊU CẦU SỬA ====================

  async reviewMilestone(milestoneId: string, employerId: string, dto: ReviewMilestoneDto) {
    const milestone = await this.milestoneRepo.findOne({
      where: { id: milestoneId },
      relations: ['escrow', 'escrow.job'],
    });
    if (!milestone) throw new NotFoundException(MILESTONE_ERRORS.MILESTONE_NOT_FOUND);
    if (milestone.escrow.employerId !== employerId) {
      throw new ForbiddenException(MILESTONE_ERRORS.MILESTONE_ACCESS_FORBIDDEN);
    }
    if (milestone.status !== MilestoneStatus.SUBMITTED) {
      throw new BadRequestException(MILESTONE_ERRORS.MILESTONE_WRONG_STATUS);
    }

    if (dto.action === 'approve') {
      milestone.status = MilestoneStatus.APPROVED;
      milestone.approvedAt = new Date();

      await this.milestoneRepo.save(milestone);

      // Notify worker: đã duyệt, chờ giải ngân
      if (milestone.workerId) {
        await this.notificationHelper.send(
          milestone.workerId,
          NotificationType.MILESTONE_APPROVED,
          milestone.id,
          {
            milestoneTitle: milestone.title,
            amount: milestone.amount,
            jobTitle: milestone.escrow.job?.title ?? '',
            jobId: milestone.escrow.jobId,
          },
        );
      }
    } else {
      milestone.status = MilestoneStatus.REVISION_REQUESTED;
      milestone.revisionNote = dto.note ?? '';

      await this.milestoneRepo.save(milestone);

      // Notify worker: yêu cầu sửa
      if (milestone.workerId) {
        await this.notificationHelper.send(
          milestone.workerId,
          NotificationType.MILESTONE_REVISION_REQUESTED,
          milestone.id,
          {
            milestoneTitle: milestone.title,
            note: dto.note ?? '',
            jobTitle: milestone.escrow.job?.title ?? '',
            jobId: milestone.escrow.jobId,
          },
        );
      }
    }

    return milestone;
  }

  // ==================== ADMIN: GIẢI NGÂN ====================

  async releaseMilestonePayment(milestoneId: string, adminId: string, dto: ReleaseMilestoneDto) {
    const milestone = await this.milestoneRepo.findOne({
      where: { id: milestoneId },
      relations: ['escrow', 'escrow.job'],
    });
    if (!milestone) throw new NotFoundException(MILESTONE_ERRORS.MILESTONE_NOT_FOUND);
    if (milestone.status === MilestoneStatus.RELEASED) {
      throw new BadRequestException(MILESTONE_ERRORS.MILESTONE_ALREADY_RELEASED);
    }
    if (milestone.status !== MilestoneStatus.APPROVED) {
      throw new BadRequestException(MILESTONE_ERRORS.MILESTONE_WRONG_STATUS);
    }

    milestone.status = MilestoneStatus.RELEASED;
    milestone.releasedAt = new Date();
    milestone.releaseNote = dto.note ?? '';
    await this.milestoneRepo.save(milestone);

    // Cập nhật released_amount trên escrow
    const escrow = milestone.escrow;
    escrow.releasedAmount = Number(escrow.releasedAmount) + Number(milestone.amount);

    // Kiểm tra có phải milestone cuối cùng không
    const allMilestones = await this.milestoneRepo.find({ where: { escrowId: escrow.id } });
    const allReleased = allMilestones.every(
      (m) => m.id === milestoneId || m.status === MilestoneStatus.RELEASED,
    );
    escrow.status = allReleased ? EscrowStatus.FULLY_RELEASED : EscrowStatus.PARTIALLY_RELEASED;
    await this.escrowRepo.save(escrow);

    if (allReleased) {
      await this.jobRepo.update({ id: escrow.jobId }, { status: JobStatus.SETTLED as any });
    }

    // Notify worker
    if (milestone.workerId) {
      await this.notificationHelper.send(
        milestone.workerId,
        NotificationType.MILESTONE_RELEASED,
        milestone.id,
        {
          milestoneTitle: milestone.title,
          amount: milestone.amount,
          jobTitle: milestone.escrow.job?.title ?? '',
          jobId: milestone.escrow.jobId,
        },
      );
    }

    this.logger.log(`Admin ${adminId} released milestone ${milestoneId}`);
    return milestone;
  }

  // ==================== ADMIN: HOÀN TIỀN ====================

  async refundEscrow(escrowId: string, adminId: string, reason: string) {
    const escrow = await this.escrowRepo.findOne({
      where: { id: escrowId },
      relations: ['job'],
    });
    if (!escrow) throw new NotFoundException(ESCROW_ERRORS.ESCROW_NOT_FOUND);

    if (
      escrow.status !== EscrowStatus.FUNDED &&
      escrow.status !== EscrowStatus.PARTIALLY_RELEASED &&
      escrow.status !== EscrowStatus.DISPUTED
    ) {
      throw new BadRequestException(ESCROW_ERRORS.ESCROW_CANNOT_REFUND);
    }

    escrow.status = EscrowStatus.REFUNDED;
    await this.escrowRepo.save(escrow);

    // Thông báo employer
    await this.notificationHelper.send(
      escrow.employerId,
      NotificationType.ESCROW_REFUNDED,
      escrow.id,
      {
        jobTitle: escrow.job?.title ?? '',
        reason,
        jobId: escrow.jobId,
      },
    );

    this.logger.log(`Admin ${adminId} refunded escrow ${escrowId}`);
    return { success: true, escrowId };
  }

  // ==================== WORKER: ĐỀ XUẤT MILESTONE ====================

  async proposeMilestone(
    jobId: string,
    workerId: string,
    dto: ProposeMilestoneDto,
  ) {
    const escrow = await this.escrowRepo.findOne({
      where: { jobId },
      relations: ['milestones', 'job'],
    });
    if (!escrow) throw new NotFoundException(ESCROW_ERRORS.ESCROW_NOT_FOUND);
    if (escrow.status !== EscrowStatus.FUNDED && escrow.status !== EscrowStatus.PARTIALLY_RELEASED) {
      throw new BadRequestException(ESCROW_ERRORS.ESCROW_NOT_FUNDED);
    }

    const assignment = await this.assignmentRepo.findOne({
      where: { jobId, workerId },
    });
    if (!assignment) {
      throw new ForbiddenException(MILESTONE_ERRORS.MILESTONE_ACCESS_FORBIDDEN);
    }

    const maxOrder = Math.max(0, ...escrow.milestones.map((m) => m.orderIndex));
    const milestone = this.milestoneRepo.create({
      escrowId: escrow.id,
      orderIndex: maxOrder + 1,
      title: dto.title,
      description: dto.description,
      amount: dto.amount ?? 0,
      status: MilestoneStatus.PENDING,
      workerId,
      proposedByWorker: true,
      proposalAccepted: false, // Cần employer duyệt
    });
    await this.milestoneRepo.save(milestone);

    // Notify employer
    await this.notificationHelper.send(
      escrow.employerId,
      NotificationType.MILESTONE_PROPOSED,
      milestone.id,
      {
        milestoneTitle: dto.title,
        jobTitle: escrow.job?.title ?? '',
        jobId: escrow.jobId,
      },
    );

    return milestone;
  }

  /** Employer chấp nhận hoặc từ chối đề xuất milestone từ worker */
  async respondToProposal(
    milestoneId: string,
    employerId: string,
    accept: boolean,
  ) {
    const milestone = await this.milestoneRepo.findOne({
      where: { id: milestoneId },
      relations: ['escrow'],
    });
    if (!milestone) throw new NotFoundException(MILESTONE_ERRORS.MILESTONE_NOT_FOUND);
    if (milestone.escrow.employerId !== employerId) {
      throw new ForbiddenException(MILESTONE_ERRORS.MILESTONE_ACCESS_FORBIDDEN);
    }
    if (!milestone.proposedByWorker || milestone.proposalAccepted) {
      throw new BadRequestException(MILESTONE_ERRORS.MILESTONE_WRONG_STATUS);
    }

    if (accept) {
      milestone.proposalAccepted = true;
      milestone.status = MilestoneStatus.IN_PROGRESS;
    } else {
      // Xoá milestone bị từ chối
      await this.milestoneRepo.remove(milestone);
      return { accepted: false };
    }
    await this.milestoneRepo.save(milestone);
    return { accepted: true, milestone };
  }

  // ==================== WORKER: XÁC NHẬN ĐÃ NHẬN TIỀN ====================

  async confirmMilestoneReceipt(milestoneId: string, workerId: string) {
    const milestone = await this.milestoneRepo.findOne({ where: { id: milestoneId } });
    if (!milestone) throw new NotFoundException(MILESTONE_ERRORS.MILESTONE_NOT_FOUND);
    if (milestone.workerId !== workerId) throw new ForbiddenException(MILESTONE_ERRORS.MILESTONE_ACCESS_FORBIDDEN);
    if (milestone.status !== MilestoneStatus.RELEASED) {
      throw new BadRequestException(MILESTONE_ERRORS.MILESTONE_WRONG_STATUS);
    }
    
    milestone.workerReceivedAt = new Date();
    await this.milestoneRepo.save(milestone);
    
    return milestone;
  }
}
