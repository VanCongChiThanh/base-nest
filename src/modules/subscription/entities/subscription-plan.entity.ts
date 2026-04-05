import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PlanCode, PlanScope } from '../../../common/enums';

@Entity('subscription_plans')
export class SubscriptionPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: PlanCode,
    unique: true,
    nullable: true,
  })
  code: PlanCode | null;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: PlanScope,
    default: PlanScope.EMPLOYER,
  })
  scope: PlanScope;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ name: 'max_posts_per_month', default: 5 })
  maxPostsPerMonth: number;

  @Column({ name: 'post_expiry_days', default: 30 })
  postExpiryDays: number;

  @Column({ name: 'featured_posts', default: 0 })
  featuredPosts: number;

  @Column({
    name: 'feature_config',
    type: 'jsonb',
    default: () => "'{}'::jsonb",
  })
  featureConfig: Record<string, boolean | number | string | null>;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
