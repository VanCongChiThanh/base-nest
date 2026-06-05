import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import Bull from 'bull';
import {
  AI_EMBEDDING_QUEUE,
  EmbeddingJobName,
  SyncTarget,
  ALL_SYNC_TARGETS,
} from './ai-embedding.constants';
import { REDIS_CLIENT } from '../redis/redis.module';
import Redis from 'ioredis';

/**
 * Cron job that dispatches batch-sync to the Bull queue.
 * Also exposes helper methods to enqueue single-item syncs
 * from other services (e.g. JobService on create/update).
 */
@Injectable()
export class AiSyncCronService {
  private readonly logger = new Logger(AiSyncCronService.name);

  constructor(
    @InjectQueue(AI_EMBEDDING_QUEUE)
    private readonly embeddingQueue: Bull.Queue,
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis,
  ) {}

  // ─── Cron: dispatch batch sync every hour ──────────────────────
  // FAQ/guide/policy là data tĩnh, không cần sync theo giờ.
  // Chỉ sync jobs + workers để bắt dữ liệu mới/thay đổi.

  @Cron(CronExpression.EVERY_WEEK)
  async handleCronSync() {
    this.logger.log('Cron tick → dispatching selective sync [jobs, workers]');
    await this.enqueueBatchSyncSelective(['jobs', 'workers']);
  }

  // ─── Public helpers – called from other services ───────────────

