import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto, UserResponseDto } from './dto';
import { CurrentUser, Roles } from '../../common/decorators';
import { User } from './entities';
import { plainToInstance } from 'class-transformer';
import { RolesGuard } from '../../common/guards';
import { Role } from '../../common/enums';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * GET /users/me - get profile current user
   */
  @Get('me')
  async getProfile(@CurrentUser() user: User): Promise<UserResponseDto> {
    const fullUser = await this.userService.findById(user.id);
    return plainToInstance(UserResponseDto, fullUser);
  }

  /**
   * PATCH /users/me - Update profile current user
   */
  @Patch('me')
  async updateProfile(
    @CurrentUser() user: User,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const updatedUser = await this.userService.update(user.id, updateUserDto);
    return plainToInstance(UserResponseDto, updatedUser);
  }

  // ==================== ADMIN ====================

  /**
   * GET /users - Get all users (Admin)
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('isEmailVerified') isEmailVerified?: boolean,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
  ) {
    return this.userService.findAll({
      page,
      limit,
      search,
      role,
      isEmailVerified,
      sortBy,
      sortOrder,
    });
  }

  /**
   * GET /users/:id - Get user by ID (Admin)
   */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    const user = await this.userService.findById(id);
    return plainToInstance(UserResponseDto, user);
  }

  /**
   * PATCH /users/:id/role - Update user role (Admin)
   */
  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('role') role: string,
  ): Promise<UserResponseDto> {
    const user = await this.userService.updateRole(id, role);
    return plainToInstance(UserResponseDto, user);
  }

  /**
   * DELETE /users/:id - Delete user (Admin)
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async deleteUser(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.userService.delete(id);
    return { message: 'User deleted successfully' };
  }
}
