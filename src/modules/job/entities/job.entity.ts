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
import { JobStatus, JobSalaryType, JobType } from '../../../common/enums';
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
    name: 'salary_per_hour',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  salaryPerHour: number;

  @Column({ name: 'required_workers', default: 1 })
  requiredWorkers: number;

  @Column({
    type: 'enum',
    enum: JobSalaryType,
    default: JobSalaryType.HOURLY,
  })
  salaryType: JobSalaryType;

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamptz' })
  endTime: Date;

  @Column({ name: 'province_code' })
  provinceCode: number;

  @Column({ name: 'ward_code' })
  wardCode: number;

  @Column()
  address: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number;

  @Column({
    type: 'enum',
    enum: JobType,
    default: JobType.GIG,
  })
  jobType: JobType;

  @Column({
    type: 'enum',
    enum: JobStatus,
    default: JobStatus.OPEN,
  })
  status: JobStatus;

  // === Part-time fields ===
  @Column({ name: 'contract_duration', nullable: true })
  contractDuration: string;

  @Column({ name: 'work_schedule', nullable: true })
  workSchedule: string;

  @Column({ name: 'payment_note', type: 'text', nullable: true })
  paymentNote: string;

  // === Online fields ===
  @Column({
    name: 'total_budget',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  totalBudget: number;

  @Column({ name: 'deliverable_type', nullable: true })
  deliverableType: string;

  @OneToMany(() => JobSkill, (js) => js.job)
  jobSkills: JobSkill[];

  @OneToMany(() => JobApplication, (ja) => ja.job)
  applications: JobApplication[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
