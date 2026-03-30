import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities';
import {
  EmployerBadge,
  EmployerPrivacySettings,
  DEFAULT_EMPLOYER_PRIVACY,
} from '../../../common/enums';

@Entity('employer_profiles')
export class EmployerProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'company_name', nullable: true })
  companyName: string;

  @Column({ name: 'company_description', type: 'text', nullable: true })
  companyDescription: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ name: 'province_code', nullable: true })
  provinceCode: number;

  @Column({ name: 'ward_code', nullable: true })
  wardCode: number;

  @Column({ nullable: true })
  address: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number;

  @Column({
    name: 'rating_avg',
    type: 'decimal',
    precision: 3,
    scale: 2,
    default: 0,
  })
  ratingAvg: number;

  @Column({ name: 'total_reviews', default: 0 })
  totalReviews: number;

  @Column({ name: 'total_jobs_posted', default: 0 })
  totalJobsPosted: number;

  @Column({
    name: 'trust_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  trustScore: number;

  @Column({ name: 'is_verified_business', default: false })
  isVerifiedBusiness: boolean;

  @Column({
    type: 'enum',
    enum: EmployerBadge,
    default: EmployerBadge.NONE,
  })
  badge: EmployerBadge;

  @Column({
    name: 'privacy_settings',
    type: 'jsonb',
    default: () => `'${JSON.stringify(DEFAULT_EMPLOYER_PRIVACY)}'`,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  privacySettings: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
