import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';
import { Review } from './entities';
import { JobAssignment } from '../job/entities';
import { WorkerProfile, EmployerProfile } from '../profile/entities';
import { NotificationModule } from '../notification';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Review,
      JobAssignment,
      WorkerProfile,
      EmployerProfile,
    ]),
    NotificationModule,
  ],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
