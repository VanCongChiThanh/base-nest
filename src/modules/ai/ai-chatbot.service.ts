import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import type { ConfigType } from '@nestjs/config';
import * as crypto from 'crypto';
import Redis from 'ioredis';
import { GeminiService } from './gemini.service';
import { GraphRagService, MetadataFilter } from './graph-rag.service';
import { ChatSession, ChatMessage } from './entities';
import { WorkerServiceEntity } from '../worker-service/entities/worker-service.entity';
import { REDIS_CLIENT } from '../redis';
import geminiConfig from '../../config/gemini.config';

// ─── Query Analysis ──────────────────────────────────────────────────────────

type QueryIntent = 'find_job' | 'find_candidate' | 'platform_qa' | 'general';

interface QueryAnalysis {
  intent: QueryIntent;
  category_filter: 'job_posting' | 'worker_profile' | null;
  rewritten_query: string;
}

const INTENT_CACHE_PREFIX = 'chatbot:intent:';
const INTENT_CACHE_TTL = 60 * 60 * 24; // 24h
const INTENT_LLM_TIMEOUT_MS = 1500;

// Score gap threshold to declare a node-type "dominant" in vector search.
// If top score for a type beats the other type by this margin → exclusive.
// Tuned empirically: < 0.05 too noisy, > 0.15 too strict.
const DOMINANT_TYPE_SCORE_GAP = 0.08;

const QUERY_ANALYSIS_SYSTEM = `Bạn là bộ phân tích truy vấn cho hệ thống RAG của GigWork (nền tảng việc làm thời vụ).

Phân tích câu hỏi và trả về JSON theo schema:
{
  "intent": "find_job" | "find_candidate" | "platform_qa" | "general",
  "category_filter": "job_posting" | "worker_profile" | null,
  "rewritten_query": "<từ khóa tìm kiếm ngắn gọn tiếng Việt>"
}

Quy tắc:
- find_job       → người dùng hỏi về công việc/việc làm/tuyển dụng    → category_filter = "job_posting"
- find_candidate → người dùng tìm thợ/ứng viên/người làm              → category_filter = "worker_profile"
- platform_qa    → hỏi cách dùng nền tảng, eKYC, ứng tuyển, thanh toán → category_filter = null
- general        → câu hỏi chung                                       → category_filter = null
- rewritten_query: giữ nguyên tên địa danh, loại việc, kỹ năng; loại bỏ từ đệm hỏi han.

Chỉ trả về JSON.`;

// ─── Platform smart links ────────────────────────────────────────────────────