  /** Enqueue embedding for a single job (create / update) */
  async enqueueJobSync(jobId: string) {
    await this.embeddingQueue.add(
      EmbeddingJobName.SYNC_JOB,
      { jobId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
    this.logger.debug(`Enqueued SYNC_JOB for ${jobId}`);
  }

  /** Enqueue scam analysis for a single job */
  async enqueueScamAnalysis(jobId: string) {
    await this.embeddingQueue.add(
      EmbeddingJobName.ANALYZE_SCAM_JOB,
      { jobId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
    this.logger.debug(`Enqueued ANALYZE_SCAM_JOB for ${jobId}`);
  }

  /** Delete scam analysis cache for a single job */
  async deleteScamAnalysisCache(jobId: string) {
    try {
      await this.redisClient.del(`job:scam-analysis:${jobId}`);
      this.logger.debug(`Deleted scam analysis cache for job ${jobId}`);
    } catch (err) {
      this.logger.warn(`Failed to delete scam analysis cache for job ${jobId}`, err);
    }
  }

  /** Enqueue embedding for a single worker service */
  async enqueueWorkerServiceSync(workerServiceId: string) {
    await this.embeddingQueue.add(
      EmbeddingJobName.SYNC_WORKER_SERVICE,
      { workerServiceId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
    this.logger.debug(`Enqueued SYNC_WORKER_SERVICE for ${workerServiceId}`);
  }

  /** Deactivate embedding when a job is closed */
  async enqueueJobRemoval(jobId: string) {
    await this.embeddingQueue.add(
      EmbeddingJobName.REMOVE_JOB,
      { jobId },
      {
        attempts: 2,
        removeOnComplete: true,
      },
    );
    this.logger.debug(`Enqueued REMOVE_JOB for ${jobId}`);
  }

  /** Sync a single job into graph_knowledge */
  async enqueueGraphJobSync(jobId: string) {
    await this.embeddingQueue.add(
      EmbeddingJobName.SYNC_GRAPH_JOB,
      { jobId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
      },
    );
    this.logger.debug(`Enqueued SYNC_GRAPH_JOB for ${jobId}`);
  }

  /** Sync a single worker service into graph_knowledge */
  async enqueueGraphWorkerSync(workerServiceId: string) {
    await this.embeddingQueue.add(
      EmbeddingJobName.SYNC_GRAPH_WORKER,
      { workerServiceId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
      },
    );
    this.logger.debug(`Enqueued SYNC_GRAPH_WORKER for ${workerServiceId}`);
  }

  /** Deactivate a graph_knowledge node */
  async enqueueGraphNodeRemoval(sourceId: string) {
    await this.embeddingQueue.add(
      EmbeddingJobName.REMOVE_GRAPH_NODE,
      { sourceId },
      { attempts: 2, removeOnComplete: true },
    );
    this.logger.debug(`Enqueued REMOVE_GRAPH_NODE for ${sourceId}`);
  }

  /** Full batch sync (called by cron or manual trigger) */
  async enqueueBatchSync() {
    // Trong lúc code Dev (dev server restart), các job cũ có thể kẹt ở trạng thái 'active'.
    // Để tránh việc kẹt vĩnh viễn, ta chỉ rào các job 'waiting' và 'delayed'
    const jobs = await this.embeddingQueue.getJobs(['waiting', 'delayed']);

    const isAlreadyQueued = jobs.some(
      (job) => job.name === EmbeddingJobName.BATCH_SYNC_ALL,
    );

    if (isAlreadyQueued) {
      this.logger.warn(
        'BATCH_SYNC_ALL is already in queue or processing. Skipping.',
      );
      throw new BadRequestException(
        'Tiến trình đồng bộ đang chạy. Vui lòng đợi trong giây lát...',
      );
    }

    await this.embeddingQueue.add(
      EmbeddingJobName.BATCH_SYNC_ALL,
      {},
      {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
    this.logger.log('Enqueued BATCH_SYNC_ALL');
    return { message: 'Đã đưa yêu cầu đồng bộ toàn bộ vào hàng đợi.' };
  }

  /**
   * Selective sync — only processes the requested targets.
   * targets: array of 'jobs' | 'workers' | 'faq'
   * Omitting targets defaults to ALL_SYNC_TARGETS (same as full sync).
   */
  async enqueueBatchSyncSelective(targets: SyncTarget[] = ALL_SYNC_TARGETS) {
    const unique = [...new Set(targets)].filter((t) =>
      ALL_SYNC_TARGETS.includes(t),
    );
    if (unique.length === 0) {
      throw new BadRequestException(
        `targets không hợp lệ. Giá trị cho phép: ${ALL_SYNC_TARGETS.join(', ')}`,
      );
    }

    const jobs = await this.embeddingQueue.getJobs(['waiting', 'delayed']);
    const isRunning = jobs.some(
      (j) =>
        j.name === EmbeddingJobName.BATCH_SYNC_ALL ||
        j.name === EmbeddingJobName.BATCH_SYNC_SELECTIVE,
    );
    if (isRunning) {
      throw new BadRequestException(
        'Tiến trình đồng bộ đang chạy. Vui lòng đợi trong giây lát...',
      );
    }

    await this.embeddingQueue.add(
      EmbeddingJobName.BATCH_SYNC_SELECTIVE,
      { targets: unique },
      { attempts: 1, removeOnComplete: true, removeOnFail: false },
    );

    this.logger.log(
      `Enqueued BATCH_SYNC_SELECTIVE — targets: [${unique.join(', ')}]`,
    );
    return {
      message: `Đã đưa yêu cầu đồng bộ vào hàng đợi.`,
      targets: unique,
    };
  }

  // ─── Legacy wrappers for existing controller endpoints ─────────

  async syncJobsToVectorDb() {
    return this.enqueueBatchSync();
  }

  async syncWorkerServicesToVectorDb() {
    return this.enqueueBatchSync();
  }

  // ─── Debug / Status ────────────────────────────────────────────

  async getQueueStatus() {
    const [waiting, active, delayed, completed, failed] = await Promise.all([
      this.embeddingQueue.getWaiting(),
      this.embeddingQueue.getActive(),
      this.embeddingQueue.getDelayed(),
      this.embeddingQueue.getCompleted(),
      this.embeddingQueue.getFailed(),
    ]);

    const mapJob = (j: Bull.Job) => ({
      id: j.id,
      name: j.name,
      data: j.data,
      status: j.finishedOn ? 'completed' : 'unknown',
    });

    return {
      waiting: waiting.map(mapJob),
      active: active.map(mapJob),
      delayed: delayed.map(mapJob),
      completed: completed.map(mapJob),
      failed: failed.map(mapJob),
    };
  }
}
