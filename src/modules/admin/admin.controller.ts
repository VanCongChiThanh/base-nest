import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AdminStatsService } from './admin-stats.service';
import { Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { Role } from '../../common/enums';

@Controller('admin')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminStatsService: AdminStatsService) {}

  @Get('stats')
  async getDashboardStats() {
    return this.adminStatsService.getDashboardStats();
  }

  @Get('jobs')
  async findAllJobs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.adminStatsService.findAllJobs(page, limit, status, search);
  }

  @Post('jobs/:id/close')
  async closeJob(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminStatsService.closeJob(id);
  }

  @Delete('jobs/:id')
  async deleteJob(@Param('id', ParseUUIDPipe) id: string) {
    await this.adminStatsService.deleteJob(id);
    return { message: 'Job deleted successfully' };
  }

  @Get('payments')
  async getPayments(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.adminStatsService.getPaymentOverview(page, limit, status);
  }
}
