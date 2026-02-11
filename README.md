# NestJS Base Backend

Một NestJS backend source base theo best practice, phù hợp làm starter project cho các dự án thực tế.

## 🚀 Tính năng

- ✅ **Authentication** - Register, Login với JWT (Access + Refresh Token)
- ✅ **Google OAuth 2.0** - Đăng nhập bằng Google
- ✅ **Role-based Authorization** - ADMIN, USER roles với Guards
- ✅ **Notifications** - Hệ thống thông báo với hỗ trợ điều hướng
- ✅ **AWS S3 Upload** - Presigned URL để upload file trực tiếp
- ✅ **Mail Service** - Gửi email xác thực và reset password
- ✅ **Redis** - Lưu trữ refresh tokens
- ✅ **TypeORM + PostgreSQL** - Database với migrations

## 📋 Yêu cầu

- Node.js >= 18.x
- PostgreSQL >= 14.x
- Redis >= 6.x
- Docker (optional)

## 🛠️ Cài đặt

### 1. Clone và cài đặt dependencies

```bash
npm install
```

### 2. Cấu hình environment

```bash
cp .env.example .env
# Chỉnh sửa .env với các giá trị phù hợp
```

### 3. Khởi động database (với Docker)

```bash
docker-compose up -d
```

### 4. Chạy ứng dụng

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## 📚 API Endpoints

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Đăng ký tài khoản | ❌ |
| POST | `/api/auth/login` | Đăng nhập | ❌ |
| POST | `/api/auth/refresh` | Refresh tokens | ❌ |
| POST | `/api/auth/logout` | Đăng xuất | ✅ |
| GET | `/api/auth/verify-email` | Xác thực email | ❌ |
| POST | `/api/auth/forgot-password` | Yêu cầu reset password | ❌ |
| POST | `/api/auth/reset-password` | Reset password | ❌ |
| GET | `/api/auth/google` | Đăng nhập bằng Google | ❌ |

### User

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/users/me` | Lấy thông tin user hiện tại | ✅ |
| PATCH | `/api/users/me` | Cập nhật thông tin user | ✅ |

### Notifications

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/notifications` | Lấy danh sách thông báo | ✅ |
| PATCH | `/api/notifications/:id/read` | Đánh dấu đã đọc | ✅ |
| PATCH | `/api/notifications/read-all` | Đánh dấu tất cả đã đọc | ✅ |
| DELETE | `/api/notifications/:id` | Xóa thông báo | ✅ |

### Upload

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/uploads/presigned-url` | Lấy presigned URL để upload | ✅ |

## 🔐 Authentication Flow

### Register & Login

```
┌─────────┐      POST /auth/register      ┌─────────┐
│ Client  │ ──────────────────────────────▶│ Server  │
└─────────┘                                └─────────┘
                                                │
                                                ▼
                                        Tạo user + Hash password
                                                │
                                                ▼
                                        Gửi email verification
                                                │
                                                ▼
┌─────────┐      Response: "Check email"  ┌─────────┐
│ Client  │ ◀──────────────────────────────│ Server  │
└─────────┘                                └─────────┘

┌─────────┐      POST /auth/login         ┌─────────┐
│ Client  │ ──────────────────────────────▶│ Server  │
│         │      { email, password }       │         │
└─────────┘                                └─────────┘
                                                │
                                                ▼
                                        Validate credentials
                                                │
                                                ▼
                                        Generate tokens
                                                │
                                                ▼
                                        Lưu refresh token vào Redis
                                                │
                                                ▼
┌─────────┐      { accessToken,           ┌─────────┐
│ Client  │ ◀──────refreshToken }──────────│ Server  │
└─────────┘                                └─────────┘
```

### Google OAuth Flow

```
┌─────────┐      GET /auth/google         ┌─────────┐      Redirect      ┌─────────┐
│ Client  │ ──────────────────────────────▶│ Server  │ ──────────────────▶│ Google  │
└─────────┘                                └─────────┘                    └─────────┘
                                                                               │
                                                                    User đồng ý
                                                                               │
                                                                               ▼
