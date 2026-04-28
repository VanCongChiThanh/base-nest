import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import { GeminiService } from './gemini.service';
import { GraphKnowledge } from './entities';
import { REDIS_CLIENT } from '../redis';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MetadataFilter {
  categoryId?: string;
  provinceCode?: string;
  minRating?: number;
  maxPrice?: number;
  minPrice?: number;
  isAvailable?: boolean;
  nodeType?: string;
}

export interface GraphRetrieveResult {
  context: string;
  nodes: GraphKnowledge[];
  sources: string[];
}

// ─── Reranker scoring weights ─────────────────────────────────────────────────
const RERANK_WEIGHTS = {
  vectorScore: 0.5,
  ratingBoost: 0.25,   // avgRating / 5
  completedBoost: 0.15, // log(completedCount+1) normalized
  availableBoost: 0.1,
};

const CACHE_TTL = 120; // 2 minutes
const TOP_K = 10;
const RERANK_TOP = 5;

@Injectable()
export class GraphRagService {
  private readonly logger = new Logger(GraphRagService.name);

  constructor(
    private readonly geminiService: GeminiService,
    @InjectRepository(GraphKnowledge)
    private readonly graphRepo: Repository<GraphKnowledge>,
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC: Hybrid Retrieve
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Main entry point:
   * 1. Build cache key
   * 2. Check Redis cache
   * 3. Metadata filter → vector search (hybrid)
   * 4. Rerank results
   * 5. Cache & return
   */
  async retrieve(
    query: string,
    embedding: number[],
    filter: MetadataFilter = {},
  ): Promise<GraphRetrieveResult> {
    const cacheKey = this.buildCacheKey(query, filter);

    // 1. Cache hit
    const cached = await this.getCache(cacheKey);
    if (cached) {
      this.logger.debug(`[GraphRAG] Cache hit: ${cacheKey}`);
      return cached;
    }

    // 2. Build metadata WHERE clauses
    const { whereClause, params } = this.buildMetadataWhere(filter, embedding);

    // 3. Hybrid: metadata filter + vector search
    const rows = await this.vectorSearchWithFilter(whereClause, params, TOP_K);

    if (rows.length === 0) {
      return { context: '', nodes: [], sources: [] };
    }

    // 4. Rerank
    const reranked = this.rerank(rows, embedding);

    // 5. Build context string
    const context = reranked
      .map((r) => this.buildNodeContext(r))
      .join('\n\n---\n\n');

    const result: GraphRetrieveResult = {
      context,
      nodes: reranked,
      sources: reranked.map((r) => r.title),
    };

    // 6. Cache
    await this.setCache(cacheKey, result, CACHE_TTL);

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GRAPH BUILDER: Sync from PostgreSQL relations
  // ═══════════════════════════════════════════════════════════════════════════

  /** Build/refresh graph node for a Job */
  async syncJobNode(jobId: string): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT
         j.id, j.title, j.description, j.salary_per_hour, j."salaryType" as salary_type,
         j.address, j.province_code, j.ward_code, j.status,
         j.employer_id,
         u.first_name || ' ' || u.last_name AS owner_name,
         jc.id AS category_id, jc.name AS category_name,
         COALESCE(json_agg(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL), '[]') AS skill_names,
         COALESCE(AVG(r.rating), 0) AS avg_rating,
         COUNT(DISTINCT r.id) AS review_count,
         COUNT(DISTINCT ja.id) FILTER (WHERE ja.status = 'ACCEPTED') AS completed_count
       FROM jobs j
       LEFT JOIN users u ON u.id = j.employer_id
       LEFT JOIN job_categories jc ON jc.id = j.category_id
       LEFT JOIN job_skills js ON js.job_id = j.id
       LEFT JOIN skills s ON s.id = js.skill_id
       LEFT JOIN reviews r ON r.job_id = j.id
       LEFT JOIN job_applications ja ON ja.job_id = j.id
       WHERE j.id = $1
       GROUP BY j.id, u.first_name, u.last_name, jc.id, jc.name`,
      [jobId],
    );
    if (!rows.length) {
      // Job was deleted, deactivate existing node if any
      await this.graphRepo.update({ sourceId: `job_${jobId}` }, { isActive: false, isAvailable: false });
      return false;
    }
    const row = rows[0];

    const salary = Number(row.salary_per_hour);
    const salaryDisplay = salary
      ? `${salary.toLocaleString('vi-VN')}₫/${row.salary_type === 'HOURLY' ? 'giờ' : 'ca'}`
      : '';

    const content = this.buildJobContent(row, salaryDisplay);
    const contentHash = this.hash(content);
    const sourceId = `job_${jobId}`;

    const existing = await this.graphRepo.findOne({ where: { sourceId } });
    // Keep syncing when embedding is missing so failed/partial old runs can self-heal.
    // Without this, rows with NULL embedding are permanently skipped if content is unchanged.
    const needsEmbeddingBackfill =
      !!existing && (!Array.isArray(existing.embedding) || existing.embedding.length === 0);
    if (existing?.contentHash === contentHash && !needsEmbeddingBackfill) return false; // No change

    const edges = this.buildJobEdges(row);

    const node: Partial<GraphKnowledge> = {
      nodeType: 'job',
      sourceId,
      title: row.title,
      content,
      contentHash,
      categoryId: row.category_id ?? undefined,
      categoryName: row.category_name ?? undefined,
      skillNames: Array.isArray(row.skill_names) ? row.skill_names : [],
      provinceCode: row.province_code ? String(row.province_code) : undefined,
      wardCode: row.ward_code ? String(row.ward_code) : undefined,
      address: row.address ?? undefined,
      priceNumeric: salary,
      priceDisplay: salaryDisplay,
      avgRating: Number(row.avg_rating) || 0,
      reviewCount: Number(row.review_count) || 0,
      completedCount: Number(row.completed_count) || 0,
      isAvailable: row.status === 'OPEN',
      ownerId: row.employer_id,
      ownerName: row.owner_name,
      edges,
      isActive: row.status === 'OPEN',
    };

    await this.upsertNode(sourceId, node, existing?.id);
    return true;
  }

  /** Build/refresh graph node for a WorkerService */
  async syncWorkerServiceNode(workerServiceId: string): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT
         ws.id, ws.title, ws.description, ws.price, ws.price_type,
         ws.province_code, ws.ward_code, ws.type, ws.is_available_now,
         ws.is_active, ws.worker_id, ws.skill_ids,
         u.first_name || ' ' || u.last_name AS owner_name,
         jc.id AS category_id, jc.name AS category_name,
         COALESCE(AVG(r.rating), 0) AS avg_rating,
         COUNT(DISTINCT r.id) AS review_count,
         COUNT(DISTINCT ja.id) FILTER (WHERE ja.status = 'ACCEPTED') AS completed_count
       FROM worker_services ws
       LEFT JOIN users u ON u.id = ws.worker_id
       LEFT JOIN job_categories jc ON jc.id = ws.category_id
       LEFT JOIN reviews r ON r.reviewee_id = ws.worker_id
       LEFT JOIN job_applications ja ON ja.worker_id = ws.worker_id
       WHERE ws.id = $1
       GROUP BY ws.id, u.first_name, u.last_name, jc.id, jc.name`,
      [workerServiceId],
    );
    if (!rows.length) {
      await this.graphRepo.update({ sourceId: `worker_service_${workerServiceId}` }, { isActive: false, isAvailable: false });
      return false;
    }
    const row = rows[0];

    // Resolve skill names from skill_ids JSONB
    let skillNames: string[] = [];
    if (Array.isArray(row.skill_ids) && row.skill_ids.length > 0) {
      const skillRows = await this.dataSource.query(
        `SELECT name FROM skills WHERE id = ANY($1)`,
        [row.skill_ids],
      );
      skillNames = skillRows.map((s: any) => s.name);
    }

    const price = Number(row.price);
    const priceDisplay = price
      ? `${price.toLocaleString('vi-VN')}₫/${row.price_type === 'HOURLY' ? 'giờ' : 'lần'}`
      : '';

    const content = this.buildWorkerContent(row, skillNames, priceDisplay);
    const contentHash = this.hash(content);
    const sourceId = `worker_service_${workerServiceId}`;

    const existing = await this.graphRepo.findOne({ where: { sourceId } });
    const needsEmbeddingBackfill =
      !!existing && (!Array.isArray(existing.embedding) || existing.embedding.length === 0);
    if (existing?.contentHash === contentHash && !needsEmbeddingBackfill) return false;

    const edges = this.buildWorkerEdges(row, skillNames);

    const node: Partial<GraphKnowledge> = {
      nodeType: 'worker_service',
      sourceId,
      title: row.title,
      content,
      contentHash,
      categoryId: row.category_id ?? undefined,
      categoryName: row.category_name ?? undefined,
      skillNames,
      provinceCode: row.province_code ? String(row.province_code) : undefined,
      wardCode: row.ward_code ? String(row.ward_code) : undefined,
      address: undefined,
      priceNumeric: price,
      priceDisplay,
      avgRating: Number(row.avg_rating) || 0,
      reviewCount: Number(row.review_count) || 0,
      completedCount: Number(row.completed_count) || 0,
      isAvailable: !!row.is_available_now,
      ownerId: row.worker_id,
      ownerName: row.owner_name,
      edges,
      isActive: !!row.is_active,
    };

    await this.upsertNode(sourceId, node, existing?.id);
    return true;
  }

