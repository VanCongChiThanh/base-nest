# 🚀 Hướng Dẫn Deploy Backend Lên DigitalOcean VPS (Docker Compose)

## Tổng Quan

Hướng dẫn từng bước deploy hệ thống backend NestJS (GigWork/Coursevo) lên máy chủ ảo (VPS) của DigitalOcean với kiến trúc tối ưu:
- ✅ **HTTPS tự động** (Quản lý chứng chỉ SSL tự động 100% bằng Caddy)
- ✅ **CI/CD Tự động hóa** qua GitHub Actions
- ✅ **Docker Multi-stage Build** (Tối ưu dung lượng và bảo mật)
- ✅ **All-in-one Compose** (Gom chung API, PostgreSQL có pgvector, và Redis trên cùng 1 server)
- ✅ **Zero Downtime Build** (Tự động giữ app cũ chạy trong lúc build app mới)

---

## 📋 Prerequisites (Yêu cầu chuẩn bị)

1. **VPS DigitalOcean (Ubuntu)** — Đã có sẵn IP (VD: `168.144.138.178`).
2. **Domain** — Đã sở hữu tên miền (VD: `api-coursevo-dev.id.vn`).
3. **GitHub Repository** — Nơi lưu trữ source code backend.
4. **SSH Key** — Khóa bảo mật Private Key (`id_ed25519`) để GitHub chui vào server.

---

## 1️⃣ Setup Môi trường Server (VPS)

### 1.1 Trỏ Tên Miền (DNS)
Vào trang quản lý tên miền của bạn, tạo một bản ghi (Record) để trỏ tên miền về IP của VPS:
* **Type:** `A`
* **Name:** `api-coursevo-dev` (hoặc `@` nếu dùng domain gốc)
* **Value:** `168.144.138.178` (IP của server)

### 1.2 Cài đặt Docker & Swap RAM (Chạy 1 lần duy nhất)
SSH vào server và chạy cụm lệnh sau để cài đồ nghề và tạo 2GB RAM ảo (tránh sập lúc build):

```bash
# Cập nhật và cài đặt Docker chuẩn
apt-get update
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL [https://download.docker.com/linux/ubuntu/gpg](https://download.docker.com/linux/ubuntu/gpg) | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] [https://download.docker.com/linux/ubuntu](https://download.docker.com/linux/ubuntu) \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Tạo 2GB Swap (RAM ảo)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab

# Tạo thư mục chứa code
mkdir -p /app/gigwork
```

---

## 2️⃣ Cấu hình GitHub Secrets cho CI/CD

Để GitHub Actions có quyền truy cập VPS và cài đặt biến môi trường một cách bảo mật, vào **GitHub Repo → Settings → Secrets and variables → Actions** và tạo 3 biến sau:

| Secret Name | Giá trị ví dụ | Ý nghĩa |
|-------------|---------|---------|
| `DO_HOST` | `168.144.138.178` | IP của Server DigitalOcean |
| `DO_SSH_KEY` | `-----BEGIN OPENSSH PRIVATE KEY-----...` | Nội dung file Private Key chuẩn xác từ máy tính. |
| `ENV_FILE` | `PORT=3000\nDB_HOST=postgres...` | Toàn bộ nội dung file `.env` thật dành cho Production. |

---

## 3️⃣ Cấu Trúc File Triển Khai Quan Trọng

Hệ thống hoạt động dựa trên sự phối hợp của 3 file chính. Hãy đảm bảo code hiện tại khớp với cấu hình này:

### 3.1: `.dockerignore`
Ngăn Docker copy các file rác và thư mục cũ vào Image:
```text
node_modules
npm-debug.log
dist
.git
.github
.env
.env.*
*.md
test
coverage
```

### 3.2: `Dockerfile` (Multi-stage)
Build NestJS và chỉ giữ lại thư mục `dist` cùng các package cần thiết:
```dockerfile
# ──── Stage 1: Build ────
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ──── Stage 2: Production ────
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./

ENV PORT=3000
EXPOSE 3000

RUN addgroup -g 1001 -S nestjs && adduser -S nestjs -u 1001
USER nestjs

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api || exit 1

CMD ["node", "dist/main.js"]
```