const PLATFORM_LINK_MAP: {
  patterns: string[];
  title: string;
  url: string;
  description: string;
}[] = [
  {
    patterns: ['ekyc', 'xác thực', 'định danh', 'kyc', 'cmnd', 'cccd', 'căn cước'],
    title: 'Xác thực tài khoản (eKYC)',
    url: '/profile/kyc',
    description: 'Xác minh danh tính để mở khóa tính năng đầy đủ',
  },
  {
    patterns: ['ứng tuyển', 'apply', 'nộp đơn', 'tìm việc', 'jobs'],
    title: 'Tìm việc & Ứng tuyển',
    url: '/jobs',
    description: 'Duyệt tất cả công việc đang tuyển',
  },
  {
    patterns: ['hồ sơ', 'profile', 'cá nhân', 'thông tin'],
    title: 'Hồ sơ cá nhân',
    url: '/profile',
    description: 'Quản lý thông tin cá nhân',
  },
  {
    patterns: ['thanh toán', 'payment', 'ví', 'tiền', 'giao dịch'],
    title: 'Ví & Thanh toán',
    url: '/profile/payment',
    description: 'Quản lý giao dịch và thanh toán',
  },
  {
    patterns: ['gói', 'subscription', 'nâng cấp', 'pricing', 'cước'],
    title: 'Gói dịch vụ',
    url: '/pricing',
    description: 'Xem và nâng cấp gói dịch vụ',
  },
  {
    patterns: ['đánh giá', 'review', 'rating', 'nhận xét'],
    title: 'Đánh giá & Nhận xét',
    url: '/reviews',
    description: 'Xem đánh giá từ nhà tuyển dụng / ứng viên',
  },
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface KnowledgeRow {
  id: string;
  title: string;
  content: string;
  category: string;
  metadata: Record<string, unknown>;
}

export interface JobReference {
  type: 'job';
  title: string;
  url: string;
  salary?: string;
  location?: string;
  category?: string;
}

export interface WorkerReference {
  type: 'worker';
  title: string;
  url: string;
  price?: string;
  location?: string;
  isAvailable?: boolean;
}

export interface PlatformLink {
  type: 'platform';
  title: string;
  url: string;
  description?: string;
}

export type ChatReference = JobReference | WorkerReference | PlatformLink;

export interface ChatResponse {
  message: string;
  sessionId: string;
  sources?: string[];
  references?: ChatReference[];
}

interface RetrieveResult {
  context: string;
  sources: string[];
  references: ChatReference[];
}

// ─── System prompt for generation ────────────────────────────────────────────

const GENERATION_SYSTEM = `Bạn là trợ lý chuyên nghiệp của GigWork — nền tảng kết nối việc làm thời vụ và lao động rảnh rỗi.

Nhiệm vụ:
- Hỗ trợ Q&A về cách dùng nền tảng, tạo hồ sơ, ứng tuyển, thanh toán.
- Nếu người dùng tìm việc hoặc tìm ứng viên và ngữ cảnh có dữ liệu phù hợp,
  hãy liệt kê TRỰC TIẾP (tên, địa điểm, lương/giá). KHÔNG hướng dẫn dùng bộ lọc nếu đã có dữ liệu.

Quy tắc:
1. Trả lời tiếng Việt, thân thiện, đi thẳng vào vấn đề.
2. Chỉ dùng dữ liệu trong phần "Ngữ cảnh" — KHÔNG bịa đặt.
3. Nếu không có dữ liệu phù hợp, nói rõ và gợi ý người dùng dùng bộ lọc tìm kiếm.
4. Trình bày danh sách dễ đọc khi có nhiều kết quả.`;

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class AiChatbotService {
  private readonly logger = new Logger(AiChatbotService.name);

  constructor(
    private readonly geminiService: GeminiService,
    private readonly graphRagService: GraphRagService,
    @InjectRepository(ChatSession)
    private readonly chatSessionRepo: Repository<ChatSession>,
    @Inject(geminiConfig.KEY)
    private readonly config: ConfigType<typeof geminiConfig>,
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * LLM-native RAG pipeline — optimised for speed:
   *
   * [PARALLEL] analyzeQuery (LLM JSON) + embedText (raw query)
   *    → Vector search with category_filter from analysis
   *    → Build typed references (job cards / worker cards / platform links)
   *    → LLM generates response
   *
   * Running analysis and embedding in parallel saves ~400-700ms vs sequential.
   * The raw-query embedding is used for retrieval; the rewritten_query from
   * analysis is only used for logging / future re-ranking.
   */
  async chat(
    userId: string,
    message: string,
    sessionId?: string,
  ): Promise<ChatResponse> {
    if (!this.geminiService.isAvailable) {
      return {
        message: 'Xin lỗi, tính năng AI chưa được cấu hình. Vui lòng liên hệ admin.',
        sessionId: sessionId || '',
      };
    }

    // 1. Session
    let session = sessionId
      ? await this.chatSessionRepo.findOne({ where: { id: sessionId, userId } })
      : null;

    if (!session) {
      session = this.chatSessionRepo.create({
        userId,
        messages: [],
        title: message.substring(0, 100),
      });
      session = await this.chatSessionRepo.save(session);
    }

    // 2. Embed + analyze intent in PARALLEL
    //    - embedText: needed for vector search
    //    - resolveIntent: cached LLM call, with timeout fallback
    //    Total wall time = max(embed, intent) ≈ embed time only (intent often cached / faster)
    const [embedding, analysis] = await Promise.all([
      this.geminiService.embedText(message),
      this.resolveIntent(message),
    ]);

    // 3. Query routing: intent-aware Graph RAG search with score-based safety net
    const { context, sources, references } = await this.routeRetrievalUnified(
      embedding,
      analysis.rewritten_query || message,
      analysis.intent,
    );

    // 4. Build prompt
    const chatHistory = session.messages.slice(-this.config.chatHistoryLimit);
    const prompt = this.buildPrompt(message, context, chatHistory, analysis.intent);

    // 5. Generate response
    const response = await this.geminiService.generateContent(prompt, GENERATION_SYSTEM);

    // 6. Persist
    session.messages.push(
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      { role: 'assistant', content: response, timestamp: new Date().toISOString() },
    );
    await this.chatSessionRepo.save(session);

    return {
      message: response,
      sessionId: session.id,
      sources: sources.length > 0 ? sources : undefined,
      references: references.length > 0 ? references : undefined,
    };
  }

  async *chatStream(
    userId: string,
    message: string,
    sessionId?: string,
  ): AsyncGenerator<{ chunk?: string; metadata?: any; isDone?: boolean }> {
    if (!this.geminiService.isAvailable) {
      yield { chunk: 'Xin lỗi, tính năng AI chưa được cấu hình. Vui lòng liên hệ admin.', isDone: true };
      return;
    }

    // 1. Session
    let session = sessionId
      ? await this.chatSessionRepo.findOne({ where: { id: sessionId, userId } })
      : null;

    if (!session) {
      session = this.chatSessionRepo.create({
        userId,
        messages: [],
        title: message.substring(0, 100),
      });
      session = await this.chatSessionRepo.save(session);
    }

    // 2. Embed + analyze intent in PARALLEL (cached + timeout-protected)
    const [embedding, analysis] = await Promise.all([
      this.geminiService.embedText(message),
      this.resolveIntent(message),
    ]);

    // 3. Query routing: intent-aware Graph RAG search with score-based safety net
    const { context, sources, references } = await this.routeRetrievalUnified(
      embedding,
      analysis.rewritten_query || message,
      analysis.intent,
    );

    // Yield metadata first so UI can show references immediately
    yield {
      metadata: {
        sessionId: session.id,
        sources: sources.length > 0 ? sources : undefined,
        references: references.length > 0 ? references : undefined,
      },
    };

    // 4. Build prompt
    const chatHistory = session.messages.slice(-this.config.chatHistoryLimit);
    const prompt = this.buildPrompt(message, context, chatHistory, analysis.intent);

    // 5. Generate stream
    const stream = await this.geminiService.generateContentStream(prompt, GENERATION_SYSTEM);
    
    let fullResponse = '';
    for await (const chunk of stream) {
      const chunkText = chunk.text || '';
      if (chunkText) {
        fullResponse += chunkText;
        yield { chunk: chunkText };
      }
    }

    // 6. Persist
    session.messages.push(
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      { role: 'assistant', content: fullResponse, timestamp: new Date().toISOString() },
    );
    await this.chatSessionRepo.save(session);

    yield { isDone: true };
  }

  async getChatHistory(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<{ data: ChatSession[]; total: number; page: number; limit: number }> {
    const [data, total] = await this.chatSessionRepo.findAndCount({
      where: { userId, isActive: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async getSession(sessionId: string, userId: string): Promise<ChatSession | null> {
    return this.chatSessionRepo.findOne({ where: { id: sessionId, userId } });
  }

  getSuggestions(): string[] {
    return [
      'Cách tạo hồ sơ trên GigWork?',
      'Làm sao để ứng tuyển công việc?',
      'Cách nhận biết tin tuyển dụng lừa đảo?',
      'Quy trình thanh toán như thế nào?',
      'eKYC là gì và tại sao cần xác thực?',
      'Làm sao để đánh giá nhà tuyển dụng?',
    ];
  }

  async searchCandidates(query: string): Promise<Record<string, unknown>[]> {
    if (!this.geminiService.isAvailable) {
      this.logger.warn('Gemini not available. AI candidate search skipped.');
      return [];
    }

    try {
      const embedding = await this.geminiService.embedText(query);
      if (!embedding || embedding.length === 0) return [];

      const vectorStr = `[${embedding.join(',')}]`;
      const rows = await this.dataSource.query(
        `SELECT source_id
         FROM graph_knowledge
         WHERE is_active = true
           AND embedding IS NOT NULL
           AND node_type = 'worker_service'
           AND is_available = true
         ORDER BY embedding::vector <=> $1::vector
         LIMIT 10`,
        [vectorStr],
      );

      if (rows.length === 0) return [];

      const ids = rows.map((r: any) => r.source_id.replace('worker_service_', ''));

      const qb = this.dataSource.getRepository(WorkerServiceEntity).createQueryBuilder('ws')
        .leftJoin('ws.worker', 'worker')
        .addSelect([
          'worker.id',
          'worker.firstName',
          'worker.lastName',
          'worker.avatarUrl',
          'worker.role',
          'worker.email',
          'worker.isEmailVerified',
          'worker.verificationLevel',
        ])
        .leftJoinAndSelect('ws.category', 'category')
        .where('ws.id IN (:...ids)', { ids });

      const services = await qb.getMany();

      this.logger.debug(`[AI Search] found ${services.length} candidates in database`);
      return ids.map(id => services.find(s => s.id === id)).filter(Boolean);
    } catch (error) {
      this.logger.error('AI candidate search failed', error);
      return [];
    }
  }

  /**
   * Hybrid Query Router (LLM intent + score-based dominance):
   *
   * 1. find_job / find_candidate → trust LLM, hard filter by nodeType.
   * 2. platform_qa               → FAQ/guide/policy lookup + platform links.
   * 3. general                   → search all types, then resolve dominant
   *                                  type by vector score gap.
   *
   * Why: pure keyword matching breaks on natural language ("có ai rảnh chụp ảnh"),
   * but pure LLM is slow and costs $. Combining both — LLM for clear cases,
   * score gap for ambiguous ones — keeps both speed and accuracy as the
   * vocabulary/system grows.
   */
  private async routeRetrievalUnified(
    embedding: number[],
    rawQuery: string,
    intent: QueryIntent,
  ): Promise<RetrieveResult> {
    if (!embedding || embedding.length === 0) {
      return { context: '', sources: [], references: [] };
    }

    if (intent === 'find_job' || intent === 'find_candidate') {
      return this.runGraphRetrieval(rawQuery, embedding, {
        nodeType: intent === 'find_job' ? 'job' : 'worker_service',
        isAvailable: true,
      });
    }

    if (intent === 'platform_qa') {
      return this.retrieveContextLegacy(embedding, {
        intent: 'platform_qa',
        category_filter: null,
        rewritten_query: rawQuery,
      });
    }

    // 'general' → search all available, then resolve by score dominance
    try {
      const graphResult = await this.graphRagService.retrieve(
        rawQuery,
        embedding,
        { isAvailable: true },
      );

      const candidateNodes = graphResult.nodes.filter(
        (n) =>
          (n.nodeType === 'job' || n.nodeType === 'worker_service') &&
          n.isAvailable,
      );

      if (candidateNodes.length === 0) {
        return { context: graphResult.context, sources: graphResult.sources, references: [] };
      }

      const dominantType = this.resolveDominantType(candidateNodes);
      const filteredNodes = dominantType
        ? candidateNodes.filter((n) => n.nodeType === dominantType)
        : candidateNodes;

      return {
        context: graphResult.context,
        sources: graphResult.sources,
        references: filteredNodes.map((n) => this.toReference(n)),
      };
    } catch (err) {
      this.logger.warn('[GraphRAG] Unified retrieval failed', err);
    }

    return { context: '', sources: [], references: [] };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async runGraphRetrieval(
    rawQuery: string,
    embedding: number[],
    filter: MetadataFilter,
  ): Promise<RetrieveResult> {
    try {
      const graphResult = await this.graphRagService.retrieve(rawQuery, embedding, filter);

      const references = graphResult.nodes
        .filter(
          (n) =>
            (n.nodeType === 'job' || n.nodeType === 'worker_service') &&
            n.isAvailable,
        )
        .map((n) => this.toReference(n));

      return {
        context: graphResult.context,
        sources: graphResult.sources,
        references,
      };
    } catch (err) {
      this.logger.warn('[GraphRAG] Filtered retrieval failed', err);
      return { context: '', sources: [], references: [] };
    }
  }

  /**
   * Decide if one node type clearly dominates by vector score.
   * Returns 'job' / 'worker_service' if the gap exceeds DOMINANT_TYPE_SCORE_GAP,
   * otherwise null (= keep mixed).
   *
   * Uses per-type best score (not average) so a single highly-relevant node wins.
   */
  private resolveDominantType(
    nodes: { nodeType: string; _vectorScore?: number }[],
  ): 'job' | 'worker_service' | null {
    let bestJob = -Infinity;
    let bestWorker = -Infinity;

    for (const n of nodes) {
      const score = (n as { _vectorScore?: number })._vectorScore ?? 0;
      if (n.nodeType === 'job' && score > bestJob) bestJob = score;
      else if (n.nodeType === 'worker_service' && score > bestWorker) bestWorker = score;
    }

    if (bestJob === -Infinity) return 'worker_service';
    if (bestWorker === -Infinity) return 'job';

    const gap = Math.abs(bestJob - bestWorker);
    if (gap < DOMINANT_TYPE_SCORE_GAP) return null; // genuinely mixed

    return bestJob > bestWorker ? 'job' : 'worker_service';
  }

  private toReference(n: {
    nodeType: string;
    sourceId: string;
    title: string;
    priceDisplay?: string | null;
    address?: string | null;
    categoryName?: string | null;
    ownerId?: string | null;
    provinceCode?: string | null;
    isAvailable?: boolean;
  }): ChatReference {
    if (n.nodeType === 'job') {
      const jobId = n.sourceId.replace('job_', '');
      return {
        type: 'job',
        title: n.title,
        url: `/jobs/${jobId}`,
        salary: n.priceDisplay ?? undefined,
        location: n.address ?? undefined,
        category: n.categoryName ?? undefined,
      };
    }
    const workerId = n.ownerId ?? '';
    return {
      type: 'worker',
      title: n.title,
      url: `/users/${workerId}`,
      price: n.priceDisplay ?? undefined,
      location: n.provinceCode ?? undefined,
      isAvailable: n.isAvailable,
    };
  }

  /**
   * Resolve query intent with multi-layer strategy:
   * 1. Redis cache (24h, normalized key) → ~1ms
   * 2. LLM analyzeQuery with 1.5s timeout → ~300-700ms
   * 3. Fallback to 'general' on any failure → score-based dominance handles routing
   */
  private async resolveIntent(query: string): Promise<QueryAnalysis> {
    const cacheKey = INTENT_CACHE_PREFIX + this.hashQuery(query);

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as QueryAnalysis;
    } catch {
      /* cache miss is non-fatal */
    }

    const analysis = await this.analyzeQueryWithTimeout(query);

    try {
      await this.redis.set(cacheKey, JSON.stringify(analysis), 'EX', INTENT_CACHE_TTL);
    } catch {
      /* non-fatal */
    }

    return analysis;
  }

  private async analyzeQueryWithTimeout(query: string): Promise<QueryAnalysis> {
    const fallback: QueryAnalysis = {
      intent: 'general',
      category_filter: null,
      rewritten_query: query,
    };

    return Promise.race<QueryAnalysis>([
      this.analyzeQuery(query),
      new Promise<QueryAnalysis>((resolve) =>
        setTimeout(() => resolve(fallback), INTENT_LLM_TIMEOUT_MS),
      ),
    ]).catch(() => fallback);
  }

  private hashQuery(query: string): string {
    const normalized = query.trim().toLowerCase().replace(/\s+/g, ' ');
    return crypto.createHash('md5').update(normalized).digest('hex').substring(0, 16);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUERY ANALYSIS
  // ═══════════════════════════════════════════════════════════════════════════

  private async analyzeQuery(userQuery: string): Promise<QueryAnalysis> {
    const fallback: QueryAnalysis = {
      intent: 'general',
      category_filter: null,
      rewritten_query: userQuery,
    };

    try {
      const result = await this.geminiService.generateJson<QueryAnalysis>(
        userQuery,
        QUERY_ANALYSIS_SYSTEM,
      );

      if (!result?.intent || !result?.rewritten_query) return fallback;

      const validIntents = ['find_job', 'find_candidate', 'platform_qa', 'general'];
      const validCategories = ['job_posting', 'worker_profile', null];
      if (!validIntents.includes(result.intent)) return fallback;
      if (!validCategories.includes(result.category_filter ?? null)) return fallback;

      return result;
    } catch (err) {
      this.logger.warn('[RAG] Query analysis failed, using fallback', err);
      return fallback;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RETRIEVAL — FAQ / guides (used by platform_qa intent)
  // ═══════════════════════════════════════════════════════════════════════════

  /** FAQ/guide/policy retrieval — queries graph_knowledge with static node_types */
  private async retrieveContextLegacy(
    embedding: number[],
    analysis: QueryAnalysis,
  ): Promise<RetrieveResult> {
    try {
      const vectorStr = `[${embedding.join(',')}]`;
      // Filter to static content only (FAQ/guide/policy — not job/worker)
      const staticTypes = "'faq','guide','policy','general','safety'";
      const params: unknown[] = [vectorStr, 10];

      let categoryClause = '';
      if (analysis.category_filter) {
        params.push(analysis.category_filter);
        categoryClause = `AND category_name = $${params.length}`;
      }

      const rows: KnowledgeRow[] = await this.dataSource.query(
        `SELECT source_id AS id, title, content, node_type AS category, metadata
         FROM graph_knowledge
         WHERE is_active = true
           AND embedding IS NOT NULL
           AND node_type IN (${staticTypes})
           ${categoryClause}
         ORDER BY embedding::vector <=> $1::vector
         LIMIT $2`,
        params,
      );

      if (rows.length === 0) {
        const platformRefs = this.buildPlatformLinks(analysis.rewritten_query);
        return { context: '', sources: [], references: platformRefs };
      }

      const context = rows
        .map((r) => `[${r.category}] ${r.title}:\n${r.content}`)
        .join('\n\n---\n\n');

      return {
        context,
        sources: rows.map((r) => r.title),
        references: this.buildReferences(rows, analysis),
      };
    } catch (error) {
      this.logger.warn('[RAG] retrieveContextLegacy failed', error);
      return { context: '', sources: [], references: [] };
    }
  }

  /**
   * Build typed reference objects from knowledge rows + analysis intent.
   * Job rows → JobReference (with salary, location, category from metadata)
   * Worker rows → WorkerReference (with price, location from metadata)
   * Platform intent → PlatformLink (smart action links from keyword map)
   */
  private buildReferences(rows: KnowledgeRow[], analysis: QueryAnalysis): ChatReference[] {
    const refs: ChatReference[] = [];
    const seen = new Set<string>();

    for (const r of rows) {
      if (r.category === 'job_posting' && r.metadata?.jobId) {
        const jobId = String(r.metadata.jobId);
        if (seen.has(`job:${jobId}`)) continue;
        seen.add(`job:${jobId}`);
        const parsed = this.parseJobContent(r.content);
        refs.push({
          type: 'job',
          title: r.title,
          url: `/jobs/${jobId}`,
          salary: (r.metadata.salaryDisplay as string | undefined) ?? parsed.salary,
          location: (r.metadata.location as string | undefined) ?? parsed.location,
          category: r.metadata.categoryName as string | undefined,
        });
      } else if (r.category === 'worker_profile' && r.metadata?.workerId) {
        const workerId = String(r.metadata.workerId);
        if (seen.has(`worker:${workerId}`)) continue;
        seen.add(`worker:${workerId}`);
        refs.push({
          type: 'worker',
          title: r.title,
          url: `/users/${workerId}`,
          price: r.metadata.priceDisplay as string | undefined,
          location: r.metadata.location as string | undefined,
          isAvailable: r.metadata.isAvailable as boolean | undefined,
        });
      }
    }

    // Add platform links when answering platform_qa queries
    if (analysis.intent === 'platform_qa') {
      refs.push(...this.buildPlatformLinks(analysis.rewritten_query));
    }

    return refs;
  }

  /**
   * Map keywords in the rewritten query to relevant platform action links.
   */
  private buildPlatformLinks(query: string): PlatformLink[] {
    const q = query.toLowerCase();
    const links: PlatformLink[] = [];

    for (const entry of PLATFORM_LINK_MAP) {
      if (entry.patterns.some((p) => q.includes(p))) {
        links.push({
          type: 'platform',
          title: entry.title,
          url: entry.url,
          description: entry.description,
        });
      }
    }

    return links;
  }

  /**
   * Backward-compatible extraction for old embeddings that may not yet include
   * salary/location metadata. Reads canonical lines from stored content text.
   */
  private parseJobContent(content: string): { salary?: string; location?: string } {
    const salaryMatch = content.match(/Lương:\s*([^\n]+)/i);
    const locationMatch = content.match(/Địa điểm:\s*([^\n]+)/i);
    const salary = salaryMatch?.[1]?.trim();
    const location = locationMatch?.[1]?.trim();
    return {
      salary: salary && salary.length > 0 ? salary : undefined,
      location: location && location.length > 0 ? location : undefined,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROMPT BUILDING
  // ═══════════════════════════════════════════════════════════════════════════

  private buildPrompt(
    userMessage: string,
    context: string,
    chatHistory: ChatMessage[],
    intent: QueryAnalysis['intent'],
  ): string {
    const parts: string[] = [];

    if (context) {
      const label =
        intent === 'find_job'
          ? 'Danh sách công việc phù hợp'
          : intent === 'find_candidate'
            ? 'Danh sách ứng viên / thợ phù hợp'
            : 'Thông tin tham khảo';
      parts.push(`Ngữ cảnh — ${label}:\n${context}\n`);
    }

    if (chatHistory.length > 0) {
      const historyText = chatHistory
        .map((m) => `${m.role === 'user' ? 'Người dùng' : 'Trợ lý'}: ${m.content}`)
        .join('\n');
      parts.push(`Lịch sử hội thoại:\n${historyText}\n`);
    }

    parts.push(`Người dùng hỏi: ${userMessage}`);
    return parts.join('\n');
  }
}
