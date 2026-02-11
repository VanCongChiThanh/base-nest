import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  ParseIntPipe,
  DefaultValuePipe,
  Sse,
  MessageEvent,
  UseGuards,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { NotificationService } from './notification.service';
import { NotificationHelper } from './notification.helper';
import { CurrentUser, Roles, Public } from '../../common/decorators';
import { Role, NotificationType } from '../../common/enums';
import { SseAuthGuard } from '../../common/guards';
import { User } from '../user/entities';
import { UserService } from '../user/user.service';
import { NotificationResponseDto } from './dto';
import { plainToInstance } from 'class-transformer';

@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly notificationHelper: NotificationHelper,
    private readonly userService: UserService,
  ) {}

  /**
   * SSE - Subscribe realtime notifications
   * GET /notifications/stream?token=xxx
   */
  @Public() // Bypass JwtAuthGuard global
  @UseGuards(SseAuthGuard) // Custom guard to auth SSE requests
  @Sse('stream')
  stream(@CurrentUser() user: User): Observable<MessageEvent> {
    return this.notificationService.subscribe(user.id);
  }

  /**
   * Get all notifications with pagination
   * GET /notifications?page=1&limit=20
   */
  @Get()
  async findAll(
    @CurrentUser() user: User,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const result = await this.notificationService.findAll(user.id, page, limit);

    return {
      data: plainToInstance(NotificationResponseDto, result.data, {
        excludeExtraneousValues: true,
      }),
      total: result.total,
      unreadCount: result.unreadCount,
      page,
      limit,
    };
  }

  /**
   * Count unread notifications
   * GET /notifications/unread-count
   */
  @Get('unread-count')
  async unreadCount(@CurrentUser() user: User) {
    const count = await this.notificationService.countUnread(user.id);
    return { unreadCount: count };
  }

  /**
   * Mark as read
   * PATCH /notifications/:id/read
   */
  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @CurrentUser() user: User) {
    await this.notificationService.markAsRead(id, user.id);
    return { message: 'OK' };
  }

  /**
   * Mark all as read
   * PATCH /notifications/read-all
   */
  @Patch('read-all')
  async markAllAsRead(@CurrentUser() user: User) {
    await this.notificationService.markAllAsRead(user.id);
    return { message: 'OK' };
  }

  /**
   * Delete notification
   * DELETE /notifications/:id
   */
  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: User) {
    await this.notificationService.delete(id, user.id);
    return { message: 'OK' };
  }

  /**
   * [ADMIN] Send broadcast notification to all users
   * POST /notifications/broadcast
   */
  @Post('broadcast')
  @Roles(Role.ADMIN)
  async broadcast(@Body() body: { content: string }) {
    const userIds = await this.userService.findAllIds();

    await this.notificationHelper.sendToMany(
      userIds,
      NotificationType.SYSTEM,
      undefined,
      { content: body.content },
    );

    return {
      message: 'Broadcast sent',
      totalUsers: userIds.length,
    };
  }
}
