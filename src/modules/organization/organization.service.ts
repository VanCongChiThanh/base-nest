import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from '../job/entities/job.entity';
import { JobApplication } from '../job/entities/job-application.entity';
import { JobAssignment } from '../job/entities/job-assignment.entity';
import { PaymentConfirmation } from '../payment/entities/payment-confirmation.entity';
import { Escrow } from '../payment/entities/escrow.entity';
import { JobStatus, PaymentStatus, EscrowStatus, JobSalaryType } from '../../common/enums';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,
    @InjectRepository(JobApplication)
    private readonly applicationRepo: Repository<JobApplication>,
    @InjectRepository(JobAssignment)
    private readonly assignmentRepo: Repository<JobAssignment>,
    @InjectRepository(PaymentConfirmation)
    private readonly paymentRepo: Repository<PaymentConfirmation>,
    @InjectRepository(Escrow)
    private readonly escrowRepo: Repository<Escrow>,
  ) {}

  async getDashboardStats(organizationId: string) {
    const activeJobsCount = await this.jobRepo.count({
      where: { employerId: organizationId, status: JobStatus.OPEN },
    });

    const applications = await this.applicationRepo
      .createQueryBuilder('app')
      .innerJoin('app.job', 'job')
      .where('job.employerId = :organizationId', { organizationId })
      .getMany();

    const totalSpentResult = await this.paymentRepo
      .createQueryBuilder('payment')
      .select('SUM(payment.amount)', 'total')
      .where('payment.employerId = :organizationId', { organizationId })
      .andWhere('payment.status = :status', { status: PaymentStatus.PAYMENT_CONFIRMED })
      .getRawOne();

    return {
      activeJobs: activeJobsCount,
      totalApplicants: applications.length,
      newApplicants: applications.length, // Simplified for now
      totalSpent: totalSpentResult?.total ? Number(totalSpentResult.total) : 0,
    };
  }

  async getFinanceStats(organizationId: string) {
    // --- Escrow balance (tiền đang giữ trong escrow) ---
    const escrows = await this.escrowRepo.find({
      where: { employerId: organizationId },
    });
    
    const escrowBalance = escrows.reduce((acc, curr) => {
      if (curr.status === EscrowStatus.FUNDED || curr.status === EscrowStatus.PARTIALLY_RELEASED) {
        return acc + (Number(curr.totalAmount) - Number(curr.releasedAmount));
      }
      return acc;
    }, 0);

    // --- Tổng chi qua Escrow ---
    const escrowSpentResult = await this.escrowRepo
      .createQueryBuilder('escrow')
      .select('SUM(escrow.totalAmount)', 'total')
      .where('escrow.employerId = :organizationId', { organizationId })
      .andWhere('escrow.status IN (:...statuses)', {
        statuses: [EscrowStatus.FUNDED, EscrowStatus.PARTIALLY_RELEASED, EscrowStatus.FULLY_RELEASED],
      })
      .getRawOne();

    // --- Tổng chi qua PaymentConfirmation (thanh toán trực tiếp P2P) ---
    // PaymentConfirmation.amount thường = 0 (không được set khi tạo),
    // nên phải lấy tiền từ Job (salaryPerHour hoặc totalBudget).
    const confirmedPayments = await this.paymentRepo.find({
      where: { employerId: organizationId, status: PaymentStatus.PAYMENT_CONFIRMED },
      relations: ['job'],
    });

    let totalPaymentSpent = 0;
    for (const p of confirmedPayments) {
      totalPaymentSpent += await this.getJobPaymentAmount(p);
    }

    const totalEscrowSpent = escrowSpentResult?.total ? Number(escrowSpentResult.total) : 0;

    return {
      balance: escrowBalance,
      totalEscrowSpent,
      totalPaymentSpent,
      totalSpent: totalEscrowSpent + totalPaymentSpent,
      monthlySubscription: 2500000, // Mock fixed subscription for layout
    };
  }

  async getTransactions(organizationId: string) {
    // --- Lấy Escrow transactions ---
    const escrows = await this.escrowRepo.find({
      where: { employerId: organizationId },
      relations: ['job'],
      order: { createdAt: 'DESC' },
    });

    const escrowTransactions = escrows.map((e) => ({
      id: e.id,
      date: e.createdAt.toISOString().split('T')[0],
      description: `Ký quỹ Escrow - ${e.job?.title ?? 'N/A'}`,
      amount: -Number(e.totalAmount),
      status: e.status,
      type: 'Escrow',
      createdAt: e.createdAt,
    }));

    // --- Lấy PaymentConfirmation transactions ---
    const payments = await this.paymentRepo.find({
      where: { employerId: organizationId },
      relations: ['job'],
      order: { createdAt: 'DESC' },
    });

    const paymentTransactions = await Promise.all(
      payments.map(async (p) => {
        const realAmount = await this.getJobPaymentAmount(p);
        return {
          id: p.id,
          date: p.createdAt.toISOString().split('T')[0],
          description: `Thanh toán - ${p.job?.title ?? 'N/A'}`,
          amount: -realAmount,
          status: p.status,
          type: p.type,
          createdAt: p.createdAt,
        };
      })
    );

    // --- Gộp + sắp xếp theo thời gian mới nhất ---
    const allTransactions = [...escrowTransactions, ...paymentTransactions]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20);

    // Loại bỏ field createdAt khỏi response
    return allTransactions.map(({ createdAt, ...rest }) => rest);
  }

  /**
   * Lấy số tiền thanh toán thực tế từ PaymentConfirmation & Job.
   * - ONLINE FIXED_PRICE: totalBudget
   * - GIG/PART_TIME (HOURLY): salaryPerHour * loggedHours
   * - GIG/PART_TIME (FIXED): salaryPerHour
   */
  private async getJobPaymentAmount(payment: PaymentConfirmation): Promise<number> {
    const job = payment.job;
    if (!job) return Number(payment.amount) || 0;
    
    // Ưu tiên totalBudget (online fixed price)
    if (job.totalBudget && Number(job.totalBudget) > 0) {
      return Number(job.totalBudget);
    }

    // Nếu có salaryPerHour
    if (job.salaryPerHour && Number(job.salaryPerHour) > 0) {
      // Nếu là job theo giờ, phải nhân với số giờ đã chốt (loggedHours)
      if (job.salaryType === JobSalaryType.HOURLY) {
        const assignment = await this.assignmentRepo.findOne({
          where: { jobId: job.id, workerId: payment.workerId }
        });
        const hours = assignment?.loggedHours ? Number(assignment.loggedHours) : 0;
        return Number(job.salaryPerHour) * hours;
      }
      // Nếu là job khoán
      return Number(job.salaryPerHour);
    }
    
    return Number(payment.amount) || 0;
  }
}

