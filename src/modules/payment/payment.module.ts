import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PaymentConfirmation, Dispute } from './entities';
import { Job, JobAssignment } from '../job/entities';
import { NotificationModule } from '../notification';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentConfirmation,
      Dispute,
      Job,
      JobAssignment,
    ]),
    NotificationModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
