import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { WorkerServiceEntity } from './entities/worker-service.entity';
import {
  CreateWorkerServiceDto,
  UpdateWorkerServiceDto,
  WorkerServiceQueryDto,
} from './dto';

import { DirectHireDto } from './dto';
import { JobService } from '../job/job.service';
import { AiSyncCronService } from '../ai/ai-sync-cron.service';
import { SubscriptionService } from '../subscription';
import { User } from '../user/entities';
import { WorkerProfile } from '../profile/entities';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  WORKER_SERVICE_ERRORS,
} from '../../common';
import { JobType, OnlinePaymentType } from '../../common/enums';

@Injectable()
export class WorkerServiceService {
  constructor(
    @InjectRepository(WorkerServiceEntity)
    private readonly workerServiceRepo: Repository<WorkerServiceEntity>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(WorkerProfile)
    private readonly workerProfileRepo: Repository<WorkerProfile>,
    private readonly aiSyncCronService: AiSyncCronService,
    private readonly jobService: JobService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async create(workerId: string, dto: CreateWorkerServiceDto) {
    await this.assertCanCreateWorkerService(workerId);

    const serviceNode = this.workerServiceRepo.create({
      ...dto,
      workerId,
    });
    const saved = await this.workerServiceRepo.save(serviceNode);
    this.aiSyncCronService
      .enqueueWorkerServiceSync(saved.id)
      .catch(console.warn);
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

    const qb = this.workerServiceRepo
      .createQueryBuilder('ws')
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
      .leftJoin('worker_profiles', 'wp', 'wp.user_id = ws.worker_id')
      .leftJoinAndSelect('ws.category', 'category')
      .where('ws.isActive = :isActive', { isActive: true });

    if (search) {
      qb.andWhere('(ws.title ILIKE :search OR ws.description ILIKE :search)', {
        search: `%${search}%`,
      });
    }
    if (categoryId) qb.andWhere('ws.categoryId = :categoryId', { categoryId });
    if (provinceCode)
      qb.andWhere('ws.provinceCode = :provinceCode', { provinceCode });
    if (wardCode) qb.andWhere('ws.wardCode = :wardCode', { wardCode });
    if (type) qb.andWhere('ws.type = :type', { type });
    if (isAvailableNow !== undefined)
      qb.andWhere('ws.isAvailableNow = :isAvailableNow', { isAvailableNow });
    if (minPrice !== undefined)
      qb.andWhere('ws.price >= :minPrice', { minPrice });
    if (maxPrice !== undefined)
      qb.andWhere('ws.price <= :maxPrice', { maxPrice });

    // Surface workers who are available now and well-rated, then most recent.
    qb.orderBy('ws.isAvailableNow', 'DESC')
      .addOrderBy('wp.rating_avg', 'DESC')
      .addOrderBy('wp.total_jobs_completed', 'DESC')
      .addOrderBy('ws.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    await this.attachWorkerRatings(data);
    return { data, total, page, limit };
  }

  /**
   * Attach a real rating summary (from worker_profiles) onto each service's
   * worker so listing cards can show trustworthy stats instead of mock data.
   */
  private async attachWorkerRatings(
    services: WorkerServiceEntity[],
  ): Promise<void> {
    if (!services.length) return;
    const workerIds = [...new Set(services.map((s) => s.workerId))];
    const profiles = await this.workerProfileRepo.find({
      where: { userId: In(workerIds) },
    });
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));
    for (const service of services) {
      const profile = profileMap.get(service.workerId);
      if (service.worker) {
        (service.worker as any).workerProfile = profile
          ? {
              ratingAvg: Number(profile.ratingAvg) || 0,
              totalReviews: profile.totalReviews ?? 0,
              totalJobsCompleted: profile.totalJobsCompleted ?? 0,
            }
          : null;
      }
    }
  }

  async findOne(id: string) {
    const service = await this.workerServiceRepo
      .createQueryBuilder('ws')
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

    if (!service)
      throw new NotFoundException(
        WORKER_SERVICE_ERRORS.WORKER_SERVICE_NOT_FOUND,
      );
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
      throw new ForbiddenException(
        WORKER_SERVICE_ERRORS.WORKER_SERVICE_UPDATE_FORBIDDEN,
      );
    }
    Object.assign(service, dto);
    const saved = await this.workerServiceRepo.save(service);
    this.aiSyncCronService
      .enqueueWorkerServiceSync(saved.id)
      .catch(console.warn);
    return saved;
  }

  async remove(id: string, workerId: string) {
    const service = await this.findOne(id);
    if (service.workerId !== workerId) {
      throw new ForbiddenException(
        WORKER_SERVICE_ERRORS.WORKER_SERVICE_DELETE_FORBIDDEN,
      );
    }
    const removed = await this.workerServiceRepo.remove(service);
    // Even if removed, we sync so GraphRagService can deactivate the node
    this.aiSyncCronService.enqueueWorkerServiceSync(id).catch(console.warn);
    return removed;
  }

  async hireDirectly(
    employerId: string,
    serviceId: string,
    dto: DirectHireDto,
  ) {
    const service = await this.findOne(serviceId);
    if (service.workerId === employerId) {
      throw new ForbiddenException(
        WORKER_SERVICE_ERRORS.WORKER_SERVICE_SELF_HIRE,
      );
    }

    return this.jobService.createDirectHire(
      employerId,
      null, // postedById
      service.workerId,
      this.buildDirectHirePayload(dto, service),
    );
  }

  private async assertCanCreateWorkerService(workerId: string) {
    const activeServiceCount = await this.workerServiceRepo.count({
      where: { workerId, isActive: true },
    });
    if (activeServiceCount === 0) return;

    const user = await this.userRepo.findOne({ where: { id: workerId } });
    if (!user) {
      throw new NotFoundException(
        WORKER_SERVICE_ERRORS.WORKER_SERVICE_NOT_FOUND,
      );
    }

    const entitlements =
      await this.subscriptionService.getEntitlementsForUser(user);
    const limit = Number(
      entitlements.features?.['worker.service.active_limit'] ?? 1,
    );

    if (activeServiceCount >= limit) {
      throw new BadRequestException(
        WORKER_SERVICE_ERRORS.WORKER_SERVICE_LIMIT_REACHED,
      );
    }
  }

  private buildDirectHirePayload(
    dto: DirectHireDto,
    service: WorkerServiceEntity,
  ) {
    const price = Number(dto.totalBudget ?? dto.salaryPerHour ?? service.price);
    const isFixedPrice =
      dto.onlinePaymentType === OnlinePaymentType.FIXED_PRICE ||
      (dto.jobType === JobType.ONLINE && dto.totalBudget !== undefined);

    // Direct hire has its own contract payload. Hourly/offline keeps schedule,
    // fixed-price/online uses totalBudget and optional deadline.
    if (isFixedPrice) {
      return {
        title: dto.title,
        description: dto.description,
        jobType: JobType.ONLINE,
        onlinePaymentType: OnlinePaymentType.FIXED_PRICE,
        totalBudget: price,
        deadline: dto.deadline || dto.endTime,
        categoryId: service.categoryId,
      };
    }

    return {
      title: dto.title,
      description: dto.description,
      jobType: dto.jobType,
      salaryPerHour: price,
      startTime: dto.startTime,
      endTime: dto.endTime,
      provinceCode: dto.provinceCode,
      wardCode: dto.wardCode,
      address: dto.address,
      categoryId: service.categoryId,
    };
  }
}
