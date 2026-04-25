import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkerServiceService } from './worker-service.service';
import { WorkerServiceController } from './worker-service.controller';
import { WorkerServiceEntity } from './entities';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [TypeOrmModule.forFeature([WorkerServiceEntity]), AiModule],
  controllers: [WorkerServiceController],
  providers: [WorkerServiceService],
  exports: [WorkerServiceService],
})
export class WorkerServiceModule {}
