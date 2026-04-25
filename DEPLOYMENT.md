# 🚀 Hướng Dẫn Deploy GigWork Backend Lên Google Cloud Run

## Tổng Quan

Hướng dẫn từng bước deploy NestJS backend lên Google Cloud Run với:
- ✅ **HTTPS tự động** (Google quản lý SSL)
- ✅ **CI/CD** qua GitHub Actions
- ✅ **Auto-scaling** (0 → 3 instances)
- ✅ **Docker multi-stage** build
- ✅ **Workload Identity Federation** (không cần JSON key)

---

## 📋 Prerequisites

1. **Google Cloud Account** — [console.cloud.google.com](https://console.cloud.google.com)
2. **GCP Billing** — Cần enable billing (Cloud Run có free tier generous)
3. **gcloud CLI** — [Cài đặt](https://cloud.google.com/sdk/docs/install)
4. **GitHub Repository** — Push code lên GitHub

---

## 1️⃣ Setup Google Cloud Project

### 1.1 Tạo/Chọn Project

```bash
# Tạo project mới
gcloud projects create gigwork-backend --name="GigWork Backend"

# Hoặc chọn project có sẵn
gcloud config set project YOUR_PROJECT_ID
```

### 1.2 Enable APIs

```bash
# Enable tất cả APIs cần thiết
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com
```

### 1.3 Tạo Artifact Registry (Docker Registry)

```bash
gcloud artifacts repositories create gigwork-docker \
  --repository-format=docker \
  --location=asia-southeast1 \
  --description="GigWork Docker images"
```

---

## 2️⃣ Setup Database & Redis

### Option A: Cloud SQL (Recommended)

```bash
# Tạo PostgreSQL instance (với pgvector)
gcloud sql instances create gigwork-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=asia-southeast1 \
  --storage-size=10 \
  --storage-auto-increase

# Tạo database
gcloud sql databases create nestjs_base --instance=gigwork-db

# Set password
gcloud sql users set-password postgres \
  --instance=gigwork-db \
  --password=YOUR_SECURE_PASSWORD
```

> ⚠️ **pgvector**: Cloud SQL PostgreSQL 16+ hỗ trợ pgvector extension. Bạn cần enable nó:
> ```sql
> CREATE EXTENSION IF NOT EXISTS vector;
> ```

### Option B: Dùng External Database

Bạn có thể dùng database từ:
- **Supabase** (Free tier, có sẵn pgvector)
- **Neon** (Serverless PostgreSQL, free tier)
- **Railway** (PostgreSQL + Redis, đơn giản)

### Redis: Memorystore

```bash
# Tạo Redis instance
gcloud redis instances create gigwork-redis \
  --size=1 \
  --region=asia-southeast1 \
  --redis-version=redis_7_0
```

Hoặc dùng **Upstash Redis** (Free, serverless) — đơn giản hơn cho đồ án.

---

## 3️⃣ Setup Workload Identity Federation (WIF)

WIF cho phép GitHub Actions authenticate với GCP **không cần JSON key** (bảo mật hơn).

### 3.1 Tạo Service Account

```bash
# Tạo service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Deploy"

# Gán roles
PROJECT_ID=$(gcloud config get-value project)

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

### 3.2 Tạo Workload Identity Pool

```bash
# Tạo pool
gcloud iam workload-identity-pools create github-pool \
  --location="global" \
  --display-name="GitHub Actions Pool"

# Tạo provider
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Cho phép GitHub repo sử dụng
REPO="YOUR_GITHUB_USERNAME/base-nest"  # ← Thay bằng repo thật

gcloud iam service-accounts add-iam-policy-binding \
  github-actions@${PROJECT_ID}.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')/locations/global/workloadIdentityPools/github-pool/attribute.repository/${REPO}"
```

### 3.3 Lấy WIF Provider ID

```bash
# Lấy full resource name
gcloud iam workload-identity-pools providers describe github-provider \
  --workload-identity-pool="github-pool" \
  --location="global" \
  --format="value(name)"
```

Output dạng: `projects/123456789/locations/global/workloadIdentityPools/github-pool/providers/github-provider`

---

## 4️⃣ Setup GitHub Secrets

Vào repo GitHub → Settings → Secrets and variables → Actions → New repository secret:

| Secret Name | Giá trị |
|-------------|---------|
| `GCP_PROJECT_ID` | ID project GCP của bạn |
| `WIF_PROVIDER` | Full resource name từ bước 3.3 |
| `WIF_SERVICE_ACCOUNT` | `github-actions@PROJECT_ID.iam.gserviceaccount.com` |

---

## 5️⃣ Environment Variables

### Setup Secret Manager (cho sensitive data)

```bash
# Tạo secret cho DB password
echo -n "YOUR_DB_PASSWORD" | gcloud secrets create db-password --data-file=-

# Tạo secret cho JWT
echo -n "YOUR_JWT_SECRET" | gcloud secrets create jwt-access-secret --data-file=-
echo -n "YOUR_JWT_REFRESH_SECRET" | gcloud secrets create jwt-refresh-secret --data-file=-

# Gemini API Key
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-

# Gán quyền cho service account Cloud Run
gcloud secrets add-iam-policy-binding db-password \
  --member="serviceAccount:${PROJECT_ID}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Deploy với env vars

```bash
gcloud run deploy gigwork-backend \
  --image=asia-southeast1-docker.pkg.dev/${PROJECT_ID}/gigwork-docker/gigwork-backend:latest \
  --region=asia-southeast1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=512Mi \
  --set-env-vars="NODE_ENV=production,PORT=8080" \
  --set-env-vars="DB_HOST=/cloudsql/${PROJECT_ID}:asia-southeast1:gigwork-db" \
  --set-env-vars="DB_PORT=5432,DB_USERNAME=postgres,DB_DATABASE=nestjs_base" \
  --set-env-vars="FRONTEND_URL=https://your-frontend.vercel.app" \
  --set-secrets="DB_PASSWORD=db-password:latest" \
  --set-secrets="JWT_ACCESS_SECRET=jwt-access-secret:latest" \
  --set-secrets="GEMINI_API_KEY=gemini-api-key:latest" \
  --add-cloudsql-instances=${PROJECT_ID}:asia-southeast1:gigwork-db
```

---

## 6️⃣ Deploy Thủ Công (Manual)

Nếu muốn deploy nhanh mà không cần GitHub Actions:

```bash
# 1. Build Docker image
docker build -t asia-southeast1-docker.pkg.dev/${PROJECT_ID}/gigwork-docker/gigwork-backend:latest .

# 2. Push lên Artifact Registry
gcloud auth configure-docker asia-southeast1-docker.pkg.dev
docker push asia-southeast1-docker.pkg.dev/${PROJECT_ID}/gigwork-docker/gigwork-backend:latest

# 3. Deploy lên Cloud Run
gcloud run deploy gigwork-backend \
  --image=asia-southeast1-docker.pkg.dev/${PROJECT_ID}/gigwork-docker/gigwork-backend:latest \
  --region=asia-southeast1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080
```

---

## 7️⃣ Custom Domain + HTTPS

### 7.1 Map Custom Domain

```bash
# Map domain
gcloud beta run domain-mappings create \
  --service=gigwork-backend \
  --domain=api.gigwork.vn \
  --region=asia-southeast1
```

### 7.2 DNS Setup

Thêm DNS records theo hướng dẫn GCP:

| Type | Name | Value |
|------|------|-------|
| CNAME | api | ghs.googlehosted.com |

> ✅ **SSL/HTTPS** được Google tự động provision và quản lý. Không cần setup SSL certificate thủ công!

### 7.3 Verify

```bash
# Kiểm tra status
gcloud beta run domain-mappings describe \
  --domain=api.gigwork.vn \
  --region=asia-southeast1
```

---

## 8️⃣ Monitoring & Logging

### Cloud Logging

```bash
# Xem logs
gcloud run services logs read gigwork-backend --region=asia-southeast1 --limit=50
```

### Cloud Console

- **Logs**: Console → Cloud Run → gigwork-backend → Logs
- **Metrics**: Console → Cloud Run → gigwork-backend → Metrics
- **Error Reporting**: Console → Error Reporting

### Uptime Check

```bash
# Tạo uptime check
gcloud monitoring uptime-checks create http gigwork-health \
  --resource-type=uptime-url \
  --host=gigwork-backend-xxxxx.run.app \
  --path=/api \
  --check-interval=300
```

---

## 🆓 Cloud Run Free Tier

Cloud Run cung cấp **free tier** hàng tháng:
- **2 triệu requests**
- **360,000 GiB-giây** memory
- **180,000 vCPU-giây** compute
- **1 GiB** egress traffic

→ Đủ cho đồ án tốt nghiệp nếu set `min-instances=0`.

---

## 🔄 CI/CD Flow

```
Developer push code → GitHub
         ↓
GitHub Actions triggered
         ↓
┌─────────────────────────┐
│ 1. Checkout code        │
│ 2. Auth with GCP (WIF)  │
│ 3. Build Docker image   │
│ 4. Push to Registry     │
│ 5. Deploy to Cloud Run  │
│ 6. Health check         │
└─────────────────────────┘
         ↓
Live at https://api.gigwork.vn ✅
```

---

## 🐛 Troubleshooting

### Lỗi "The user-provided container failed to start"

- Kiểm tra `PORT` env được set đúng (Cloud Run dùng `PORT=8080`)
- Kiểm tra `main.ts` lắng nghe `process.env.PORT`
- Xem logs: `gcloud run services logs read gigwork-backend --region=asia-southeast1`

### Lỗi "Permission denied"

- Kiểm tra Service Account có đủ roles
- Kiểm tra WIF provider mapping đúng GitHub repo

### Lỗi Database connection

- Nếu dùng Cloud SQL: thêm `--add-cloudsql-instances`
- Kiểm tra DB_HOST format cho Cloud SQL: `/cloudsql/PROJECT:REGION:INSTANCE`

### pgvector không hoạt động

- Cloud SQL PostgreSQL 16+ hỗ trợ pgvector
- Chạy `CREATE EXTENSION IF NOT EXISTS vector;` trong database
