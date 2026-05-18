import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkerServiceEntity } from './entities/worker-service.entity';
import { CreateWorkerServiceDto, UpdateWorkerServiceDto, WorkerServiceQueryDto } from './dto';

import { DirectHireDto } from './dto';
import { JobService } from '../job/job.service';
import { AiSyncCronService } from '../ai/ai-sync-cron.service';
import {
  ForbiddenException,
  NotFoundException,
  WORKER_SERVICE_ERRORS,
} from '../../common';

@Injectable()
export class WorkerServiceService {
  constructor(
    @InjectRepository(WorkerServiceEntity)
    private readonly workerServiceRepo: Repository<WorkerServiceEntity>,
    private readonly aiSyncCronService: AiSyncCronService,
    private readonly jobService: JobService,
  ) {}

  async create(workerId: string, dto: CreateWorkerServiceDto) {
    const serviceNode = this.workerServiceRepo.create({
      ...dto,
      workerId,
    });
    const saved = await this.workerServiceRepo.save(serviceNode);
    this.aiSyncCronService.enqueueWorkerServiceSync(saved.id).catch(console.warn);
    return saved;
  }

  async findAll(query: WorkerServiceQueryDto) {
    const {
      page = 1,
      limit = 10,
      search,
      categoryId,
      provinceCode,
      wardCode,
      type,
      isAvailableNow,
      minPrice,
      maxPrice,
    } = query;

    const qb = this.workerServiceRepo.createQueryBuilder('ws')
      .leftJoin('ws.worker', 'worker')
      .addSelect([
        'worker.id',
        'worker.firstName',
        'worker.lastName',
        'worker.avatarUrl',
        'worker.role',
        'worker.email',
        'worker.isEmailVerified',
        'worker.verificationLevel',
      ])
      .leftJoinAndSelect('ws.category', 'category')
      .where('ws.isActive = :isActive', { isActive: true });

    if (search) {
      qb.andWhere('(ws.title ILIKE :search OR ws.description ILIKE :search)', { search: `%${search}%` });
    }
    if (categoryId) qb.andWhere('ws.categoryId = :categoryId', { categoryId });
    if (provinceCode) qb.andWhere('ws.provinceCode = :provinceCode', { provinceCode });
    if (wardCode) qb.andWhere('ws.wardCode = :wardCode', { wardCode });
    if (type) qb.andWhere('ws.type = :type', { type });
    if (isAvailableNow !== undefined) qb.andWhere('ws.isAvailableNow = :isAvailableNow', { isAvailableNow });
    if (minPrice !== undefined) qb.andWhere('ws.price >= :minPrice', { minPrice });
    if (maxPrice !== undefined) qb.andWhere('ws.price <= :maxPrice', { maxPrice });

    qb.orderBy('ws.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const service = await this.workerServiceRepo.createQueryBuilder('ws')
      .leftJoin('ws.worker', 'worker')
      .addSelect([
        'worker.id',
        'worker.firstName',
        'worker.lastName',
        'worker.avatarUrl',
        'worker.role',
        'worker.email',
        'worker.isEmailVerified',
        'worker.verificationLevel',
      ])
      .leftJoinAndSelect('ws.category', 'category')
      .where('ws.id = :id', { id })
      .getOne();

    if (!service) throw new NotFoundException(WORKER_SERVICE_ERRORS.WORKER_SERVICE_NOT_FOUND);
    return service;
  }

  async findByWorkerId(workerId: string) {
    return this.workerServiceRepo.find({
      where: { workerId },
      relations: ['category'],
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, workerId: string, dto: UpdateWorkerServiceDto) {
    const service = await this.findOne(id);
    if (service.workerId !== workerId) {
      throw new ForbiddenException(WORKER_SERVICE_ERRORS.WORKER_SERVICE_UPDATE_FORBIDDEN);
    }
    Object.assign(service, dto);
    const saved = await this.workerServiceRepo.save(service);
    this.aiSyncCronService.enqueueWorkerServiceSync(saved.id).catch(console.warn);
    return saved;
  }

  async remove(id: string, workerId: string) {
    const service = await this.findOne(id);
    if (service.workerId !== workerId) {
      throw new ForbiddenException(WORKER_SERVICE_ERRORS.WORKER_SERVICE_DELETE_FORBIDDEN);
    }
    const removed = await this.workerServiceRepo.remove(service);
    // Even if removed, we sync so GraphRagService can deactivate the node
    this.aiSyncCronService.enqueueWorkerServiceSync(id).catch(console.warn);
    return removed;
  }

  async hireDirectly(employerId: string, serviceId: string, dto: DirectHireDto) {
    const service = await this.findOne(serviceId);
    if (service.workerId === employerId) {
      throw new ForbiddenException(WORKER_SERVICE_ERRORS.WORKER_SERVICE_SELF_HIRE);
    }
    return this.jobService.createDirectHire(employerId, service.workerId, {
      ...dto,
      categoryId: service.categoryId,
    });
  }
}
