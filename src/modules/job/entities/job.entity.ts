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
import { User } from '../../user/entities';
import { JobCategory } from '../../job-category/entities';
import {
  JobStatus,
  JobSalaryType,
  JobType,
  OnlinePaymentType,
  ExperienceLevel,
  PaymentMethod,
} from '../../../common/enums';
import { JobSkill } from './job-skill.entity';
import { JobApplication } from './job-application.entity';

@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employer_id' })
  employerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employer_id' })
  employer: User;

  @Column({ name: 'category_id', nullable: true })
  categoryId: string;

  @ManyToOne(() => JobCategory, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category: JobCategory;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: JobType,
    default: JobType.GIG,
    name: 'job_type',
  })
  jobType: JobType;

  @Column({
    type: 'enum',
    enum: JobStatus,
    default: JobStatus.OPEN,
  })
  status: JobStatus;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: PaymentMethod,
    default: PaymentMethod.P2P,
  })
  paymentMethod: PaymentMethod;

  // ──────────────────────────────────────────
  // GIG / PART_TIME fields
  // ──────────────────────────────────────────

  /** Lương (đ/giờ hoặc đ/công). Null với ONLINE jobs */
  @Column({
    name: 'salary_per_hour',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  salaryPerHour: number | null;

  @Column({
    type: 'enum',
    enum: JobSalaryType,
    default: JobSalaryType.HOURLY,
    nullable: true,
  })
  salaryType: JobSalaryType | null;

  @Column({ name: 'required_workers', default: 1 })
  requiredWorkers: number;

  /** Thời gian bắt đầu. Null với ONLINE jobs (dùng deadline thay thế) */
  @Column({ name: 'start_time', type: 'timestamptz', nullable: true })
  startTime: Date | null;

  /** Thời gian kết thúc. Null với ONLINE jobs */
  @Column({ name: 'end_time', type: 'timestamptz', nullable: true })
  endTime: Date | null;

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

  // ──────────────────────────────────────────
  // PART_TIME extra fields
  // ──────────────────────────────────────────

  @Column({ name: 'contract_duration', nullable: true })
  contractDuration: string;

  @Column({ name: 'work_schedule', nullable: true })
  workSchedule: string;

  @Column({ name: 'payment_note', type: 'text', nullable: true })
  paymentNote: string;

  // ──────────────────────────────────────────
  // ONLINE job fields (Upwork-style)
  // ──────────────────────────────────────────

  /**
   * Hình thức thanh toán online:
   * FIXED_PRICE – khoán toàn bộ (dùng totalBudget)
   * HOURLY_RATE – theo giờ (dùng hourlyRateMin/Max)
   */
  @Column({
    name: 'online_payment_type',
    type: 'enum',
    enum: OnlinePaymentType,
    nullable: true,
  })
  onlinePaymentType: OnlinePaymentType | null;

  /** Ngân sách tổng – dùng khi FIXED_PRICE */
  @Column({
    name: 'total_budget',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  totalBudget: number | null;

  /** Rate tối thiểu (đ/giờ) – dùng khi HOURLY_RATE */
  @Column({
    name: 'hourly_rate_min',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  hourlyRateMin: number | null;

  /** Rate tối đa (đ/giờ) – dùng khi HOURLY_RATE */
  @Column({
    name: 'hourly_rate_max',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  hourlyRateMax: number | null;

  /** Deadline dự án. Dùng cho ONLINE thay vì startTime/endTime */
  @Column({ name: 'deadline', type: 'timestamptz', nullable: true })
  deadline: Date | null;

  /** Mức độ kinh nghiệm yêu cầu */
  @Column({
    name: 'experience_level',
    type: 'enum',
    enum: ExperienceLevel,
    nullable: true,
  })
  experienceLevel: ExperienceLevel | null;

  /** Loại sản phẩm giao nộp: FILE, LINK, TEXT, CODE, OTHER */
  @Column({ name: 'deliverable_type', nullable: true })
  deliverableType: string;

  /** Phạm vi công việc ngắn gọn (scope) */
  @Column({ name: 'project_scope', type: 'text', nullable: true })
  projectScope: string | null;

  @OneToMany(() => JobSkill, (js) => js.job)
  jobSkills: JobSkill[];

  @OneToMany(() => JobApplication, (ja) => ja.job)
  applications: JobApplication[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // ──────────────────────────────────────────
  // DIRECT HIRE fields
  // ──────────────────────────────────────────

  @Column({ name: 'is_direct_hire', default: false })
  isDirectHire: boolean;

  @Column({ name: 'target_worker_id', nullable: true })
  targetWorkerId: string;
}
