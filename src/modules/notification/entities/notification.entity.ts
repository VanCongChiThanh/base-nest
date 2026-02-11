import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { NotificationType, ReferenceType } from '../../../common/enums';
import { User } from '../../user/entities';

/**
 * Notification Entity
 * - BE only save: type, refType, refId, data
 * - FE render title/message based on type + data (supports i18n)
 */
@Entity('notifications')
@Index(['userId', 'isRead', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** type of notification */
  @Column({ type: 'varchar', length: 50 })
  type: NotificationType;

  /** type of referenced entity */
  @Column({ name: 'ref_type', type: 'varchar', length: 50, nullable: true })
  refType: ReferenceType | null;

  /** ID of the referenced entity */
  @Column({ name: 'ref_id', type: 'varchar', length: 100, nullable: true })
  refId: string | null;

  /** Data for FE to render message (e.g., { orderCode: 'ORD-001', amount: 500000 }) */
  @Column({ type: 'json', nullable: true })
  data: Record<string, unknown> | null;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
