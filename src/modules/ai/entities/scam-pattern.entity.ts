import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('scam_patterns')
export class ScamPattern {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Category: 'deposit_scam', 'info_theft', 'fake_salary', 'pyramid', 'general'
   */
  @Column({ length: 50 })
  category: string;

  /**
   * Short pattern name
   */
  @Column()
  name: string;

  /**
   * Detailed description of the scam pattern
   */
  @Column({ type: 'text' })
  description: string;

  /**
   * Red flag indicators (keywords/phrases to watch for)
   */
  @Column({ type: 'jsonb', default: [] })
  indicators: string[];

  /**
   * Severity level: 'low', 'medium', 'high', 'critical'
   */
  @Column({ length: 20, default: 'medium' })
  severity: string;

  /**
   * Example scam descriptions for training
   */
  @Column({ type: 'text', nullable: true })
  exampleText: string;

  /**
   * Vector embedding of the combined pattern text
   */
  @Column({
    type: 'text',
    nullable: true,
    transformer: {
      to: (value: number[] | null) =>
        value ? `[${value.join(',')}]` : null,
      from: (value: string | null) => {
        if (!value) return null;
        const clean = value.replace(/[\[\]]/g, '');
        return clean ? clean.split(',').map(Number) : null;
      },
    },
  })
  embedding: number[] | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
