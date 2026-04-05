import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities';
import { VerificationRequest, EkycResult } from '../verification/entities';
import { EkycController } from './ekyc.controller';
import { EkycService } from './ekyc.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, VerificationRequest, EkycResult])],
  controllers: [EkycController],
  providers: [EkycService],
  exports: [EkycService],
})
export class EkycModule {}
