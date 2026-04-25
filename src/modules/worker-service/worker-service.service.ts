import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkerServiceEntity } from './entities/worker-service.entity';
import { CreateWorkerServiceDto, UpdateWorkerServiceDto, WorkerServiceQueryDto } from './dto';

import { AiSyncCronService } from '../ai/ai-sync-cron.service';

@Injectable()
export class WorkerServiceService {
  constructor(
    @InjectRepository(WorkerServiceEntity)
    private readonly workerServiceRepo: Repository<WorkerServiceEntity>,
    private readonly aiSyncCronService: AiSyncCronService,
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
      .leftJoinAndSelect('ws.worker', 'worker')
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
    const service = await this.workerServiceRepo.findOne({
      where: { id },
      relations: ['worker', 'category'],
    });
    if (!service) throw new NotFoundException('Service not found');
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
      throw new ForbiddenException('You can only update your own service');
    }
    Object.assign(service, dto);
    const saved = await this.workerServiceRepo.save(service);
    this.aiSyncCronService.enqueueWorkerServiceSync(saved.id).catch(console.warn);
    return saved;
  }

  async remove(id: string, workerId: string) {
    const service = await this.findOne(id);
    if (service.workerId !== workerId) {
      throw new ForbiddenException('You can only delete your own service');
    }
    const removed = await this.workerServiceRepo.remove(service);
    // Even if removed, we sync so GraphRagService can deactivate the node
    this.aiSyncCronService.enqueueWorkerServiceSync(id).catch(console.warn);
    return removed;
  }
}
