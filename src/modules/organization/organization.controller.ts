import { Controller, Get, UseGuards } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { CurrentUser } from '../../common/decorators';
import { User } from '../user/entities';
import { RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { Role } from '../../common/enums';

@Controller('organization')
@UseGuards(RolesGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get('dashboard-stats')
  @Roles(Role.ORGANIZATION, Role.RECRUITER)
  async getDashboardStats(@CurrentUser() user: User) {
    const orgId = user.role === Role.RECRUITER ? user.organizationId : user.id;
    return this.organizationService.getDashboardStats(orgId);
  }

  @Get('finance-stats')
  @Roles(Role.ORGANIZATION)
  async getFinanceStats(@CurrentUser() user: User) {
    return this.organizationService.getFinanceStats(user.id);
  }

  @Get('transactions')
  @Roles(Role.ORGANIZATION)
  async getTransactions(@CurrentUser() user: User) {
    return this.organizationService.getTransactions(user.id);
  }
}
