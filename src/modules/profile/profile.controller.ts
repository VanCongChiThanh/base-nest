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
import { CurrentUser } from '../../common/decorators';
import { User } from '../user/entities';

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
    return this.profileService.createEmployerProfile(user.id, dto);
  }

  @Get('employer/me')
  async getMyEmployerProfile(@CurrentUser() user: User) {
    return this.profileService.getEmployerProfile(user.id);
  }

  @Patch('employer/me')
  async updateMyEmployerProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateEmployerProfileDto,
  ) {
    return this.profileService.updateEmployerProfile(user.id, dto);
  }

  @Patch('employer/me/privacy')
  async updateEmployerPrivacy(
    @CurrentUser() user: User,
    @Body() dto: UpdateEmployerPrivacyDto,
  ) {
    return this.profileService.updateEmployerPrivacySettings(user.id, dto);
  }

  @Get('employer/:id')
  async getEmployerProfile(@Param('id', ParseUUIDPipe) id: string) {
    return this.profileService.getEmployerProfileById(id);
  }
}