┌─────────┐      Redirect với tokens      ┌─────────┐      Callback      ┌─────────┐
│ Client  │ ◀──────────────────────────────│ Server  │ ◀──────────────────│ Google  │
└─────────┘                                └─────────┘                    └─────────┘
                                                │
                                                ▼
                                    Tìm/Tạo user từ Google profile
                                                │
                                                ▼
                                        Generate tokens
```

### Refresh Token Rotation

```
┌─────────┐      POST /auth/refresh       ┌─────────┐
│ Client  │ ──────────────────────────────▶│ Server  │
│         │      { refreshToken }          │         │
└─────────┘                                └─────────┘
                                                │
                                                ▼
                                    Validate refresh token trong Redis
                                                │
                                                ▼
                                    Xóa refresh token cũ (rotation)
                                                │
                                                ▼
                                    Tạo tokens mới
                                                │
                                                ▼
                                    Lưu refresh token mới vào Redis
                                                │
                                                ▼
┌─────────┐      { accessToken,           ┌─────────┐
│ Client  │ ◀──────refreshToken (mới) }────│ Server  │
└─────────┘                                └─────────┘
```

## 📤 S3 Upload Flow

```
┌─────────┐      POST /uploads/presigned-url     ┌─────────┐
│ Client  │ ─────────────────────────────────────▶│ Server  │
│         │      { fileName, fileType, fileSize } │         │
└─────────┘                                       └─────────┘
                                                       │
                                                       ▼
                                            Validate file info
                                                       │
                                                       ▼
                                            Generate presigned URL từ S3
                                                       │
                                                       ▼
┌─────────┐      { uploadUrl, fileUrl, key }     ┌─────────┐
│ Client  │ ◀─────────────────────────────────────│ Server  │
└─────────┘                                       └─────────┘
     │
     │ PUT uploadUrl
     │ (Upload trực tiếp lên S3)
     ▼
┌─────────┐
│   S3    │
└─────────┘
```

## 🔔 Notification System

Notifications hỗ trợ điều hướng với các fields:

| Field | Description |
|-------|-------------|
| `type` | Loại notification (SYSTEM, ORDER, PAYMENT, USER, PROMOTION) |
| `referenceId` | ID đối tượng liên quan |
| `link` | URL để frontend điều hướng |

Ví dụ response:

```json
{
  "id": "uuid",
  "title": "Đơn hàng đã được xác nhận",
  "content": "Đơn hàng #123 của bạn đã được xác nhận",
  "type": "ORDER",
  "referenceId": "order-123",
  "link": "/orders/order-123",
  "isRead": false,
  "createdAt": "2024-01-15T10:00:00.000Z"
}
```

## 📁 Cấu trúc thư mục

```
src/
├── common/
│   ├── decorators/       # @Roles, @Public, @CurrentUser
│   ├── enums/            # Role, NotificationType
│   ├── filters/          # HttpExceptionFilter
│   └── guards/           # JwtAuthGuard, RolesGuard
├── config/               # Database, Redis, JWT, AWS, Mail configs
├── modules/
│   ├── auth/             # Authentication + Google OAuth
│   ├── user/             # User management
│   ├── notification/     # Notification system
│   ├── upload/           # S3 presigned URL
│   └── mail/             # Email service
├── app.module.ts
└── main.ts
```

## 🔧 Environment Variables

Xem file `.env.example` để biết các biến môi trường cần cấu hình.

## 📝 Best Practices

- ✅ DTOs với class-validator
- ✅ Global Exception Filter
- ✅ Global Validation Pipe
- ✅ Không hardcode - sử dụng ConfigModule
- ✅ Password hashing với bcrypt
- ✅ JWT refresh token rotation
- ✅ Role-based authorization

## 📄 License

MIT
