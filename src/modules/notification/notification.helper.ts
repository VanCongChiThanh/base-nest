import { Injectable } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationType, ReferenceType } from '../../common/enums';

/**
 * Map type -> refType mặc định
 * FE sẽ dùng để navigate
 */
const TYPE_TO_REF: Partial<Record<NotificationType, ReferenceType>> = {
  [NotificationType.ORDER_CREATED]: ReferenceType.ORDER,
  [NotificationType.ORDER_CONFIRMED]: ReferenceType.ORDER,
  [NotificationType.ORDER_SHIPPED]: ReferenceType.ORDER,
  [NotificationType.ORDER_DELIVERED]: ReferenceType.ORDER,
  [NotificationType.ORDER_CANCELLED]: ReferenceType.ORDER,
  [NotificationType.PAYMENT_SUCCESS]: ReferenceType.PAYMENT,
  [NotificationType.PAYMENT_FAILED]: ReferenceType.PAYMENT,
  [NotificationType.USER_FOLLOWED]: ReferenceType.USER,
  [NotificationType.POST_LIKED]: ReferenceType.POST,
  [NotificationType.POST_COMMENTED]: ReferenceType.POST,
  [NotificationType.COMMENT_REPLIED]: ReferenceType.COMMENT,
  [NotificationType.PROMOTION]: ReferenceType.PROMOTION,
};

/**
 * NotificationHelper - API đơn giản
 *
 * @example
 * // Order notification
 * await notify.send(userId, NotificationType.ORDER_CREATED, orderId, { orderCode: 'ORD-001' });
 *
 * // Social notification
 * await notify.send(userId, NotificationType.USER_FOLLOWED, followerId, { userName: 'John' });
 *
 * // Custom notification với data
 * await notify.send(userId, NotificationType.PAYMENT_SUCCESS, paymentId, { amount: 500000 });
 */
@Injectable()
export class NotificationHelper {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Gửi notification
   * @param userId - User nhận notification
   * @param type - Loại notification (FE dùng để render title/message)
   * @param refId - ID của entity liên quan (optional)
   * @param data - Data để FE render (optional)
   */
  async send(
    userId: string,
    type: NotificationType,
    refId?: string,
    data?: Record<string, unknown>,
  ) {
    const refType = TYPE_TO_REF[type];
    return this.notificationService.push(userId, type, refType, refId, data);
  }

  /**
   * Send to many users
   */
  async sendToMany(
    userIds: string[],
    type: NotificationType,
    refId?: string,
    data?: Record<string, unknown>,
  ) {
    const refType = TYPE_TO_REF[type];
    return this.notificationService.pushToMany(
      userIds,
      type,
      refType,
      refId,
      data,
    );
  }
}
