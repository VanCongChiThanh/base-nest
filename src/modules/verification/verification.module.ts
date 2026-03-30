import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VerificationRequest } from './entities';

@Module({
  imports: [TypeOrmModule.forFeature([VerificationRequest])],
  exports: [TypeOrmModule],
})
export class VerificationModule {}
