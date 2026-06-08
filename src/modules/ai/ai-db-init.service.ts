import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Runs once at startup to ensure:
 * 1. pg_trgm extension is enabled (needed for fast ILIKE / trigram search on Vietnamese text)
 * 2. Performance indexes are in place
 * 3. Duplicate embedding rows (caused by the old "always INSERT" bug) are cleaned up
 */
@Injectable()
export class AiDbInitService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AiDbInitService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.ensureExtensions();
    await this.ensureGraphKnowledgeTable();
    await this.ensureIndexes();
    await this.deduplicateEmbeddings();
  }

  private async ensureExtensions(): Promise<void> {
    try {
      await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
      this.logger.log('pg_trgm extension ready');
    } catch (err: any) {
      this.logger.warn('Could not enable pg_trgm (non-fatal):', err?.message);
    }
  }

  async ensureGraphKnowledgeTable(): Promise<void> {
    try {
      // Create graph_knowledge table if not exists
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS graph_knowledge (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          node_type VARCHAR(30) NOT NULL,
          source_id VARCHAR(200) NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          embedding vector(768),
          category_name TEXT,
          category_id TEXT,
          skill_names JSONB DEFAULT '[]',
          province_code TEXT,
          ward_code TEXT,
          address TEXT,
          price_numeric DECIMAL(12,2),
          price_display TEXT,
          avg_rating DECIMAL(3,2),
          review_count INT DEFAULT 0,
          completed_count INT DEFAULT 0,
          is_available BOOLEAN DEFAULT true,
          owner_id TEXT,
          owner_name TEXT,
          edges JSONB DEFAULT '[]',
          metadata JSONB DEFAULT '{}',
          is_active BOOLEAN DEFAULT true,
          content_hash TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          CONSTRAINT uq_graph_source_id UNIQUE (source_id)
        )
      `);
      this.logger.log('✅ graph_knowledge table ready');
    } catch (err: any) {
      this.logger.warn('Could not create graph_knowledge table:', err?.message);
    }
  }

  private async ensureIndexes(): Promise<void> {
    const indexes: { name: string; sql: string }[] = [
      // ─── knowledge_embeddings indexes ──────────────────────────
      {
        name: 'idx_ke_content_trgm',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ke_content_trgm
              ON knowledge_embeddings
              USING GIN ((lower(coalesce(title,'') || ' ' || coalesce(content,''))) gin_trgm_ops)`,
      },
      {
        name: 'idx_ke_category_active',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ke_category_active
              ON knowledge_embeddings (category)
              WHERE is_active = true`,
      },
      {
        name: 'idx_ke_source_id',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ke_source_id
              ON knowledge_embeddings ((metadata->>'sourceId'))
              WHERE is_active = true`,
      },
      // ─── graph_knowledge indexes ────────────────────────────────
      {
        name: 'idx_gk_node_type_active',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gk_node_type_active
              ON graph_knowledge (node_type)
              WHERE is_active = true`,
      },
      {
        name: 'idx_gk_category_active',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gk_category_active
              ON graph_knowledge (category_id)
              WHERE is_active = true`,
      },
      {
        name: 'idx_gk_province_active',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gk_province_active
              ON graph_knowledge (province_code)
              WHERE is_active = true`,
      },
      {
        name: 'idx_gk_price_active',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gk_price_active
              ON graph_knowledge (price_numeric)
              WHERE is_active = true`,
      },
      {
        name: 'idx_gk_rating_active',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gk_rating_active
              ON graph_knowledge (avg_rating DESC)
              WHERE is_active = true`,
      },
      {
        name: 'idx_gk_available',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gk_available
              ON graph_knowledge (is_available, node_type)
              WHERE is_active = true`,
      },
      {
        name: 'idx_gk_skill_names',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gk_skill_names
              ON graph_knowledge USING GIN (skill_names jsonb_path_ops)`,
      },
    ];

    for (const idx of indexes) {
      try {
        await this.dataSource.query(idx.sql);
        this.logger.debug(`Index ready: ${idx.name}`);
      } catch (err: any) {
        // "already exists" → fine; any other error → warn but continue
        if (!err?.message?.includes('already exists')) {
          this.logger.warn(`Index ${idx.name} skipped: ${err?.message}`);
        }
      }
    }

    this.logger.log('AI knowledge_embeddings indexes ensured');
  }

  /**
   * Remove duplicate embedding rows for the same sourceId.
   * Keeps the most recently updated row per sourceId.
   * This cleans up rows created by the old "always INSERT" bug.
   */
  private async deduplicateEmbeddings(): Promise<void> {
    try {
      const result = await this.dataSource.query(`
        WITH ranked AS (
          SELECT
            id,
            ROW_NUMBER() OVER (
              PARTITION BY metadata->>'sourceId'
              ORDER BY updated_at DESC, created_at DESC
            ) AS rn
          FROM knowledge_embeddings
          WHERE metadata->>'sourceId' IS NOT NULL
        )
        DELETE FROM knowledge_embeddings
        WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
        RETURNING id
      `);

      const deleted = Array.isArray(result) ? result.length : 0;
      if (deleted > 0) {
        this.logger.warn(
          `Cleaned up ${deleted} duplicate embedding row(s) — one fresh record kept per source`,
        );
      } else {
        this.logger.debug('No duplicate embeddings found');
      }
    } catch (err: any) {
      this.logger.warn('Deduplication skipped (non-fatal):', err?.message);
    }
  }
}
