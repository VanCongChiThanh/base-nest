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
import { ConfirmPaymentDto, CreateDisputeDto, ResolveDisputeDto } from './dto';
import { CurrentUser, Roles } from '../../common/decorators';
import { User } from '../user/entities';
import { Role, DisputeStatus } from '../../common/enums';

@Controller()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // ==================== PAYMENT CONFIRMATION ====================

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
}
