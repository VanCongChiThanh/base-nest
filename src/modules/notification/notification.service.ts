import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { Notification } from './entities';
import { CreateNotificationDto } from './dto';
import { NotificationType, ReferenceType } from '../../common/enums';
import { NOTIFICATION_ERRORS, NotFoundException } from '../../common';

interface NotificationEvent {
  userId: string;
  notification: Notification;
}

@Injectable()
export class NotificationService {
  private notificationSubject = new Subject<NotificationEvent>();

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  /**
   * Push notification
   * BE just store type + refType + refId + data
   * FE will render title/message based on type + data (support i18n)
   */
  async push(
    userId: string,
    type: NotificationType,
    refType?: ReferenceType,
    refId?: string,
    data?: Record<string, unknown>,
  ): Promise<Notification> {
    const notification = this.notificationRepository.create({
      userId,
      type,
      refType: refType || null,
      refId: refId || null,
      data: data || null,
    });

    const saved = await this.notificationRepository.save(notification);

    // Emit realtime
    this.notificationSubject.next({ userId, notification: saved });

    return saved;
  }

  /**
   * Push notification to many users
   */
  async pushToMany(
    userIds: string[],
    type: NotificationType,
    refType?: ReferenceType,
    refId?: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const notifications = userIds.map((userId) =>
      this.notificationRepository.create({
        userId,
        type,
        refType: refType || null,
        refId: refId || null,
        data: data || null,
      }),
    );

    const saved = await this.notificationRepository.save(notifications);

    saved.forEach((notification) => {
      this.notificationSubject.next({
        userId: notification.userId,
        notification,
      });
    });
  }

  /**
   * Subscribe SSE stream
   */
  subscribe(userId: string): Observable<MessageEvent> {
    return this.notificationSubject.asObservable().pipe(
      filter((event) => event.userId === userId),
      map((event) => ({ data: event.notification }) as MessageEvent),
    );
  }

  /**
   * Get all notifications with pagination
   */
  async findAll(userId: string, page = 1, limit = 20) {
    const [data, total] = await this.notificationRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    const unreadCount = await this.notificationRepository.count({
      where: { userId, isRead: false },
    });

    return { data, total, unreadCount };
  }

  /**
   * Count unread notifications
   */
  async countUnread(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: string, userId: string): Promise<void> {
    await this.notificationRepository.update({ id, userId }, { isRead: true });
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true },
    );
  }

  /**
   * Delete notification
   */
  async delete(id: string, userId: string): Promise<void> {
    const result = await this.notificationRepository.delete({ id, userId });
    if (result.affected === 0) {
      throw new NotFoundException(NOTIFICATION_ERRORS.NOTIFICATION_NOT_FOUND);
    }
  }

  /**
   * Delete many notifications
   */
  async deleteMany(ids: string[], userId: string): Promise<void> {
    await this.notificationRepository.delete({ id: In(ids), userId });
  }

  /**
   * Create from DTO
   */
  async create(dto: CreateNotificationDto): Promise<Notification> {
    return this.push(dto.userId, dto.type, dto.refType, dto.refId, dto.data);
  }
}
