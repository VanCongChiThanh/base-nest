import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { JobCategory } from '../../job-category/entities/job-category.entity';

export enum ServiceType {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  BOTH = 'BOTH',
}

@Entity('worker_services')
export class WorkerServiceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'worker_id' })
  workerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'worker_id' })
  worker: User;

  @Column({ name: 'category_id' })
  categoryId: string;

  @ManyToOne(() => JobCategory)
  @JoinColumn({ name: 'category_id' })
  category: JobCategory;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'skill_ids', type: 'jsonb', default: [] })
  skillIds: string[];

  // Time availability
  @Column({ name: 'start_time', type: 'timestamp' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamp' })
  endTime: Date;

  @Column({ nullable: true })
  recurring: string; // e.g. "WEEKENDS", "EVENINGS"

  // Pricing
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ name: 'price_type', default: 'HOURLY' })
  priceType: 'HOURLY' | 'FIXED';

  @Column({ name: 'is_negotiable', default: true })
  isNegotiable: boolean;

  // Location
  @Column({ name: 'province_code', nullable: true })
  provinceCode: string;

  @Column({ name: 'ward_code', nullable: true })
  wardCode: string;

  @Column({ name: 'radius_km', nullable: true })
  radiusKm: number;

  @Column({ type: 'enum', enum: ServiceType, default: ServiceType.OFFLINE })
  type: ServiceType;

  // Portfolio
  @Column({ name: 'portfolio_urls', type: 'jsonb', default: [] })
  portfolioUrls: string[];

  // Status
  @Column({ name: 'is_available_now', default: false })
  isAvailableNow: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
