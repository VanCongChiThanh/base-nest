import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Denormalized Graph Knowledge — combines entity data + relations + stats
 * into a single row for ultra-fast retrieval.
 *
 * Design: Instead of separate graph_nodes/graph_edges tables (requiring JOINs),
 * each row contains the entity itself plus its pre-joined relations:
 *   - skills[]          (from job_skills / worker_service.skillIds)
 *   - categoryName      (from job_categories)
 *   - location          (province, ward, address)
 *   - rating stats      (avg, count — precomputed from reviews)
 *   - related entity IDs (employerId, completedJobIds, etc.)
 *
 * This allows metadata-first filtering BEFORE vector search,
 * dramatically reducing the candidate set.
 */
/**
 * `synchronize: false` is INTENTIONAL and critical.
 *
 * The `embedding` column is a pgvector `vector(768)` type, which TypeORM 0.3.x
 * does not understand (it's declared here as `text` only so the transformer can
 * read/write it). With global `synchronize: true`, TypeORM would "correct" the
 * column back to `text` on every boot, which then triggered AiSeedService to
 * DROP & recreate it — wiping ALL embeddings to NULL on every deploy.
 *
 * By opting this single entity out of schema sync, TypeORM never touches the
 * table: the column stays `vector(768)` permanently and embeddings survive
 * deploys. The table/columns/indexes are managed via raw SQL in
 * AiDbInitService + AiSeedService instead.
 */
@Entity('graph_knowledge', { synchronize: false })
@Index('idx_gk_node_type', ['nodeType'])
@Index('idx_gk_source_id', ['sourceId'], { unique: true })
@Index('idx_gk_is_active', ['isActive'])
export class GraphKnowledge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Type of node: 'job' | 'worker_service' | 'user' | 'faq'
   */
  @Column({ name: 'node_type', length: 30 })
  nodeType: string;

  /**
   * Unique source identifier, e.g. 'job_{uuid}', 'worker_service_{uuid}'
   */
  @Column({ name: 'source_id', length: 200 })
  sourceId: string;

  @Column()
  title: string;

  /**
   * Rich text content for embedding — includes denormalized relations
   */
  @Column({ type: 'text' })
  content: string;

  /**
   * Precomputed embedding vector (768-dim, managed via raw SQL)
   */
  @Column({
    type: 'text',
    nullable: true,
    transformer: {
      to: (value: number[] | null) => (value ? `[${value.join(',')}]` : null),
      from: (value: string | null) => {
        if (!value) return null;
        const clean = value.replace(/[\[\]]/g, '');
        return clean ? clean.split(',').map(Number) : null;
      },
    },
  })
  embedding: number[] | null;

  // ─── Denormalized Metadata for Filtering ──────────────────────

  /** Category name (denormalized from job_categories) */
  @Column({ name: 'category_name', type: 'varchar', nullable: true })
  categoryName: string | null;

  /** Category ID for exact match */
  @Column({ name: 'category_id', type: 'varchar', nullable: true })
  categoryId: string | null;

  /** Skill names as array (denormalized) */
  @Column({ name: 'skill_names', type: 'jsonb', default: [] })
  skillNames: string[];

  /** Province code for location filtering */
  @Column({ name: 'province_code', type: 'varchar', nullable: true })
  provinceCode: string | null;

  /** Ward code for finer location filtering */
  @Column({ name: 'ward_code', type: 'varchar', nullable: true })
  wardCode: string | null;

  /** Full address text */
  @Column({ type: 'varchar', nullable: true })
  address: string | null;

  /** Salary/price numeric for range filtering */
  @Column({
    name: 'price_numeric',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  priceNumeric: number;

  /** Display-friendly salary/price string */
  @Column({ name: 'price_display', type: 'varchar', nullable: true })
  priceDisplay: string | null;

  /** Average rating (precomputed from reviews) */
  @Column({
    name: 'avg_rating',
    type: 'decimal',
    precision: 3,
    scale: 2,
    nullable: true,
  })
  avgRating: number;

  /** Number of reviews */
  @Column({ name: 'review_count', default: 0 })
  reviewCount: number;

  /** Number of completed jobs (for workers) or total jobs posted (for employers) */
  @Column({ name: 'completed_count', default: 0 })
  completedCount: number;

  /** Is worker currently available? */
  @Column({ name: 'is_available', default: true })
  isAvailable: boolean;

  /** Owner/employer/worker user ID */
  @Column({ name: 'owner_id', type: 'varchar', nullable: true })
  ownerId: string | null;

  /** Owner display name */
  @Column({ name: 'owner_name', type: 'varchar', nullable: true })
  ownerName: string | null;

  /**
   * Graph edges as JSONB — related entity references
   * Format: [{ type: 'HAS_SKILL', targetId: '...', targetType: 'skill', label: 'Phục vụ' }, ...]
   */
  @Column({ type: 'jsonb', default: [] })
  edges: GraphEdge[];

  /**
   * Extra metadata catch-all
   */
  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /** Content hash to detect changes */
  @Column({ name: 'content_hash', nullable: true })
  contentHash: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

export interface GraphEdge {
  type: string; // 'HAS_SKILL' | 'IN_CATEGORY' | 'LOCATED_IN' | 'POSTED_BY' | 'COMPLETED_BY'
  targetId: string;
  targetType: string; // 'skill' | 'category' | 'location' | 'user'
  label: string; // Human readable
}
