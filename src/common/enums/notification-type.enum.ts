/**
 * Notification Type
 * FE will use this enum to handle different types of notifications
 */
export enum NotificationType {
  // System
  SYSTEM = 'SYSTEM',

  // Order
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_CONFIRMED = 'ORDER_CONFIRMED',
  ORDER_SHIPPED = 'ORDER_SHIPPED',
  ORDER_DELIVERED = 'ORDER_DELIVERED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',

  // Payment
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  PAYMENT_FAILED = 'PAYMENT_FAILED',

  // Social
  USER_FOLLOWED = 'USER_FOLLOWED',
  POST_LIKED = 'POST_LIKED',
  POST_COMMENTED = 'POST_COMMENTED',
  COMMENT_REPLIED = 'COMMENT_REPLIED',

  // Promotion
  PROMOTION = 'PROMOTION',
}

/**
 * Reference Type - Type of referenced entity
 */
export enum ReferenceType {
  ORDER = 'ORDER',
  PAYMENT = 'PAYMENT',
  USER = 'USER',
  POST = 'POST',
  COMMENT = 'COMMENT',
  PRODUCT = 'PRODUCT',
  PROMOTION = 'PROMOTION',
}
