import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto, UserResponseDto } from './dto';
import { CurrentUser } from '../../common/decorators';
import { User } from './entities';
import { plainToInstance } from 'class-transformer';

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
}
