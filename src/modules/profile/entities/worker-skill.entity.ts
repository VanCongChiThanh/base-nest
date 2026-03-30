import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { WorkerProfile } from './worker-profile.entity';
import { Skill } from '../../skill/entities/skill.entity';

@Entity('worker_skills')
@Unique(['workerProfileId', 'skillId'])
export class WorkerSkill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'worker_profile_id' })
  workerProfileId: string;

  @ManyToOne(() => WorkerProfile, (wp) => wp.workerSkills, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'worker_profile_id' })
  workerProfile: WorkerProfile;

  @Column({ name: 'skill_id' })
  skillId: string;

  @ManyToOne(() => Skill, (s) => s.workerSkills, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skill_id' })
  skill: Skill;

  @Column({ name: 'years_of_experience', nullable: true })
  yearsOfExperience: number;
}
