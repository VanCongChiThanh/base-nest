import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('usage_counters')
@Index(['userId', 'featureKey', 'periodKey'], { unique: true })
export class UsageCounter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'feature_key' })
  featureKey: string;

  @Column({ name: 'period_key' })
  periodKey: string;

  @Column({ default: 0 })
  count: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
