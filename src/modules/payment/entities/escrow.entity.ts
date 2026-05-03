import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Job } from '../../job/entities';
import { User } from '../../user/entities';
import { EscrowStatus } from '../../../common/enums';
import { Milestone } from './milestone.entity';

/**
 * Escrow — Quản lý ký quỹ thanh toán trung gian cho Job ONLINE
 *
 * Luồng:
 * 1. Employer tạo escrow + milestones → PayOS link
 * 2. Employer thanh toán → webhook → status FUNDED
 * 3. Worker thực hiện + nộp từng milestone
 * 4. Employer duyệt → Admin giải ngân → status RELEASED
 */
@Entity('escrows')
export class Escrow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'job_id', unique: true })
  jobId: string;

  @ManyToOne(() => Job, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: Job;

  @Column({ name: 'employer_id' })
  employerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employer_id' })
  employer: User;

  /** Tổng tiền milestones (chưa gồm phí) */
  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  totalAmount: number;

  /** Phí dịch vụ = 5% of totalAmount */
  @Column({
    name: 'service_fee',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  serviceFee: number;

  /** Số tiền employer cần trả = totalAmount + serviceFee */
  @Column({
    name: 'charge_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  chargeAmount: number;

  /** Số tiền đã giải ngân cho worker */
  @Column({
    name: 'released_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  releasedAmount: number;

  @Column({
    type: 'enum',
    enum: EscrowStatus,
    default: EscrowStatus.PENDING,
  })
  status: EscrowStatus;

  /** PayOS order code để tra cứu payment */
  @Column({ name: 'payos_order_code', type: 'bigint', nullable: true })
  payosOrderCode: number;

  /** PayOS payment link ID */
  @Column({ name: 'payos_payment_link_id', nullable: true })
  payosPaymentLinkId: string;

  /** URL thanh toán PayOS */
  @Column({ name: 'payos_checkout_url', nullable: true })
  payosCheckoutUrl: string;

  /** Thời điểm employer đã thanh toán */
  @Column({ name: 'funded_at', type: 'timestamptz', nullable: true })
  fundedAt: Date;

  @OneToMany(() => Milestone, (m) => m.escrow)
  milestones: Milestone[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
