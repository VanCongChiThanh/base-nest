import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ProfileService } from './profile.service';
import {
  CreateWorkerProfileDto,
  UpdateWorkerProfileDto,
  CreateEmployerProfileDto,
  UpdateEmployerProfileDto,
  UpdateWorkerPrivacyDto,
  UpdateEmployerPrivacyDto,
} from './dto';
import { CurrentUser, Public } from '../../common/decorators';
import { User } from '../user/entities';
import { Role } from '../../common/enums';

@Controller('profiles')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  // ==================== WORKER ====================

  @Post('worker')
  async createWorkerProfile(
    @CurrentUser() user: User,
    @Body() dto: CreateWorkerProfileDto,
  ) {
    return this.profileService.createWorkerProfile(user.id, dto);
  }

  @Get('worker/me')
  async getMyWorkerProfile(@CurrentUser() user: User) {
    return this.profileService.getWorkerProfile(user.id);
  }

  @Patch('worker/me')
  async updateMyWorkerProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateWorkerProfileDto,
  ) {
    return this.profileService.updateWorkerProfile(user.id, dto);
  }

  @Patch('worker/me/privacy')
  async updateWorkerPrivacy(
    @CurrentUser() user: User,
    @Body() dto: UpdateWorkerPrivacyDto,
  ) {
    return this.profileService.updateWorkerPrivacySettings(user.id, dto);
  }

  @Public()
  @Get('worker/:id')
  async getWorkerProfile(@Param('id', ParseUUIDPipe) id: string) {
    return this.profileService.getWorkerProfileById(id);
  }

  // ==================== EMPLOYER ====================

  @Post('employer')
  async createEmployerProfile(
    @CurrentUser() user: User,
    @Body() dto: CreateEmployerProfileDto,
  ) {
    const targetUserId =
      user.role === Role.RECRUITER ? user.organizationId : user.id;
    return this.profileService.createEmployerProfile(targetUserId, dto);
  }

  @Get('employer/me')
  async getMyEmployerProfile(@CurrentUser() user: User) {
    const targetUserId =
      user.role === Role.RECRUITER ? user.organizationId : user.id;
    return this.profileService.getEmployerProfile(targetUserId);
  }

  @Patch('employer/me')
  async updateMyEmployerProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateEmployerProfileDto,
  ) {
    const targetUserId =
      user.role === Role.RECRUITER ? user.organizationId : user.id;
    return this.profileService.updateEmployerProfile(targetUserId, dto);
  }

  @Patch('employer/me/privacy')
  async updateEmployerPrivacy(
    @CurrentUser() user: User,
    @Body() dto: UpdateEmployerPrivacyDto,
  ) {
    const targetUserId =
      user.role === Role.RECRUITER ? user.organizationId : user.id;
    return this.profileService.updateEmployerPrivacySettings(targetUserId, dto);
  }

  @Public()
  @Get('employer/:userId')
  async getEmployerProfile(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.profileService.getEmployerProfileByUserId(userId);
  }
}
