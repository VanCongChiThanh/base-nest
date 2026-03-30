import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { WorkerSkill } from '../../profile/entities/worker-skill.entity';
import { JobSkill } from '../../job/entities/job-skill.entity';

@Entity('skills')
export class Skill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @OneToMany(() => WorkerSkill, (ws) => ws.skill)
  workerSkills: WorkerSkill[];

  @OneToMany(() => JobSkill, (js) => js.skill)
  jobSkills: JobSkill[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
