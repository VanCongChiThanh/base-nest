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
import { MilestoneStatus } from '../../../common/enums';
import { Escrow } from './escrow.entity';

/**
 * Milestone — Mỗi mốc thanh toán trong escrow của job ONLINE
 *
 * Worker nộp bài → Employer duyệt → Admin giải ngân
 * Worker hoặc Employer có thể đề xuất milestone mới
 */
@Entity('milestones')
export class Milestone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'escrow_id' })
  escrowId: string;

  @ManyToOne(() => Escrow, (e) => e.milestones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'escrow_id' })
  escrow: Escrow;

  /** Thứ tự hiển thị (1-indexed) */
  @Column({ name: 'order_index', default: 1 })
  orderIndex: number;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  amount: number;

  @Column({
    type: 'enum',
    enum: MilestoneStatus,
    default: MilestoneStatus.PENDING,
  })
  status: MilestoneStatus;

  /** Worker được giao thực hiện milestone này (có thể null nếu chưa assign) */
  @Column({ name: 'worker_id', nullable: true })
  workerId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'worker_id' })
  worker: User;

  /**
   * Người đề xuất milestone (employer = false, worker = true)
   * Nếu worker đề xuất, cần employer chấp nhận trước khi có hiệu lực
   */
  @Column({ name: 'proposed_by_worker', default: false })
  proposedByWorker: boolean;

  /** Employer chấp nhận đề xuất của worker */
  @Column({ name: 'proposal_accepted', default: true })
  proposalAccepted: boolean;

  /** Worker ghi chú khi nộp deliverable */
  @Column({ name: 'submission_note', type: 'text', nullable: true })
  submissionNote: string;

  /** Employer ghi chú khi yêu cầu sửa */
  @Column({ name: 'revision_note', type: 'text', nullable: true })
  revisionNote: string;

  /** Ghi chú khi giải ngân (admin) */
  @Column({ name: 'release_note', type: 'text', nullable: true })
  releaseNote: string;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date;

  @Column({ name: 'released_at', type: 'timestamptz', nullable: true })
  releasedAt: Date;

  @Column({ name: 'worker_received_at', type: 'timestamptz', nullable: true })
  workerReceivedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
