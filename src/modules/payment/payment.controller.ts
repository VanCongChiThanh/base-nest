import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { EscrowService } from './escrow.service';
import {
  ConfirmPaymentDto,
  CreateDisputeDto,
  ResolveDisputeDto,
  CreateEscrowDto,
  SubmitMilestoneDto,
  ReviewMilestoneDto,
  ReleaseMilestoneDto,
  ProposeMilestoneDto,
} from './dto';
import { CurrentUser, Roles } from '../../common/decorators';
import { User } from '../user/entities';
import { Role, DisputeStatus } from '../../common/enums';

@Controller()
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly escrowService: EscrowService,
  ) {}

  // ==================== PAYMENT CONFIRMATION (GIG / PART-TIME) ====================

  @Post('jobs/:jobId/confirm-payment')
  async confirmPayment(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser() user: User,
    @Body() dto: ConfirmPaymentDto,
  ) {
    return this.paymentService.confirmFinalPayment(jobId, user.id, dto);
  }

  @Get('jobs/:jobId/payments')
  async getJobPayments(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser() user: User,
  ) {
    return this.paymentService.getPaymentsByJob(jobId, user.id);
  }

  @Get('worker/payments')
  async getMyPayments(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.paymentService.getMyPayments(user.id, page, limit);
  }

  // ==================== DISPUTES ====================

  @Post('jobs/:jobId/disputes')
  async createDispute(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateDisputeDto,
  ) {
    return this.paymentService.createDispute(jobId, user.id, dto);
  }

  @Get('jobs/:jobId/disputes')
  async getJobDisputes(@Param('jobId', ParseUUIDPipe) jobId: string) {
    return this.paymentService.getDisputesByJob(jobId);
  }

  // ==================== ADMIN DISPUTE MANAGEMENT ====================

  @Roles(Role.ADMIN)
  @Get('admin/disputes')
  async getAllDisputes(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: DisputeStatus,
  ) {
    return this.paymentService.getDisputes(page, limit, status);
  }

  @Roles(Role.ADMIN)
  @Post('admin/disputes/:id/resolve')
  async resolveDispute(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.paymentService.resolveDispute(id, user.id, dto);
  }

  @Roles(Role.ADMIN)
  @Post('admin/disputes/:id/dismiss')
  async dismissDispute(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.paymentService.dismissDispute(id, user.id, dto);
  }

  // ==================== ESCROW (ONLINE JOBS) ====================

  /**
   * POST /escrow
   * Employer tạo escrow + milestones cho job ONLINE
   * → Trả về PayOS checkout URL để employer thanh toán ký quỹ
   */
  @Post('escrow')
  async createEscrow(
    @CurrentUser() user: User,
    @Body() dto: CreateEscrowDto,
  ) {
    return this.escrowService.createEscrow(user.id, dto);
  }

  /**
   * GET /escrow/job/:jobId
   * Lấy thông tin escrow + danh sách milestones của job
   */
  @Get('escrow/job/:jobId')
  async getEscrowByJob(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser() user: User,
  ) {
    return this.escrowService.getEscrowByJob(jobId, user.id);
  }

  /**
   * GET /escrow/sync/:orderCode
   * Sync trạng thái thanh toán PayOS (fallback nếu webhook thất bại)
   */
  @Get('escrow/sync/:orderCode')
  async syncEscrowDeposit(
    @Param('orderCode') orderCode: string,
  ) {
    return this.escrowService.syncEscrowDepositStatus(Number(orderCode));
  }

  /**
   * POST /escrow/milestones/:id/submit
   * Worker nộp deliverable cho milestone
   */
  @Post('escrow/milestones/:id/submit')
  async submitMilestone(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: SubmitMilestoneDto,
  ) {
    return this.escrowService.submitMilestone(id, user.id, dto);
  }

  /**
   * POST /escrow/milestones/:id/review
   * Employer duyệt hoặc yêu cầu sửa milestone
   */
  @Post('escrow/milestones/:id/review')
  async reviewMilestone(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: ReviewMilestoneDto,
  ) {
    return this.escrowService.reviewMilestone(id, user.id, dto);
  }

  /**
   * POST /escrow/milestones/:id/propose
   * Worker đề xuất milestone mới cho job đang chạy
   */
  @Post('escrow/milestones/:jobId/propose')
  async proposeMilestone(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser() user: User,
    @Body() dto: ProposeMilestoneDto,
  ) {
    return this.escrowService.proposeMilestone(jobId, user.id, dto);
  }

  /**
   * POST /escrow/milestones/:id/respond-proposal
   * Employer chấp nhận hoặc từ chối milestone worker đề xuất
   */
  @Post('escrow/milestones/:id/respond-proposal')
  async respondToProposal(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body('accept') accept: boolean,
  ) {
    return this.escrowService.respondToProposal(id, user.id, accept);
  }

  // ==================== ADMIN: GIẢI NGÂN ====================

  /**
   * POST /admin/escrow/milestones/:id/release
   * Admin xác nhận đã chuyển tiền cho worker → giải ngân milestone
   */
  @Roles(Role.ADMIN)
  @Post('admin/escrow/milestones/:id/release')
  async releaseMilestonePayment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: ReleaseMilestoneDto,
  ) {
    return this.escrowService.releaseMilestonePayment(id, user.id, dto);
  }

  /**
   * POST /admin/escrow/:id/refund
   * Admin hoàn tiền escrow cho employer (khi dispute hoặc cancel)
   */
  @Roles(Role.ADMIN)
  @Post('admin/escrow/:id/refund')
  async refundEscrow(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body('reason') reason: string,
  ) {
    return this.escrowService.refundEscrow(id, user.id, reason);
  }
}
