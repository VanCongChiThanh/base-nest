import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VerificationRequest, EkycResult } from './entities';

@Module({
  imports: [TypeOrmModule.forFeature([VerificationRequest, EkycResult])],
  exports: [TypeOrmModule],
})
export class VerificationModule {}
