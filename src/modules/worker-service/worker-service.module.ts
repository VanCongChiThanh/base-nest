import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkerServiceService } from './worker-service.service';
import { WorkerServiceController } from './worker-service.controller';
import { WorkerServiceEntity } from './entities';
import { AiModule } from '../ai/ai.module';
import { JobModule } from '../job/job.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { User } from '../user/entities';
import { WorkerProfile } from '../profile/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkerServiceEntity, User, WorkerProfile]),
    AiModule,
    forwardRef(() => JobModule),
    SubscriptionModule,
  ],
  controllers: [WorkerServiceController],
  providers: [WorkerServiceService],
  exports: [WorkerServiceService],
})
export class WorkerServiceModule {}
