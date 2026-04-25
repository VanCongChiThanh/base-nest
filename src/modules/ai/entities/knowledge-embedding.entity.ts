import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('knowledge_embeddings')
export class KnowledgeEmbedding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Category of knowledge: 'faq', 'guide', 'policy', 'general'
   */
  @Column({ length: 50 })
  category: string;

  /**
   * The title/question (for FAQs) or heading
   */
  @Column()
  title: string;

  /**
   * The original text content
   */
  @Column({ type: 'text' })
  content: string;

  /**
   * Vector embedding stored as float array.
   * The actual DB column type is vector(768) — managed via raw SQL.
   * TypeORM transformer handles JS ↔ DB conversion.
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

  /**
   * Additional metadata (tags, source, etc.)
   */
  @Column({ type: 'jsonb', nullable: true, default: {} })
  metadata: Record<string, unknown>;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
