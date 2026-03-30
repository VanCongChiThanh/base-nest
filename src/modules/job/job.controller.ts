import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JobService } from './job.service';
import { ApplicationChatService } from './application-chat.service';
import {
  CreateJobDto,
  ApplyJobDto,
  JobFilterDto,
  CheckInJobDto,
  PostApplicationMessageDto,
} from './dto';
import { CurrentUser, Public } from '../../common/decorators';
import { User } from '../user/entities';

@Controller()
export class JobController {
  constructor(
    private readonly jobService: JobService,
    private readonly applicationChatService: ApplicationChatService,
  ) {}

  // ==================== JOB CRUD ====================

  @Post('jobs')
  async createJob(@CurrentUser() user: User, @Body() dto: CreateJobDto) {
    return this.jobService.createJob(user.id, dto);
  }

  @Get('jobs')
  @Public()
  async findJobs(@Query() filter: JobFilterDto) {
    return this.jobService.findJobs(filter);
  }

  @Get('jobs/:id')
  @Public()
  async findJobById(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobService.findJobById(id);
  }

  // ==================== JOB APPLICATIONS ====================

  @Get('jobs/:id/my-application')
  async getMyApplication(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.jobService.getMyApplication(id, user.id);
  }

  @Post('jobs/:id/apply')
  async applyForJob(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: ApplyJobDto,
  ) {
    return this.jobService.applyForJob(id, user.id, dto);
  }

  @Post('applications/:id/cancel')
  async cancelApplication(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.jobService.cancelApplication(id, user.id);
  }

  @Get('jobs/:id/applications')
  async getJobApplications(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.jobService.getJobApplications(id, user.id, page, limit);
  }

  @Post('applications/:id/accept')
  async acceptApplication(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.jobService.acceptApplication(id, user.id);
  }

  @Post('applications/:id/reject')
  async rejectApplication(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.jobService.rejectApplication(id, user.id);
  }

  // ==================== PROGRESS APIs ====================

  @Get('applications/:id/progress')
  async getApplicationProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.jobService.getApplicationProgress(id, user.id);
  }

  @Get('applications/:id/messages')
  async getApplicationMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.applicationChatService.listMessages(id, user.id);
  }

  @Post('applications/:id/messages')
  async postApplicationMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: PostApplicationMessageDto,
  ) {
    return this.applicationChatService.postMessage(id, user.id, dto.body);
  }

  @Get('jobs/:id/progress')
  async getJobProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.jobService.getJobProgress(id, user.id);
  }

  // ==================== EMPLOYER ====================

  @Get('employer/jobs')
  async getEmployerJobs(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.jobService.findEmployerJobs(user.id, page, limit);
  }

  @Post('jobs/:id/cancel')
  async cancelJob(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.jobService.cancelJob(id, user.id);
  }

  // ==================== WORKER ====================

  @Get('worker/job-history')
  async getWorkerJobHistory(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.jobService.getWorkerJobHistory(user.id, page, limit);
  }

  /** Worker check-in: triggers IN_PROGRESS */
  @Post('jobs/:jobId/check-in')
  async checkInJob(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser() user: User,
    @Body() dto: CheckInJobDto,
  ) {
    return this.jobService.checkInJob(jobId, user.id, dto);
  }

  /** Worker mark job as complete (must be IN_PROGRESS) */
  @Post('jobs/:jobId/complete')
  async completeJob(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser() user: User,
  ) {
    return this.jobService.completeJob(jobId, user.id);
  }
}
