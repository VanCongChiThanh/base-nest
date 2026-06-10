import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum JobCategoryType {
  ONLINE = 'ONLINE',
  GIG = 'GIG',
}

@Entity('job_categories')
export class JobCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: JobCategoryType,
    nullable: true,
  })
  type: JobCategoryType;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  icon: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
