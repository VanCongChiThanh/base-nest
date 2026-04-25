import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import type { ConfigType } from '@nestjs/config';
import { GeminiService } from './gemini.service';
import { GraphRagService, MetadataFilter } from './graph-rag.service';
import { ChatSession, ChatMessage } from './entities';
import geminiConfig from '../../config/gemini.config';

// ─── Query Analysis ──────────────────────────────────────────────────────────

interface QueryAnalysis {
  intent: 'find_job' | 'find_candidate' | 'platform_qa' | 'general';
  category_filter: 'job_posting' | 'worker_profile' | null;
  rewritten_query: string;
}

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

    // 2. ONLY embedText (Bypass analyzeQuery to save ~800ms)
    const embedding = await this.geminiService.embedText(message);

    // 3. Query routing: Unified Graph RAG search (no intent filter)
    const { context, sources, references } = await this.routeRetrievalUnified(
      embedding,
      message,
    );

    // 4. Build prompt
    const chatHistory = session.messages.slice(-this.config.chatHistoryLimit);
    const prompt = this.buildPrompt(message, context, chatHistory, 'general');

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

    // 2. ONLY embedText (Bypass analyzeQuery to save ~800ms)
    const embedding = await this.geminiService.embedText(message);

    // 3. Query routing: Unified Graph RAG search (no intent filter)
    const { context, sources, references } = await this.routeRetrievalUnified(
      embedding,
      message,
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
    const prompt = this.buildPrompt(message, context, chatHistory, 'general');

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
        `SELECT source_id, title, content, owner_id, owner_name,
                avg_rating, price_display, province_code, is_available
         FROM graph_knowledge
         WHERE is_active = true
           AND embedding IS NOT NULL
           AND node_type = 'worker_service'
           AND is_available = true
         ORDER BY embedding::vector <=> $1::vector
         LIMIT 10`,
        [vectorStr],
      );

      this.logger.debug(`[AI Search] found ${rows.length} candidates in graph_knowledge`);
      return rows;
    } catch (error) {
      this.logger.error('AI candidate search failed', error);
      return [];
    }
  }

  /**
   * Unified Query Router:
   * Searches graph_knowledge without node_type filtering.
   * Cosine similarity naturally surfaces FAQs for questions, and Jobs/Workers for search intents.
   */
  private async routeRetrievalUnified(
    embedding: number[],
    rawQuery: string,
  ): Promise<RetrieveResult> {
    if (!embedding || embedding.length === 0) {
      return { context: '', sources: [], references: [] };
    }

    try {
      // Filter out unavailable jobs/workers, but keep FAQs (they have isAvailable = null or false, but we can't filter by true otherwise FAQs vanish)
      // Actually, GraphRagService.retrieve vector query already enforces is_active = true.
      // We will let GraphRAG retrieve the top 5 matches across ALL node types.
      const graphResult = await this.graphRagService.retrieve(
        rawQuery,
        embedding,
        {}, // No filter
      );

      if (graphResult.nodes.length > 0) {
        const references = graphResult.nodes
          .filter((n) => n.nodeType === 'job' || n.nodeType === 'worker_service')
          .filter((n) => n.isAvailable) // Only show available ones as references
          .map((n) => {
            if (n.nodeType === 'job') {
              const jobId = n.sourceId.replace('job_', '');
              return {
                type: 'job' as const,
                title: n.title,
                url: `/jobs/${jobId}`,
                salary: n.priceDisplay ?? undefined,
                location: n.address ?? undefined,
                category: n.categoryName ?? undefined,
              };
            }
            const workerId = n.ownerId ?? '';
            return {
              type: 'worker' as const,
              title: n.title,
              url: `/users/${workerId}`,
              price: n.priceDisplay ?? undefined,
              location: n.provinceCode ?? undefined,
              isAvailable: n.isAvailable,
            };
          });

        return {
          context: graphResult.context,
          sources: graphResult.sources,
          references,
        };
      }
    } catch (err) {
      this.logger.warn('[GraphRAG] Unified retrieval failed', err);
    }

    return { context: '', sources: [], references: [] };
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
  // RETRIEVAL — Query Router
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Query router:
   * - find_job / find_candidate → Graph RAG (denormalized, cached, reranked)
   * - platform_qa / general    → Legacy vector search on knowledge_embeddings
   */
  private async routeRetrieval(
    embedding: number[],
    analysis: QueryAnalysis,
    rawQuery: string,
  ): Promise<RetrieveResult> {
    if (!embedding || embedding.length === 0) {
      return { context: '', sources: [], references: [] };
    }

    // ── Route 1: Graph RAG for job/candidate search ──────────────
    if (analysis.intent === 'find_job' || analysis.intent === 'find_candidate') {
      try {
        const filter: MetadataFilter = {
          nodeType: analysis.intent === 'find_job' ? 'job' : 'worker_service',
          isAvailable: true,
        };
        const graphResult = await this.graphRagService.retrieve(
          rawQuery,
          embedding,
          filter,
        );

        if (graphResult.nodes.length > 0) {
          const references = graphResult.nodes.map((n) => {
            if (n.nodeType === 'job') {
              const jobId = n.sourceId.replace('job_', '');
              return {
                type: 'job' as const,
                title: n.title,
                url: `/jobs/${jobId}`,
                salary: n.priceDisplay ?? undefined,
                location: n.address ?? undefined,
                category: n.categoryName ?? undefined,
              };
            }
            const workerId = n.ownerId ?? '';
            return {
              type: 'worker' as const,
              title: n.title,
              url: `/users/${workerId}`,
              price: n.priceDisplay ?? undefined,
              location: n.provinceCode ?? undefined,
              isAvailable: n.isAvailable,
            };
          });
          return {
            context: graphResult.context,
            sources: graphResult.sources,
            references,
          };
        }
      } catch (err) {
        this.logger.warn('[GraphRAG] Retrieval failed, falling back to vector', err);
      }
    }

    // ── Route 2: Legacy vector search (FAQ, platform_qa, general) ─
    return this.retrieveContextLegacy(embedding, analysis);
  }

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
