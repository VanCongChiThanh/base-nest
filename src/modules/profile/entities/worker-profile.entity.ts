import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities';
import { WorkerSkill } from './worker-skill.entity';
import {
  WorkerPrivacySettings,
  DEFAULT_WORKER_PRIVACY,
} from '../../../common/enums';

@Entity('worker_profiles')
export class WorkerProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: Date;

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

  @Column({ name: 'is_available', default: true })
  isAvailable: boolean;

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

  @Column({ name: 'total_jobs_completed', default: 0 })
  totalJobsCompleted: number;

  @OneToMany(() => WorkerSkill, (ws) => ws.workerProfile)
  workerSkills: WorkerSkill[];

  @Column({
    name: 'privacy_settings',
    type: 'jsonb',
    default: () => `'${JSON.stringify(DEFAULT_WORKER_PRIVACY)}'`,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  privacySettings: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