### 3.3: `docker-compose.yml`
Quản lý toàn bộ cơ sở hạ tầng (API, Caddy HTTPS, DB, Cache):
```yaml
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: nestjs_api
    restart: unless-stopped
    expose:
      - '8080' # Chú ý: Phải khớp với PORT trong Dockerfile
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  caddy:
    image: caddy:2-alpine
    container_name: caddy_proxy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - caddy_data:/data       
      - caddy_config:/config
    depends_on:
      - api
    command: caddy reverse-proxy --from [https://api-coursevo-dev.id.vn](https://api-coursevo-dev.id.vn) --to http://api:8080 

  postgres:
    image: pgvector/pgvector:pg16
    container_name: nestjs_postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: nestjs_base
    ports:
      - '5433:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: nestjs_redis
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
  caddy_data:
  caddy_config:
```

---

## 🔄 CI/CD Flow (Luồng tự động hóa)

Quy trình tự động hóa mỗi khi bạn `git push`:

```text
1. Developer push code lên nhánh `main` trên GitHub.
         ↓
2. GitHub Actions kích hoạt file `.github/workflows/deploy.yml`.
         ↓
3. Dùng SSH Key, GitHub copy toàn bộ code mới sang thư mục `/app/gigwork` trên VPS.
         ↓
4. GitHub xuất nội dung của biến secret `ENV_FILE` thành file `.env` thật trên VPS.
         ↓
5. GitHub chạy lệnh `docker compose up -d --build` trên VPS.
         ↓
6. VPS tiến hành tải dependencies, build thư mục dist, và tráo đổi container API mới (Không làm sập Caddy/DB).
         ↓
Live at [https://api-coursevo-dev.id.vn](https://api-coursevo-dev.id.vn) ✅
```

---

## 🐛 Troubleshooting (Bắt bệnh thường gặp)

### 1. Lỗi "Cannot find module '/app/dist/main.js'" trong log server
* **Nguyên nhân:** Lệnh build trong `Dockerfile` bị fail nên không sinh ra thư mục dist, hoặc bạn set sai đường dẫn chạy lệnh.
* **Khắc phục:** - Kiểm tra `package.json` và `package-lock.json` dưới máy đã đồng bộ chưa (`npm install`).
  - Kiểm tra file `.dockerignore` xem có vô tình block file source code không.
  - Sửa lại lệnh CMD ở cuối Dockerfile nếu project yêu cầu chạy `/app/dist/src/main.js`.

### 2. GitHub Actions báo lỗi: "ssh: handshake failed"
* **Nguyên nhân:** Khóa `DO_SSH_KEY` trên GitHub bị sai định dạng.
* **Khắc phục:** Copy lại chính xác Private Key trên máy tính từ dòng `-----BEGIN OPENSSH PRIVATE KEY-----` đến hết dòng `-----END OPENSSH PRIVATE KEY-----`.

### 3. Web báo lỗi "502 Bad Gateway"
* **Nguyên nhân:** Caddy Proxy gọi vào API nhưng API đang đóng cửa hoặc chạy nhầm cổng.
* **Khắc phục:** Mở file `docker-compose.yml`, đảm bảo số ở phần `expose: - '8080'` của API phải khớp hoàn toàn với số `--to http://api:8080` của dịch vụ Caddy.

### 4. Giao diện báo lỗi "Failed to fetch" (CORS)
* **Khắc phục:** Thêm hàm bật CORS trong file `main.ts` của NestJS:
  ```typescript
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  ```

### 💡 Lệnh kiểm tra log trên Server
Nếu code báo xanh trên GitHub nhưng app vẫn lỗi, SSH vào VPS và gõ lệnh sau để xem lỗi chi tiết của NestJS:
```bash
cd /app/gigwork
docker compose logs -n 50 api
```