import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { GeminiService } from './gemini.service';
import { AiChatbotService } from './ai-chatbot.service';
import { ScamDetectorService } from './scam-detector.service';
import { AiSeedService } from './ai-seed.service';
import { AiSyncCronService } from './ai-sync-cron.service';
import { AiEmbeddingProcessor } from './ai-embedding.processor';
import { AiController } from './ai.controller';
import { AiDbInitService } from './ai-db-init.service';
import { GraphRagService } from './graph-rag.service';
import { AiMatchingService } from './ai-matching.service';
import {
  ScamPattern,
  ChatSession,
  SavedJob,
  GraphKnowledge,
} from './entities';
import { Job } from '../job/entities';
import { WorkerServiceEntity } from '../worker-service/entities';
import { AI_EMBEDDING_QUEUE } from './ai-embedding.constants';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ScamPattern,
      ChatSession,
      SavedJob,
      GraphKnowledge,
      Job,
      WorkerServiceEntity,
    ]),
    BullModule.registerQueue({
      name: AI_EMBEDDING_QUEUE,
    }),
    NotificationModule,
  ],
  controllers: [AiController],
  providers: [
    GeminiService,
    GraphRagService,
    AiChatbotService,
    AiMatchingService,
    ScamDetectorService,
    AiSeedService,
    AiSyncCronService,
    AiEmbeddingProcessor,
    AiDbInitService,
  ],
  exports: [GeminiService, ScamDetectorService, AiSyncCronService, GraphRagService],
})
export class AiModule {}

