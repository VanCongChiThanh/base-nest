import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities';
import { PlanCode } from '../../../common/enums';

export enum PaymentOrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

@Entity('payment_orders')
export class PaymentOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    name: 'plan_code',
    type: 'enum',
    enum: PlanCode,
  })
  planCode: PlanCode;

  @Column({ name: 'order_code', type: 'bigint', unique: true })
  orderCode: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column()
  description: string;

  @Column({
    type: 'enum',
    enum: PaymentOrderStatus,
    default: PaymentOrderStatus.PENDING,
  })
  status: PaymentOrderStatus;

  @Column({ name: 'payment_link_id', nullable: true })
  paymentLinkId: string;

  @Column({ name: 'checkout_url', nullable: true, type: 'text' })
  checkoutUrl: string;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date;

  @Column({ name: 'webhook_data', type: 'jsonb', nullable: true })
  webhookData: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
