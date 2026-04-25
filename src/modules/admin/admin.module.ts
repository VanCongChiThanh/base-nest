import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminStatsService } from './admin-stats.service';
import { Job, JobApplication, JobAssignment } from '../job/entities';
import { User } from '../user/entities';
import { PaymentConfirmation, Dispute } from '../payment/entities';
import { Report } from '../report/entities';
import { Review } from '../review/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Job,
      JobApplication,
      JobAssignment,
      User,
      PaymentConfirmation,
      Dispute,
      Report,
      Review,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminStatsService],
})
export class AdminModule {}
