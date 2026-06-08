import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  Delete,
  HttpCode,
  InternalServerErrorException,
  UseGuards,
  Res,
  Inject,
} from '@nestjs/common';
import type { Response } from 'express';
import { AiChatbotService } from './ai-chatbot.service';
import { AiMatchingService } from './ai-matching.service';
import { AiSyncCronService } from './ai-sync-cron.service';
import {
  ScamDetectorService,
  ScamAnalysisResult,
} from './scam-detector.service';
import {
  AiChatDto,
  AnalyzeJobDto,
  AnalyzeJobContentDto,
  BatchSyncDto,
  UpsertFaqDto,
} from './dto';
import { ALL_SYNC_TARGETS } from './ai-embedding.constants';
import { GraphRagService } from './graph-rag.service';
import { JwtAuthGuard } from '../../common/guards';
import {
  CurrentUser,
  Roles,
  Public,
  RequireFeature,
} from '../../common/decorators';
import { User } from '../user/entities';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedJob } from './entities';
import { Job } from '../job/entities';
import { NotFoundException, JOB_ERRORS } from '../../common';
import { JobSalaryType, Role } from '../../common/enums';
import { REDIS_CLIENT } from '../redis/redis.module';
import Redis from 'ioredis';

@Controller('ai')
export class AiController {
  constructor(
    private readonly chatbotService: AiChatbotService,
    private readonly aiMatchingService: AiMatchingService,
    private readonly scamDetectorService: ScamDetectorService,
    private readonly aiSyncCronService: AiSyncCronService,
    private readonly graphRagService: GraphRagService,
    @InjectRepository(SavedJob)
    private readonly savedJobRepo: Repository<SavedJob>,
    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis,
  ) {}

  // ==================== AI CHATBOT ====================

  @Post('chat')
  @RequireFeature({ key: 'ai.job_chatbot.enabled' })
  async chat(@CurrentUser() user: User, @Body() dto: AiChatDto) {
    return this.chatbotService.chat(user.id, dto.message, dto.sessionId);
  }

  @Post('chat-stream')
  @RequireFeature({ key: 'ai.job_chatbot.enabled' })
  async chatStream(
    @CurrentUser() user: User,
    @Body() dto: AiChatDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    // `no-transform` stops CDNs/proxies (Cloudflare, etc.) from re-buffering;
    // `X-Accel-Buffering: no` disables nginx/ingress response buffering so each
    // SSE chunk reaches the browser immediately instead of arriving in one blob.
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      const stream = this.chatbotService.chatStream(
        user.id,
        dto.message,
        dto.sessionId,
      );
      for await (const chunk of stream) {
        // Send each chunk as an SSE data payload
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    }
  }

  @Get('chat/suggestions')
  getSuggestions() {
    return this.chatbotService.getSuggestions();
  }

  @Get('chat/history')
  @RequireFeature({ key: 'ai.job_chatbot.enabled' })
  async getChatHistory(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.chatbotService.getChatHistory(user.id, page, limit);
  }

