import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto, UserResponseDto, CreateBankAccountDto, UpdateBankAccountDto } from './dto';
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
   * GET /users/:id/public - public profile
   */
  @Get(':id/public')
  async getPublicProfile(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Partial<UserResponseDto>> {
    const user = await this.userService.findById(id);
    // Return only safe fields
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    } as any;
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

  // ==================== BANK ACCOUNTS ====================

  @Get('me/bank-accounts')
  @UseGuards(RolesGuard)
  @Roles(Role.USER)
  async getMyBankAccounts(@CurrentUser() user: User) {
    return this.userService.getBankAccounts(user.id);
  }

  @Post('me/bank-accounts')
  @UseGuards(RolesGuard)
  @Roles(Role.USER)
  async addBankAccount(
    @CurrentUser() user: User,
    @Body() dto: CreateBankAccountDto,
  ) {
    return this.userService.addBankAccount(user.id, dto);
  }

  @Patch('me/bank-accounts/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.USER)
  async updateBankAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateBankAccountDto,
  ) {
    return this.userService.updateBankAccount(user.id, id, dto);
  }

  @Delete('me/bank-accounts/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.USER)
  async deleteBankAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.userService.deleteBankAccount(user.id, id);
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
