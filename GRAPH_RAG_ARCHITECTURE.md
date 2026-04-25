# 🧠 Kiến Trúc Graph RAG Chatbot — GigWork

> **Cập nhật:** 2026-04-25  
> **Stack:** NestJS · PostgreSQL + pgvector · Redis · BullMQ · Gemini AI

---

## 1. Tổng Quan

GigWork Chatbot sử dụng kiến trúc **Hybrid Graph RAG** — kết hợp:

| Kỹ thuật | Áp dụng |
|---|---|
| **Denormalized Graph** | Bảng `graph_knowledge` chứa entity + relations + stats trong 1 row |
| **Metadata Filter** | Lọc trước vector search giảm candidate set |
| **Hybrid Retrieval** | Metadata filter → vector cosine search → graph context |
| **Lightweight Reranker** | Score = 50% vector + 25% rating + 15% completed + 10% available |
| **Redis Caching** | Cache kết quả 2 phút theo MD5 hash(query + filter) |
| **Query Routing** | find_job/find_candidate → Graph RAG · platform_qa/general → Legacy vector |
| **Precomputed Embeddings** | Content hash để skip re-embed khi nội dung không đổi |
| **Indexing Strategy** | 8 indexes trên `graph_knowledge` cho từng dimension lọc |

---

## 2. Sơ Đồ Pipeline

```
User Query
    │
    ├─[PARALLEL]─────────────────────────────────────┐
    │                                                 │
Query Analysis (LLM JSON)               Embed Query (Gemini)
    │                                                 │
    └──────────────── Query Router ───────────────────┘
                           │
          ┌────────────────┴──────────────────┐
          │                                   │
   find_job / find_candidate         platform_qa / general
          │                                   │
   Graph RAG Pipeline              Legacy Vector Search
   (graph_knowledge)               (knowledge_embeddings)
          │
   MetadataFilter Build
   (nodeType, province, category, price, rating)
          │
   Vector Search WITH pre-filter
   (embedding <=> $vector ORDER BY cosine)
          │
   Lightweight Reranker
   (vector 50% + rating 25% + completed 15% + available 10%)
          │
   Redis Cache (2 min TTL)
          │
          └──── Build Context + References ───┘
                          │
               LLM Generate Response
                          │
              Response + Job/Worker Cards
```

---

## 3. Cấu Trúc Bảng `graph_knowledge`

**Denormalized design** — 1 row = 1 entity + tất cả relations đã JOIN sẵn:

```sql
CREATE TABLE graph_knowledge (
  id             UUID PRIMARY KEY,
  node_type      VARCHAR(30),         -- 'job' | 'worker_service'
  source_id      VARCHAR(200) UNIQUE, -- 'job_{uuid}' | 'worker_service_{uuid}'
  title          TEXT,
  content        TEXT,                -- Rich text for embedding
  embedding      vector(768),         -- Precomputed Gemini embedding

  -- Denormalized relations (no JOIN cần ở query time)
  category_name  TEXT,                -- FROM job_categories
  category_id    TEXT,
  skill_names    JSONB,               -- ['Phục vụ', 'Pha chế', ...]
  province_code  TEXT,
  ward_code      TEXT,
  address        TEXT,

  -- Precomputed stats
  price_numeric  DECIMAL(12,2),       -- Filter theo giá
  price_display  TEXT,                -- '150.000đ/giờ'
  avg_rating     DECIMAL(3,2),        -- Precomputed AVG(reviews.rating)
  review_count   INT,
  completed_count INT,                -- COUNT(applications COMPLETED)
  is_available   BOOLEAN,

  -- Owner
  owner_id       TEXT,
  owner_name     TEXT,

  -- Graph edges (denormalized JSONB)
  edges          JSONB,               -- [{type:'HAS_SKILL', targetId, label}]

  content_hash   TEXT,                -- MD5 — skip re-embed nếu không đổi
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMP,
  updated_at     TIMESTAMP
);
```

---

## 4. Indexing Strategy (8 indexes)

```sql
-- Partial indexes (chỉ active rows — nhỏ hơn, nhanh hơn)
idx_gk_node_type_active   ON (node_type) WHERE is_active = true
idx_gk_category_active    ON (category_id) WHERE is_active = true
idx_gk_province_active    ON (province_code) WHERE is_active = true
idx_gk_price_active       ON (price_numeric) WHERE is_active = true
idx_gk_rating_active      ON (avg_rating DESC) WHERE is_active = true
idx_gk_available          ON (is_available, node_type) WHERE is_active = true

-- GIN index cho JSONB array search
idx_gk_skill_names        ON (skill_names jsonb_path_ops)

-- Unique constraint
UNIQUE (source_id)
```

---

## 5. Metadata Filter → Vector Search

