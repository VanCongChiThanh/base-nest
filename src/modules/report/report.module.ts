import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { Report } from './entities';
import { Job } from '../job/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Report, Job])],
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportModule {}
