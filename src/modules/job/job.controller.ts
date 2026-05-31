import {
  Controller,
  Get,
  Post,
  Put,
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
import { Role } from '../../common/enums';
import {
  ConsumeQuota,
  CurrentUser,
  Public,
  RequireFeature,
} from '../../common/decorators';
import { User } from '../user/entities';

@Controller()
export class JobController {
  constructor(
    private readonly jobService: JobService,
    private readonly applicationChatService: ApplicationChatService,
  ) {}

  // ==================== JOB CRUD ====================

  @Post('jobs')
  @ConsumeQuota({
    counterKey: 'job.post.count',
    limitFeatureKey: 'job.post.monthly_limit',
    period: 'monthly',
  })
  async createJob(@CurrentUser() user: User, @Body() dto: CreateJobDto) {
    const employerId = user.role === Role.RECRUITER ? user.organizationId : user.id;
    const postedById = user.role === Role.RECRUITER ? user.id : null;
    return this.jobService.createJob(employerId, postedById, dto);
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
  @ConsumeQuota({
    counterKey: 'job.apply.count',
    limitFeatureKey: 'job.apply.daily_limit',
    period: 'daily',
  })
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
    const employerId = user.role === Role.RECRUITER ? user.organizationId : user.id;
    return this.jobService.getJobApplications(id, employerId, page, limit);
  }

  @Post('applications/:id/accept')
  async acceptApplication(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const employerId = user.role === Role.RECRUITER ? user.organizationId : user.id;
    return this.jobService.acceptApplication(id, employerId);
  }

  @Post('applications/:id/respond-acceptance')
  async respondApplicationAcceptance(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body('accept') accept: boolean,
  ) {
    return this.jobService.respondApplicationAcceptance(id, user.id, accept);
  }

  @Post('applications/:id/reject')
  async rejectApplication(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const employerId = user.role === Role.RECRUITER ? user.organizationId : user.id;
    return this.jobService.rejectApplication(id, employerId);
  }

  // ==================== INVITATIONS ====================

  @Post('jobs/:id/invite')
  async inviteWorkerToJob(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body('workerId') workerId: string,
  ) {
    const employerId = user.role === Role.RECRUITER ? user.organizationId : user.id;
    return this.jobService.inviteWorkerToJob(employerId, id, workerId);
  }

  @Post('invitations/:id/respond')
  async respondToInvitation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body('accept') accept: boolean,
  ) {
    return this.jobService.respondToInvitation(user.id, id, accept);
  }

  @Get('invitations/my-invitations')
  async getMyInvitations(@CurrentUser() user: User) {
    return this.jobService.getMyInvitations(user.id);
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

  @Get('applications/my-conversations')
  async getMyConversations(@CurrentUser() user: User) {
    return this.applicationChatService.listConversations(user.id);
  }

  @Post('applications/:id/messages')
  @RequireFeature({ key: 'chat.enabled' })
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
    const employerId = user.role === Role.RECRUITER ? user.organizationId : user.id;
    return this.jobService.findEmployerJobs(employerId, page, limit);
  }

  @Post('jobs/:id/cancel')
  async cancelJob(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const employerId = user.role === Role.RECRUITER ? user.organizationId : user.id;
    return this.jobService.cancelJob(id, employerId);
  }

  @Put('jobs/:id/negotiate-price')
  async negotiateDirectHirePrice(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body('proposedPrice') proposedPrice: number,
  ) {
    const app = await this.jobService.negotiateDirectHirePrice(id, user.id, proposedPrice);
    const formattedPrice = Number(proposedPrice).toLocaleString('vi-VN');
    await this.applicationChatService.postMessage(
      app.id,
      user.id, // Using user ID so we can tell who changed it if needed, though we prefix with [Hệ thống]
      `[Hệ thống] Mức giá đề xuất đã được đổi thành ${formattedPrice} VNĐ`,
    );
    return app;
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

  /** Employer mark job as complete */
  @Post('jobs/:jobId/complete')
  async completeJob(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser() user: User,
  ) {
    return this.jobService.completeJobByEmployer(jobId, user.id);
  }

  /** Worker mark assignment as complete */
  @Post('jobs/:jobId/complete-assignment')
  async completeAssignment(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser() user: User,
  ) {
    return this.jobService.completeJob(jobId, user.id);
  }
  /** Hourly Workflow: Log Hours */
  @Post('jobs/:jobId/log-hours')
  async logHours(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser() user: User,
    @Body() dto: { loggedHours: number },
  ) {
    return this.jobService.logHours(jobId, user.id, dto.loggedHours);
  }

  /** Hourly Workflow: Confirm Hours */
  @Post('jobs/:jobId/confirm-hours')
  async confirmHours(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser() user: User,
  ) {
    return this.jobService.confirmHours(jobId, user.id);
  }

  /** Hourly Workflow: Mark Paid (P2P Employer) */
  @Post('jobs/:jobId/mark-paid')
  async markPaid(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser() user: User,
  ) {
    return this.jobService.markPaid(jobId, user.id);
  }

  /** Hourly Workflow: Confirm Payment Receipt (P2P Worker) */
  @Post('jobs/:jobId/confirm-payment-receipt')
  async confirmPaymentReceipt(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser() user: User,
  ) {
    return this.jobService.confirmPaymentReceipt(jobId, user.id);
  }
}
