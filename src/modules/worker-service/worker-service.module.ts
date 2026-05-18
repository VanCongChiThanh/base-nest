import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkerServiceService } from './worker-service.service';
import { WorkerServiceController } from './worker-service.controller';
import { WorkerServiceEntity } from './entities';
import { AiModule } from '../ai/ai.module';
import { JobModule } from '../job/job.module';

@Module({
  imports: [TypeOrmModule.forFeature([WorkerServiceEntity]), AiModule, forwardRef(() => JobModule)],
  controllers: [WorkerServiceController],
  providers: [WorkerServiceService],
  exports: [WorkerServiceService],
})
export class WorkerServiceModule {}
