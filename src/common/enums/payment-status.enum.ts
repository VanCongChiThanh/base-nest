export enum PaymentStatus {
  PENDING = 'PENDING',
  PAYMENT_CONFIRMED = 'PAYMENT_CONFIRMED',
  DISPUTED = 'DISPUTED',
  // Escrow statuses
  ESCROW_HELD = 'ESCROW_HELD',
  ESCROW_RELEASED = 'ESCROW_RELEASED',
  ESCROW_REFUNDED = 'ESCROW_REFUNDED',
}

export enum PaymentType {
  FINAL_PAYMENT = 'FINAL_PAYMENT',
  ESCROW_DEPOSIT = 'ESCROW_DEPOSIT',
  MILESTONE_RELEASE = 'MILESTONE_RELEASE',
}

export enum EscrowStatus {
  PENDING = 'PENDING', // Chờ employer thanh toán
  FUNDED = 'FUNDED', // Đã ký quỹ đủ tiền
  PARTIALLY_RELEASED = 'PARTIALLY_RELEASED', // Đã giải ngân 1 phần
  FULLY_RELEASED = 'FULLY_RELEASED', // Đã giải ngân toàn bộ
  REFUND_PENDING = 'REFUND_PENDING', // Yêu cầu hoàn tiền
  REFUNDED = 'REFUNDED', // Hoàn tiền cho employer
  DISPUTED = 'DISPUTED', // Đang tranh chấp
}
