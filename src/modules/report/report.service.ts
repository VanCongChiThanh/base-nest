import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './entities';
import { CreateReportDto, UpdateReportDto } from './dto';
import {
  REPORT_ERRORS,
  JOB_ERRORS,
  NotFoundException,
  BadRequestException,
} from '../../common';
import { Job } from '../job/entities';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
  ) {}

  async create(reporterId: string, dto: CreateReportDto): Promise<Report> {
    let reportedUserId: string;
    let jobId: string | undefined;

    if (dto.targetType === 'USER') {
      reportedUserId = dto.targetId;
    } else if (dto.targetType === 'JOB') {
      jobId = dto.targetId;
      const job = await this.jobRepository.findOne({ where: { id: jobId } });
      if (!job) {
        throw new NotFoundException(JOB_ERRORS.JOB_NOT_FOUND);
      }
      reportedUserId = job.postedById || job.employerId;
      if (!reportedUserId) {
        throw new BadRequestException(REPORT_ERRORS.REPORT_JOB_OWNER_NOT_FOUND);
      }
    } else {
      throw new BadRequestException(REPORT_ERRORS.REPORT_INVALID_TARGET_TYPE);
    }

    if (reporterId === reportedUserId) {
      throw new BadRequestException(REPORT_ERRORS.REPORT_SELF_REPORT);
    }

    const report = this.reportRepository.create({
      reason: dto.reason,
      description: dto.description,
      reporterId,
      reportedUserId,
      jobId,
    });
    return this.reportRepository.save(report);
  }

  async findAll(
    page = 1,
    limit = 10,
    status?: string,
  ): Promise<{ data: Report[]; total: number; page: number; limit: number }> {
    const qb = this.reportRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.reporter', 'reporter')
      .leftJoinAndSelect('report.reportedUser', 'reportedUser')
      .leftJoinAndSelect('report.job', 'job');

    if (status) {
      qb.where('report.status = :status', { status });
    }

    qb.orderBy('report.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findById(id: string): Promise<Report> {
    const report = await this.reportRepository.findOne({
      where: { id },
      relations: ['reporter', 'reportedUser', 'job'],
    });
    if (!report) {
      throw new NotFoundException(REPORT_ERRORS.REPORT_NOT_FOUND);
    }
    return report;
  }

  async update(id: string, dto: UpdateReportDto): Promise<Report> {
    const report = await this.findById(id);
    Object.assign(report, dto);
    return this.reportRepository.save(report);
  }
}