  /** Deactivate a graph node (job closed/cancelled) */
  async deactivateNode(sourceId: string): Promise<void> {
    await this.graphRepo.update({ sourceId }, { isActive: false });
    // Invalidate cache entries containing this node type
    await this.redis.del(`graphrag:*`).catch(() => {});
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: Vector Search with Metadata Pre-filter
  // ═══════════════════════════════════════════════════════════════════════════

  private async vectorSearchWithFilter(
    whereClause: string,
    params: unknown[],
    limit: number,
  ): Promise<GraphKnowledge[]> {
    try {
      const sql = `
        SELECT id, node_type, source_id, title, content, category_name, category_id,
               skill_names, province_code, ward_code, address,
               price_numeric, price_display, avg_rating, review_count,
               completed_count, is_available, owner_id, owner_name, edges, metadata,
               embedding::text,
               1 - (embedding::vector <=> $1::vector) AS vector_score
        FROM graph_knowledge
        WHERE is_active = true
          AND embedding IS NOT NULL
          ${whereClause}
        ORDER BY embedding::vector <=> $1::vector
        LIMIT $2
      `;
      const rows: any[] = await this.dataSource.query(sql, params);

      return rows.map((r) => {
        const node = new GraphKnowledge();
        Object.assign(node, {
          id: r.id,
          nodeType: r.node_type,
          sourceId: r.source_id,
          title: r.title,
          content: r.content,
          categoryName: r.category_name,
          categoryId: r.category_id,
          skillNames: r.skill_names ?? [],
          provinceCode: r.province_code,
          wardCode: r.ward_code,
          address: r.address,
          priceNumeric: r.price_numeric,
          priceDisplay: r.price_display,
          avgRating: Number(r.avg_rating),
          reviewCount: Number(r.review_count),
          completedCount: Number(r.completed_count),
          isAvailable: r.is_available,
          ownerId: r.owner_id,
          ownerName: r.owner_name,
          edges: r.edges ?? [],
          metadata: r.metadata ?? {},
          // attach vector_score for reranking
          ...(r.vector_score !== undefined ? { _vectorScore: Number(r.vector_score) } : {}),
        });
        return node;
      });
    } catch (err: any) {
      this.logger.warn('[GraphRAG] vectorSearchWithFilter failed', err?.message);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: Metadata WHERE builder
  // ═══════════════════════════════════════════════════════════════════════════

  private buildMetadataWhere(
    filter: MetadataFilter,
    embedding: number[],
  ): { whereClause: string; params: unknown[] } {
    const vectorStr = `[${embedding.join(',')}]`;
    const params: unknown[] = [vectorStr, TOP_K];
    const clauses: string[] = [];

    if (filter.nodeType) {
      params.push(filter.nodeType);
      clauses.push(`AND node_type = $${params.length}`);
    }
    if (filter.categoryId) {
      params.push(filter.categoryId);
      clauses.push(`AND category_id = $${params.length}`);
    }
    if (filter.provinceCode) {
      params.push(filter.provinceCode);
      clauses.push(`AND province_code = $${params.length}`);
    }
    if (filter.minRating !== undefined) {
      params.push(filter.minRating);
      clauses.push(`AND avg_rating >= $${params.length}`);
    }
    if (filter.maxPrice !== undefined) {
      params.push(filter.maxPrice);
      clauses.push(`AND price_numeric <= $${params.length}`);
    }
    if (filter.minPrice !== undefined) {
      params.push(filter.minPrice);
      clauses.push(`AND price_numeric >= $${params.length}`);
    }
    if (filter.isAvailable !== undefined) {
      clauses.push(`AND is_available = ${filter.isAvailable}`);
    }

    return { whereClause: clauses.join(' '), params };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: Lightweight Reranker
  // ═══════════════════════════════════════════════════════════════════════════

  private rerank(nodes: GraphKnowledge[], _embedding: number[]): GraphKnowledge[] {
    const scored = nodes.map((n) => {
      const vectorScore = (n as any)._vectorScore ?? 0;
      const ratingBoost = (Number(n.avgRating) || 0) / 5;
      const completedBoost =
        Math.min(Math.log((Number(n.completedCount) || 0) + 1) / 4, 1);
      const availableBoost = n.isAvailable ? 1 : 0;

      const score =
        RERANK_WEIGHTS.vectorScore * vectorScore +
        RERANK_WEIGHTS.ratingBoost * ratingBoost +
        RERANK_WEIGHTS.completedBoost * completedBoost +
        RERANK_WEIGHTS.availableBoost * availableBoost;

      return { node: n, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, RERANK_TOP)
      .map((s) => s.node);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: Content Builders
  // ═══════════════════════════════════════════════════════════════════════════

  private buildJobContent(row: any, salaryDisplay: string): string {
    const skills = Array.isArray(row.skill_names)
      ? row.skill_names.filter(Boolean).join(', ')
      : '';
    return [
      `Công việc: ${row.title}`,
      `Mô tả: ${row.description}`,
      `Lương: ${salaryDisplay}`,
      `Địa điểm: ${row.address || ''}`,
      `Danh mục: ${row.category_name || ''}`,
      skills ? `Kỹ năng yêu cầu: ${skills}` : '',
      `Nhà tuyển dụng: ${row.owner_name || ''}`,
      `Đánh giá TB: ${Number(row.avg_rating).toFixed(1)}⭐ (${row.review_count} đánh giá)`,
      `Đã hoàn thành: ${row.completed_count} lượt`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildWorkerContent(row: any, skillNames: string[], priceDisplay: string): string {
    return [
      `Dịch vụ / Sẵn sàng làm: ${row.title}`,
      `Mô tả: ${row.description}`,
      `Giá: ${priceDisplay}`,
      `Tỉnh/Thành: ${row.province_code || 'Toàn quốc'}`,
      `Loại hình: ${row.type}`,
      `Kỹ năng: ${skillNames.join(', ')}`,
      `Danh mục: ${row.category_name || ''}`,
      `Ứng viên: ${row.owner_name || ''}`,
      `Đánh giá TB: ${Number(row.avg_rating).toFixed(1)}⭐ (${row.review_count} đánh giá)`,
      `Đã hoàn thành: ${row.completed_count} việc`,
      `Trạng thái: ${row.is_available_now ? 'Sẵn sàng làm ngay' : 'Đang bận'}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildNodeContext(node: GraphKnowledge): string {
    const type = node.nodeType === 'job' ? 'JOB' : 'WORKER';
    const rating = node.avgRating ? ` | ⭐${Number(node.avgRating).toFixed(1)}` : '';
    const price = node.priceDisplay ? ` | ${node.priceDisplay}` : '';
    const skills =
      node.skillNames?.length ? ` | Kỹ năng: ${node.skillNames.join(', ')}` : '';
    return `[${type}] ${node.title}${rating}${price}${skills}\n${node.content}`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: Edge Builders
  // ═══════════════════════════════════════════════════════════════════════════

  private buildJobEdges(row: any) {
    const edges: any[] = [];
    if (row.category_id)
      edges.push({ type: 'IN_CATEGORY', targetId: row.category_id, targetType: 'category', label: row.category_name });
    if (row.employer_id)
      edges.push({ type: 'POSTED_BY', targetId: row.employer_id, targetType: 'user', label: row.owner_name });
    return edges;
  }

  private buildWorkerEdges(row: any, skillNames: string[]) {
    const edges: any[] = [];
    if (row.category_id)
      edges.push({ type: 'IN_CATEGORY', targetId: row.category_id, targetType: 'category', label: row.category_name });
    if (row.worker_id)
      edges.push({ type: 'OFFERED_BY', targetId: row.worker_id, targetType: 'user', label: row.owner_name });
    skillNames.forEach((s) =>
      edges.push({ type: 'HAS_SKILL', targetId: s, targetType: 'skill', label: s }),
    );
    return edges;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: DB Upsert
  // ═══════════════════════════════════════════════════════════════════════════

  private async upsertNode(
    sourceId: string,
    node: Partial<GraphKnowledge>,
    existingId?: string,
  ): Promise<void> {
    // Generate embedding for the node content
    let embeddingVector: number[] = [];
    try {
      if (this.geminiService.isAvailable && node.content) {
        embeddingVector = await this.geminiService.embedText(node.content);
      }
    } catch (err: any) {
      this.logger.warn(`[GraphRAG] Embedding failed for ${sourceId}`, err?.message);
    }

    const vectorStr = embeddingVector.length ? `[${embeddingVector.join(',')}]` : null;
    const meta = { sourceId, nodeType: node.nodeType };

    if (existingId) {
      await this.dataSource.query(
        `UPDATE graph_knowledge
         SET title=$1, content=$2, category_name=$3, category_id=$4,
             skill_names=$5, province_code=$6, ward_code=$7, address=$8,
             price_numeric=$9, price_display=$10, avg_rating=$11,
             review_count=$12, completed_count=$13, is_available=$14,
             owner_id=$15, owner_name=$16, edges=$17, metadata=$18,
             content_hash=$19, is_active=$20,
             ${vectorStr ? 'embedding=$21::vector,' : ''}
             updated_at=NOW()
         WHERE id=$${vectorStr ? 22 : 21}`,
        vectorStr
          ? [node.title, node.content, node.categoryName, node.categoryId,
             JSON.stringify(node.skillNames), node.provinceCode, node.wardCode,
             node.address, node.priceNumeric, node.priceDisplay, node.avgRating,
             node.reviewCount, node.completedCount, node.isAvailable,
             node.ownerId, node.ownerName, JSON.stringify(node.edges),
             JSON.stringify(meta), node.contentHash, node.isActive,
             vectorStr, existingId]
          : [node.title, node.content, node.categoryName, node.categoryId,
             JSON.stringify(node.skillNames), node.provinceCode, node.wardCode,
             node.address, node.priceNumeric, node.priceDisplay, node.avgRating,
             node.reviewCount, node.completedCount, node.isAvailable,
             node.ownerId, node.ownerName, JSON.stringify(node.edges),
             JSON.stringify(meta), node.contentHash, node.isActive, existingId],
      );
    } else {
      await this.dataSource.query(
        `INSERT INTO graph_knowledge
           (id, node_type, source_id, title, content, category_name, category_id,
            skill_names, province_code, ward_code, address, price_numeric, price_display,
            avg_rating, review_count, completed_count, is_available, owner_id, owner_name,
            edges, metadata, content_hash, is_active, embedding, created_at, updated_at)
         VALUES
           (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
            ${vectorStr ? '$23::vector' : 'NULL'},
            NOW(), NOW())`,
        vectorStr
          ? [node.nodeType, sourceId, node.title, node.content,
             node.categoryName, node.categoryId, JSON.stringify(node.skillNames),
             node.provinceCode, node.wardCode, node.address, node.priceNumeric,
             node.priceDisplay, node.avgRating, node.reviewCount, node.completedCount,
             node.isAvailable, node.ownerId, node.ownerName, JSON.stringify(node.edges),
             JSON.stringify(meta), node.contentHash, node.isActive, vectorStr]
          : [node.nodeType, sourceId, node.title, node.content,
             node.categoryName, node.categoryId, JSON.stringify(node.skillNames),
             node.provinceCode, node.wardCode, node.address, node.priceNumeric,
             node.priceDisplay, node.avgRating, node.reviewCount, node.completedCount,
             node.isAvailable, node.ownerId, node.ownerName, JSON.stringify(node.edges),
             JSON.stringify(meta), node.contentHash, node.isActive],
      );
    }

    // Invalidate related cache
    await this.invalidateCache(node.nodeType ?? '');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: Cache helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private buildCacheKey(query: string, filter: MetadataFilter): string {
    const filterStr = JSON.stringify(filter);
    const hash = crypto
      .createHash('md5')
      .update(query + filterStr)
      .digest('hex')
      .substring(0, 12);
    return `graphrag:${hash}`;
  }

  private async getCache(key: string): Promise<GraphRetrieveResult | null> {
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private async setCache(
    key: string,
    value: GraphRetrieveResult,
    ttl: number,
  ): Promise<void> {
    try {
      // Store only serializable parts (no embedding arrays)
      const slim = {
        context: value.context,
        sources: value.sources,
        nodes: value.nodes.map((n) => ({
          ...n,
          embedding: null,
        })),
      };
      await this.redis.set(key, JSON.stringify(slim), 'EX', ttl);
    } catch {
      // Cache failure is non-fatal
    }
  }

  private async invalidateCache(nodeType: string): Promise<void> {
    try {
      const keys = await this.redis.keys('graphrag:*');
      if (keys.length) await this.redis.del(...keys);
    } catch {
      // non-fatal
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: Utilities
  // ═══════════════════════════════════════════════════════════════════════════

  private hash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }
}
