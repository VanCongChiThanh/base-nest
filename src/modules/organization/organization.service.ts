import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from '../job/entities/job.entity';
import { JobApplication } from '../job/entities/job-application.entity';
import { PaymentConfirmation } from '../payment/entities/payment-confirmation.entity';
import { Escrow } from '../payment/entities/escrow.entity';
import { JobStatus, PaymentStatus, EscrowStatus } from '../../common/enums';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,
    @InjectRepository(JobApplication)
    private readonly applicationRepo: Repository<JobApplication>,
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
    const escrows = await this.escrowRepo.find({
      where: { employerId: organizationId },
    });
    
    // Balance is total funded minus released minus refunded.
    const balance = escrows.reduce((acc, curr) => {
      if (curr.status === EscrowStatus.FUNDED || curr.status === EscrowStatus.PARTIALLY_RELEASED) {
        return acc + (Number(curr.totalAmount) - Number(curr.releasedAmount));
      }
      return acc;
    }, 0);

    const monthlySpentResult = await this.escrowRepo
      .createQueryBuilder('escrow')
      .select('SUM(escrow.totalAmount)', 'total')
      .where('escrow.employerId = :organizationId', { organizationId })
      .andWhere('escrow.status IN (:...statuses)', { statuses: [EscrowStatus.FUNDED, EscrowStatus.PARTIALLY_RELEASED, EscrowStatus.FULLY_RELEASED] })
      .getRawOne();

    return {
      balance: balance,
      monthlySpent: monthlySpentResult?.total ? Number(monthlySpentResult.total) : 0,
      monthlySubscription: 2500000, // Mock fixed subscription for layout
    };
  }

  async getTransactions(organizationId: string) {
    const escrows = await this.escrowRepo.find({
      where: { employerId: organizationId },
      relations: ['job'],
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return escrows.map((e) => ({
      id: e.id,
      date: e.createdAt.toISOString().split('T')[0],
      description: `Thanh toán Escrow - ${e.job.title}`,
      amount: -Number(e.totalAmount),
      status: e.status,
      type: 'Escrow',
    }));
  }
}
