import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { EscrowService } from './escrow.service';
import { PaymentConfirmation, Dispute, Escrow, Milestone } from './entities';
import { Job, JobAssignment, JobApplication } from '../job/entities';
import { BankAccount, User } from '../user/entities';
import { NotificationModule } from '../notification';
import payosConfig from '../../config/payos.config';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forFeature(payosConfig),
    TypeOrmModule.forFeature([
      PaymentConfirmation,
      Dispute,
      Escrow,
      Milestone,
      Job,
      JobAssignment,
      JobApplication,
      BankAccount,
      User,
    ]),
    NotificationModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService, EscrowService],
  exports: [PaymentService, EscrowService],
})
export class PaymentModule {}