```sql
-- Ví dụ: "Tìm thợ điện ở Quận 1 giá dưới 200k"
SELECT ..., 1 - (embedding <=> $1::vector) AS vector_score
FROM graph_knowledge
WHERE is_active = true
  AND embedding IS NOT NULL
  AND node_type = 'worker_service'   -- metadata
  AND province_code = '79'           -- metadata  
  AND price_numeric <= 200000        -- metadata
  AND is_available = true            -- metadata
ORDER BY embedding <=> $1::vector    -- vector (trên tập đã lọc nhỏ)
LIMIT 10
```

---

## 6. Lightweight Reranker

```
Score = 0.50 × vector_score       (cosine similarity)
      + 0.25 × (avg_rating / 5)   (quality boost)
      + 0.15 × log(completed+1)/4 (experience boost)
      + 0.10 × is_available       (availability boost)
```

Top-10 → **rerank → top-5** — không gọi thêm LLM, zero overhead.

---

## 7. Redis Caching

```
Key:  graphrag:{MD5(query + JSON(filter)).slice(0,12)}
TTL:  120 giây
Hit:  ~5ms (skip toàn bộ pipeline)
Miss: ~800-1500ms (chạy pipeline → cache)
Invalidate: khi node update → xóa tất cả graphrag:* keys
```

---

## 8. Query Router

```typescript
// find_job / find_candidate → Graph RAG
if (intent === 'find_job' || intent === 'find_candidate') {
  const filter: MetadataFilter = {
    nodeType: intent === 'find_job' ? 'job' : 'worker_service',
    isAvailable: true,
  };
  return graphRagService.retrieve(query, embedding, filter);
}

// platform_qa / general → Legacy vector search (knowledge_embeddings FAQ)
return retrieveContextLegacy(embedding, analysis);
```

---

## 9. BullMQ Sync Pipeline

```
Job created/updated  ──→ SYNC_JOB (knowledge_embeddings)
                     ──→ SYNC_GRAPH_JOB (graph_knowledge)

Job closed           ──→ REMOVE_JOB
                     ──→ REMOVE_GRAPH_NODE

WorkerService saved  ──→ SYNC_WORKER_SERVICE
                     ──→ SYNC_GRAPH_WORKER

Cron (mỗi giờ)      ──→ BATCH_SYNC_ALL
                         (check content_hash → skip unchanged → re-embed only changes)
```

---

## 10. Cấu Trúc File

```
src/modules/ai/
├── entities/
│   ├── graph-knowledge.entity.ts    ← MỚI: Denormalized graph entity
│   ├── knowledge-embedding.entity.ts
│   ├── chat-session.entity.ts
│   └── scam-pattern.entity.ts
│
├── graph-rag.service.ts             ← MỚI: Core Graph RAG
│   ├── retrieve()                   Hybrid retrieval entry point
│   ├── syncJobNode()                Build job graph node
│   ├── syncWorkerServiceNode()      Build worker graph node
│   ├── deactivateNode()             Soft-delete node
│   ├── vectorSearchWithFilter()     Metadata pre-filter + vector
│   ├── buildMetadataWhere()         Dynamic WHERE builder
│   ├── rerank()                     Composite score reranker
│   └── Redis cache helpers
│
├── ai-chatbot.service.ts            ← CẬP NHẬT: tích hợp query router
│   ├── routeRetrieval()             MỚI: route tới graph hoặc legacy
│   └── retrieveContextLegacy()      Giữ nguyên cho FAQ/platform_qa
│
├── ai-embedding.processor.ts        ← CẬP NHẬT: 3 graph sync handlers
├── ai-sync-cron.service.ts          ← CẬP NHẬT: enqueue helpers
├── ai-db-init.service.ts            ← CẬP NHẬT: table + 8 indexes
└── ai-embedding.constants.ts        ← CẬP NHẬT: 3 enum values mới
```

---

## 11. So Sánh Trước / Sau

| | Vector RAG (Trước) | Graph RAG (Sau) |
|---|---|---|
| **Data source** | `knowledge_embeddings` flat | `graph_knowledge` denormalized |
| **Filter** | Chỉ category text | 6 dimensions: type, province, category, price, rating, availability |
| **Retrieval** | Top-K cosine | Metadata filter → vector → rerank |
| **Rating/Kinh nghiệm** | ❌ Không | ✅ Precomputed trong reranker |
| **Skills** | Text only | ✅ JSONB + GIN index |
| **Cache** | ❌ Không | ✅ Redis 2 min |
| **Query routing** | ❌ Không | ✅ Graph vs Legacy |
| **Latency** | ~1.5-2s | ~0.8-1.5s · cache hit: ~50ms |
| **Indexes** | 3 | 11 (3 legacy + 8 graph) |