  @Get('chat/sessions/:id')
  @RequireFeature({ key: 'ai.job_chatbot.enabled' })
  async getChatSession(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) sessionId: string,
  ) {
    return this.chatbotService.getSession(sessionId, user.id);
  }

  // ==================== AI SEARCH CANDIDATES ====================

  @UseGuards(JwtAuthGuard)
  @Get('search-candidates')
  @RequireFeature({ key: 'ai.candidate_match.enabled' })
  async searchCandidates(@Query('q') q: string) {
    if (!q || q.trim() === '') {
      return [];
    }
    return this.chatbotService.searchCandidates(q);
  }

  @UseGuards(JwtAuthGuard)
  @Get('match-candidates/:jobId')
  @RequireFeature({ key: 'ai.candidate_match.enabled' })
  async matchCandidatesForJob(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Query('limit') limit?: number,
  ) {
    return this.aiMatchingService.matchCandidatesForJob(
      jobId,
      limit ? Number(limit) : 10,
    );
  }

  // ==================== MANUAL SYNC ====================

  /**
   * POST /ai/sync
   * Admin-only selective sync.
   * Body: { targets?: ('jobs' | 'workers' | 'faq')[] }
   * Omit targets → sync all.
   *
   * Examples:
   *   {}                          → sync jobs + workers + faq
   *   { "targets": ["faq"] }      → only backfill FAQ embeddings
   *   { "targets": ["jobs","faq"] }
   */
  @Post('sync')
  @Roles(Role.ADMIN)
  @HttpCode(200)
  async triggerSync(@Body() dto: BatchSyncDto) {
    const targets = dto.targets?.length ? dto.targets : ALL_SYNC_TARGETS;
    return this.aiSyncCronService.enqueueBatchSyncSelective(targets);
  }

  @Public()
  @Post('dev-sync')
  async triggerDevSync() {
    await this.aiSyncCronService.enqueueBatchSync();
    return {
      success: true,
      message:
        'Đã đưa yêu cầu đồng bộ toàn bộ vào hàng đợi. Kiểm tra logs để theo dõi.',
    };
  }

  @Post('sync-jobs')
  @Roles(Role.ADMIN)
  @HttpCode(200)
  async manualSyncJobs() {
    return this.aiSyncCronService.syncJobsToVectorDb();
  }

  @Public()
  @Get('queue-status')
  async getQueueStatus() {
    return this.aiSyncCronService.getQueueStatus();
  }

  // ==================== FAQ / KNOWLEDGE BASE (admin) ====================

  @Get('faq')
  @Roles(Role.ADMIN)
  async listFaq() {
    return this.graphRagService.listFaqNodes();
  }

  @Post('faq')
  @Roles(Role.ADMIN)
  async upsertFaq(@Body() dto: UpsertFaqDto) {
    return this.graphRagService.upsertFaqNode(dto);
  }

  @Delete('faq/:id')
  @Roles(Role.ADMIN)
  async deleteFaq(@Param('id', ParseUUIDPipe) id: string) {
    await this.graphRagService.deleteFaqNode(id);
    return { success: true };
  }

  // ==================== SCAM DETECTION ====================

  @Get('analyze-job/:jobId')
  async getAnalyzeJob(
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ): Promise<ScamAnalysisResult | null> {
    const cacheKey = `job:scam-analysis:${jobId}`;
    const cached = await this.redisClient.get(cacheKey);

    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (err) {
        // ignore JSON parse error
      }
    }

    // Cache miss: If job is old, we can either analyze synchronously or just return null
    // Theo yêu cầu mới nhất: "không hiển thị gì cả vì đa số job cũ đã đóng rồi"
    // => return null directly
    return null;
  }

  // Giữ lại hoặc thay thế endpoint POST cũ (tùy ý).
  // Đã sửa POST để sử dụng cho việc test hoặc analyze thủ công nếu cần.
  @Post('analyze-job')
  async analyzeJobById(
    @Body() dto: AnalyzeJobDto,
  ): Promise<ScamAnalysisResult> {
    const job = await this.jobRepo.findOne({
      where: { id: dto.jobId },
      relations: ['employer'],
    });
    if (!job) {
      throw new NotFoundException(JOB_ERRORS.JOB_NOT_FOUND);
    }
    
    // Check cache first for manual triggers too
    const cacheKey = `job:scam-analysis:${dto.jobId}`;
    const cached = await this.redisClient.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // Ignore invalid cached JSON and re-run analysis.
      }
    }

    const result = await this.scamDetectorService.analyzeJob({
      title: job.title,
      description: job.description,
      companyName: job.employer?.firstName
        ? `${job.employer.firstName} ${job.employer.lastName}`
        : undefined,
      address: job.address,
      salary: Number(job.salaryPerHour || job.totalBudget || 0),
      salaryText:
        job.salaryType === JobSalaryType.HOURLY
          ? `${Number(job.salaryPerHour).toLocaleString()}₫/giờ`
          : `${Number(job.totalBudget).toLocaleString()}₫ (Khoán)`,
    });

    // Cache the result in Redis with 30 days TTL
    await this.redisClient.setex(
      cacheKey,
      2592000,
      JSON.stringify(result),
    );

    return result;
  }

  @Post('analyze-job-content')
  async analyzeJobContent(
    @Body() dto: AnalyzeJobContentDto,
  ): Promise<ScamAnalysisResult> {
    return this.scamDetectorService.analyzeJob({
      title: dto.title,
      description: dto.description,
      companyName: dto.companyName,
      salary: dto.salary,
      address: dto.address,
    });
  }

  // ==================== SAVED JOBS ====================

  @Post('saved-jobs/:jobId')
  async saveJob(
    @CurrentUser() user: User,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ) {
    const existing = await this.savedJobRepo.findOne({
      where: { userId: user.id, jobId },
    });
    if (existing) {
      return { saved: true, message: 'Already saved' };
    }
    await this.savedJobRepo.save(
      this.savedJobRepo.create({ userId: user.id, jobId }),
    );
    return { saved: true };
  }

  @Delete('saved-jobs/:jobId')
  async unsaveJob(
    @CurrentUser() user: User,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ) {
    await this.savedJobRepo.delete({ userId: user.id, jobId });
    return { saved: false };
  }

  @Get('saved-jobs')
  async getSavedJobs(
    @CurrentUser() user: User,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    const [data, total] = await this.savedJobRepo.findAndCount({
      where: { userId: user.id },
      relations: [
        'job',
        'job.employer',
        'job.category',
        'job.jobSkills',
        'job.jobSkills.skill',
      ],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: data.map((s) => s.job),
      total,
      page,
      limit,
    };
  }

  @Get('saved-jobs/check/:jobId')
  async checkSaved(
    @CurrentUser() user: User,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ) {
    const exists = await this.savedJobRepo.findOne({
      where: { userId: user.id, jobId },
    });
    return { saved: !!exists };
  }
}
