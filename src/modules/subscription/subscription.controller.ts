import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, Public, Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { Role, PlanCode } from '../../common/enums';
import { User } from '../user/entities';
import { AssignPlanDto } from './dto';
import { SubscriptionService } from './subscription.service';

@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Public()
  @Get('plans/public')
  async getPublicPlans(@Query('scope') scope?: string) {
    return this.subscriptionService.getPublicPlans(scope as any);
  }

  @Get('me/entitlements')
  async getMyEntitlements(@CurrentUser() user: User) {
    return this.subscriptionService.getEntitlementsForUser(user);
  }

  @Get('me/usage')
  async getMyUsage(@CurrentUser() user: User) {
    return this.subscriptionService.getUsageSnapshot(user.id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin/assign-plan/:userId')
  async assignPlan(
    @CurrentUser() admin: User,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AssignPlanDto,
  ) {
    return this.subscriptionService.assignPlan(admin.id, userId, dto);
  }

  @Post('checkout')
  async createCheckout(
    @CurrentUser() user: User,
    @Body('planCode') planCode: PlanCode,
  ) {
    return this.subscriptionService.createCheckout(user.id, planCode);
  }

  @Get('checkout/sync/:orderCode')
  async syncCheckoutStatus(
    @CurrentUser() user: User,
    @Param('orderCode') orderCode: string,
  ) {
    return this.subscriptionService.syncOrderCodeStatus(Number(orderCode));
  }

  @Public()
  @Post('payos-webhook')
  async handlePayosWebhook(@Body() body: any) {
    return this.subscriptionService.handleWebhook(body);
  }
}
