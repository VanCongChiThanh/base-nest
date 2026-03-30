import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './entities';
import { CreateReportDto, UpdateReportDto } from './dto';
import {
  REPORT_ERRORS,
  NotFoundException,
  BadRequestException,
} from '../../common';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
  ) {}

  async create(reporterId: string, dto: CreateReportDto): Promise<Report> {
    if (reporterId === dto.reportedUserId) {
      throw new BadRequestException(REPORT_ERRORS.REPORT_SELF_REPORT);
    }

    const report = this.reportRepository.create({
      ...dto,
      reporterId,
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
