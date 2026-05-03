# 🚀 GigWork Backend — Advanced Gig Economy Platform with GraphRAG

[![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![BullMQ](https://img.shields.io/badge/BullMQ-FF4500?style=for-the-badge&logo=redis&logoColor=white)](https://bullmq.io/)

**GigWork Backend** is the high-performance core of a professional gig marketplace. It features a state-of-the-art AI engine, a secure financial escrow system, and identity verification modules.

---

## 🌟 Advanced Technical Features

### 🧠 Hybrid GraphRAG Engine
Unlike traditional RAG, GigWork implements a **Hybrid GraphRAG** architecture:
- **Denormalized Graph Knowledge:** Uses a `graph_knowledge` store that combines entities, rich relationships, and precomputed statistics.
- **Multidimensional Retrieval:** Combines metadata pre-filtering (location, price, rating) with **Vector Cosine Similarity** (pgvector).
- **Composite Reranker:** A weighted scoring system (50% Vector, 25% Rating, 15% Experience, 10% Availability) to provide the most relevant candidates.
- **Query Routing:** Intelligent intent analysis to route between GraphRAG (Jobs/Workers) and Legacy RAG (FAQ/General QA).
- **Redis Caching:** High-speed retrieval for frequent queries with a ~50ms response time on cache hits.

### 💰 Trusted Financial Infrastructure (Escrow & Wallet)
- **PayOS Payment Gateway:** Seamless integration for automated funding and milestone-based payments.
- **Platform-Internal Escrow:** Funds are securely held by the platform and released only upon task completion and dual confirmation.
- **Milestone-based Workflow:** Professional project management allowing fixed-price projects to be split into manageable payment phases.
- **Internal Wallet System:** Real-time balance tracking, deposit/withdrawal history, and automated financial state transitions.

### 🤖 AI-Powered Candidate Matching
- **1-Click Search:** High-precision candidate discovery for organizations, outputting structured JSON reasoning for "top match" suggestions.
- **Scam Detection AI:** Real-time analysis of job postings using semantic patterns and vector-based anomaly detection to protect users.

### 🔐 Enterprise-Grade Security & Identity
- **VNPT eKYC:** Integrated AI identity verification (Face Match, OCR) to ensure a community of verified, real users.
- **Identity Privacy:** Granular controls for personal data visibility (Public / Accepted Only / Private).
- **Token Rotation:** Secure authentication flow with JWT Access/Refresh tokens stored in Redis.

---

## 🛠️ Tech Stack

- **Framework:** NestJS (TypeScript)
- **Database:** PostgreSQL + TypeORM + **pgvector**
- **AI Stack:** Google Gemini Pro, Text Embeddings, GraphRAG logic
- **Background Tasks:** BullMQ + Redis
- **Cloud Storage:** AWS S3 (Presigned URLs)
- **Real-time:** Socket.io & Firebase Realtime DB

---

## 📁 Project Architecture

```bash
src/
├── modules/
│   ├── ai/              # GraphRAG Core, Matching logic, Scam Detection
│   ├── job/             # GIG / PART_TIME / ONLINE (Escrow) workflows
│   ├── payment/         # Escrow system, Wallet, PayOS integration
│   ├── ekyc/            # Identity verification (VNPT SDK)
│   ├── subscription/    # Feature Gating & Quota management
│   └── ...
```

---

## 🚀 Setup & Installation

1. **Environment:** Copy `.env.example` to `.env` and fill in your Gemini API Key, PayOS Credentials, and Database URL.
2. **Docker:** Run `docker-compose up -d` to start PostgreSQL and Redis.
3. **Run:** `npm run start:dev` for development or `npm run build && npm run start:prod` for production.

---
## 📝 License
Licensed under MIT.
