import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import Bull from 'bull';
import { Job } from '../job/entities';
import { WorkerServiceEntity } from '../worker-service/entities';
import { GeminiService } from './gemini.service';
import { GraphRagService } from './graph-rag.service';
import { NotificationHelper } from '../notification/notification.helper';
import { JobStatus, NotificationType } from '../../common/enums';
import {
  AI_EMBEDDING_QUEUE,
  EmbeddingJobName,
  SyncJobPayload,
  SyncWorkerServicePayload,
  RemoveJobPayload,
  SyncGraphJobPayload,
  SyncGraphWorkerPayload,
  RemoveGraphNodePayload,
} from './ai-embedding.constants';

@Processor(AI_EMBEDDING_QUEUE)
export class AiEmbeddingProcessor {
  private readonly logger = new Logger(AiEmbeddingProcessor.name);

  constructor(
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    @InjectRepository(WorkerServiceEntity)
    private readonly workerServiceRepo: Repository<WorkerServiceEntity>,
    private readonly geminiService: GeminiService,
    private readonly graphRagService: GraphRagService,
    private readonly dataSource: DataSource,
    private readonly notificationHelper: NotificationHelper,
  ) {}

  // ─── Single Job (legacy → delegates to graph) ──────────────────

  @Process(EmbeddingJobName.SYNC_JOB)
  async handleSyncJob(bullJob: Bull.Job<SyncJobPayload>) {
    const { jobId } = bullJob.data;
    // Delegated: graph_knowledge is the source of truth now.
    // knowledge_embeddings only stores FAQ/guide/policy seeds.
    this.logger.debug(`[Queue] SYNC_JOB ${jobId} → delegated to graph sync`);
    await this.graphRagService.syncJobNode(jobId);
  }

  // ─── Single Worker Service (legacy → delegates to graph) ────────

  @Process(EmbeddingJobName.SYNC_WORKER_SERVICE)
  async handleSyncWorkerService(bullJob: Bull.Job<SyncWorkerServicePayload>) {
    const { workerServiceId } = bullJob.data;
    this.logger.debug(`[Queue] SYNC_WORKER_SERVICE ${workerServiceId} → delegated to graph sync`);
    await this.graphRagService.syncWorkerServiceNode(workerServiceId);
  }

  // ─── Remove Job ────────────────────────────────────────────────

  @Process(EmbeddingJobName.REMOVE_JOB)
  async handleRemoveJob(bullJob: Bull.Job<RemoveJobPayload>) {
    const { jobId } = bullJob.data;
    this.logger.log(`[Queue] Deactivate graph node for job ${jobId}`);
    try {
      await this.graphRagService.deactivateNode(`job_${jobId}`);
      this.logger.log(`[Queue] ✅ Graph node deactivated: job_${jobId}`);
    } catch (error: any) {
      this.logger.error(`[Queue] Lỗi khi deactivate graph node job ${jobId}`, error?.stack);
    }
  }

  // ─── Batch Sync ────────────────────────────────────────────────

  @Process(EmbeddingJobName.BATCH_SYNC_ALL)
  async handleBatchSync() {
    this.logger.log('[Queue] Bắt đầu batch sync vào graph_knowledge...');

    let jobsSynced = 0;
    let servicesSynced = 0;

    // --- Jobs → graph_knowledge ---
    try {
      const jobs = await this.jobRepository.find({
        where: { status: JobStatus.OPEN },
        select: ['id'],
      });

      for (const job of jobs) {
        try {
          const synced = await this.graphRagService.syncJobNode(job.id);
          if (synced) jobsSynced++;
          await this.delay(300); // tránh rate limit Gemini
        } catch (err: any) {
          this.logger.warn(`[Batch] Skip job ${job.id}: ${err?.message}`);
        }
      }
    } catch (error: any) {
      this.logger.error('Lỗi batch sync Jobs', error?.stack);
    }

    // --- Worker Services → graph_knowledge ---
    try {
      const services = await this.workerServiceRepo.find({
        where: { isActive: true },
        select: ['id'],
      });

      for (const svc of services) {
        try {
          const synced = await this.graphRagService.syncWorkerServiceNode(svc.id);
          if (synced) servicesSynced++;
          await this.delay(300);
        } catch (err: any) {
          this.logger.warn(`[Batch] Skip worker-service ${svc.id}: ${err?.message}`);
        }
      }
    } catch (error: any) {
      this.logger.error('Lỗi batch sync WorkerServices', error?.stack);
    }

    this.logger.log(
      `[Queue] ✅ Batch sync hoàn tất: ${jobsSynced} jobs, ${servicesSynced} worker services → graph_knowledge`,
    );

    // Thông báo admin
    try {
      const admins = await this.dataSource.query('SELECT id FROM users WHERE role = $1', ['ADMIN']);
      if (admins?.length > 0) {
        await this.notificationHelper.sendToMany(
          admins.map((a: any) => a.id),
          NotificationType.SYSTEM,
          undefined,
          {
            title: 'Đồng bộ AI Graph hoàn tất',
            message: `Graph sync: ${jobsSynced} jobs, ${servicesSynced} dịch vụ đã cập nhật.`,
            type: 'AI_SYNC_COMPLETED',
          },
        );
      }
    } catch (notifyErr: any) {
      this.logger.error('Lỗi gửi thông báo batch sync', notifyErr?.stack);
    }

    return { jobsSynced, servicesSynced };
  }


  // ─── Graph RAG Processors ──────────────────────────────────────

  @Process(EmbeddingJobName.SYNC_GRAPH_JOB)
  async handleSyncGraphJob(bullJob: Bull.Job<SyncGraphJobPayload>) {
    const { jobId } = bullJob.data;
    this.logger.log(`[GraphRAG] Sync graph node for job ${jobId}`);
    try {
      await this.graphRagService.syncJobNode(jobId);
      this.logger.log(`[GraphRAG] ✅ Graph node synced: job ${jobId}`);
    } catch (err: any) {
      this.logger.error(`[GraphRAG] Error syncing graph job ${jobId}`, err?.stack);
      throw err;
    }
  }

  @Process(EmbeddingJobName.SYNC_GRAPH_WORKER)
  async handleSyncGraphWorker(bullJob: Bull.Job<SyncGraphWorkerPayload>) {
    const { workerServiceId } = bullJob.data;
    this.logger.log(`[GraphRAG] Sync graph node for worker-service ${workerServiceId}`);
    try {
      await this.graphRagService.syncWorkerServiceNode(workerServiceId);
      this.logger.log(`[GraphRAG] ✅ Graph node synced: worker-service ${workerServiceId}`);
    } catch (err: any) {
      this.logger.error(`[GraphRAG] Error syncing graph worker ${workerServiceId}`, err?.stack);
      throw err;
    }
  }

  @Process(EmbeddingJobName.REMOVE_GRAPH_NODE)
  async handleRemoveGraphNode(bullJob: Bull.Job<RemoveGraphNodePayload>) {
    const { sourceId } = bullJob.data;
    this.logger.log(`[GraphRAG] Deactivate graph node: ${sourceId}`);
    try {
      await this.graphRagService.deactivateNode(sourceId);
      this.logger.log(`[GraphRAG] ✅ Graph node deactivated: ${sourceId}`);
    } catch (err: any) {
      this.logger.error(`[GraphRAG] Error deactivating graph node ${sourceId}`, err?.stack);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
