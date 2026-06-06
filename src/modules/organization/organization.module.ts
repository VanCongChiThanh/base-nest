import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';
import { Job } from '../job/entities/job.entity';
import { JobApplication } from '../job/entities/job-application.entity';
import { PaymentConfirmation } from '../payment/entities/payment-confirmation.entity';
import { Escrow } from '../payment/entities/escrow.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Job,
      JobApplication,
      PaymentConfirmation,
      Escrow,
    ]),
  ],
  controllers: [OrganizationController],
  providers: [OrganizationService],
})
export class OrganizationModule {}
