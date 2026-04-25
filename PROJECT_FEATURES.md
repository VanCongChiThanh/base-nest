# 📋 GigWork — Tài Liệu Nghiệp Vụ Dự Án

> **Mục đích:** Theo dõi toàn bộ chức năng, luồng nghiệp vụ, thay đổi của nền tảng GigWork.
> **Cập nhật lần cuối:** 2026-04-23

---

## 🎯 Tổng Quan Dự Án

**GigWork** là nền tảng **kết nối việc làm** giữa Employer (nhà tuyển dụng) và Worker (người tìm việc).
- **Loại nền tảng:** Kết nối — KHÔNG quản lý GPS, chấm công chi tiết
- **Ngôn ngữ giao diện:** Tiếng Việt (hardcoded, không i18n)
- **Đối tượng:** Worker tìm việc thời vụ, part-time, online

---

## 📊 Danh Sách Chức Năng

### 1. Authentication & User Management

| Chức năng | Trạng thái | Mô tả |
|---|---|---|
| Đăng ký/Đăng nhập | ✅ Hoàn thành | Email + password, JWT (access + refresh) |
| Google OAuth | ✅ Hoàn thành | Đăng nhập bằng Google |
| Quên/Reset mật khẩu | ✅ Hoàn thành | Email verification flow |
| Phân quyền Role | ✅ Hoàn thành | ADMIN, USER, ORGANIZATION |
| eKYC (VNPT) | ✅ Hoàn thành | Xác minh danh tính qua VNPT SDK |

### 2. Profile

| Chức năng | Trạng thái | Mô tả |
|---|---|---|
| Worker Profile | ✅ Hoàn thành | Skills, rating, privacy settings |
| Employer Profile | ✅ Hoàn thành | Company info, badge, verified business |
| Public Profile | ✅ Hoàn thành | Xem hồ sơ công khai |
| Privacy Settings | ✅ Hoàn thành | PUBLIC/ACCEPTED_ONLY/PRIVATE cho phone, address, dob |
| Avatar Upload | ✅ Hoàn thành | Qua AWS S3 presigned URL |

### 3. Quản Lý Việc Làm (Job)

| Chức năng | Trạng thái | Mô tả |
|---|---|---|
| Đăng việc | ✅ Hoàn thành | Employer tạo job với title, description, salary, location, skills |
| Danh sách việc | ✅ Hoàn thành | Tìm kiếm, lọc theo province, ward, category, salary, search text |
| Chi tiết việc | ✅ Hoàn thành | Xem full thông tin job + employer profile |
| Lọc theo khoảng cách | ✅ Hoàn thành | Tính khoảng cách Haversine từ tọa độ user |
| Ưu tiên employer uy tín | ✅ Hoàn thành | Sort theo badge (TOP > TRUSTED > VERIFIED > NONE) |
| Hủy việc | ✅ Hoàn thành | Employer hủy, thông báo cho worker đã được chấp nhận |
| Quota giới hạn đăng việc | ✅ Hoàn thành | Theo gói subscription (monthly limit) |

### 4. Ứng Tuyển & Tuyển Dụng (Application)

| Chức năng | Trạng thái | Mô tả |
|---|---|---|
| Ứng tuyển | ✅ Hoàn thành | Worker gửi cover letter |
| Hủy ứng tuyển | ✅ Hoàn thành | Worker hủy khi PENDING |
| Chấp nhận/Từ chối | ✅ Hoàn thành | Employer duyệt ứng viên |
| Auto-close job | ✅ Hoàn thành | Đủ số worker → job tự close |
| Notification | ✅ Hoàn thành | Thông báo mỗi bước (apply, accept, reject, cancel) |
| Chat trong application | ✅ Hoàn thành | Application chat qua WebSocket |
| Quota giới hạn ứng tuyển | ✅ Hoàn thành | Theo gói subscription (daily limit) |

### 5. Tiến Trình Công Việc (Progress) — LOẠI THỜI VỤ (GIG)

| Chức năng | Trạng thái | Mô tả |
|---|---|---|
| Assignment tự động | ✅ Hoàn thành | Khi employer accept → tạo JobAssignment |
| Check-in | ✅ Hoàn thành | Worker xác nhận bắt đầu làm (bấm nút, không GPS) |
| Hoàn thành | ✅ Hoàn thành | Worker bấm hoàn thành → COMPLETED |
| Progress steps | ✅ Hoàn thành | 6 bước: Đã ứng tuyển → Đang xem xét → Đã chấp nhận → Check-in → Đang làm → Hoàn thành |
| Employer xem tiến trình | ✅ Hoàn thành | Xem progress tất cả worker của 1 job |

**Luồng hiện tại (Thời vụ/GIG):**
```
Đăng việc → Ứng tuyển → Chấp nhận → Check-in → Đang làm → Hoàn thành → Xác nhận thanh toán → Đánh giá
```

### 6. Thanh Toán & Tranh Chấp (Payment)

| Chức năng | Trạng thái | Mô tả |
|---|---|---|
| Xác nhận nhận tiền | ✅ Hoàn thành | Worker confirm đã nhận tiền (sau COMPLETED) |
| Lịch sử thanh toán | ✅ Hoàn thành | Worker xem danh sách payments |
| Tạo tranh chấp | ✅ Hoàn thành | Employer/Worker tạo dispute |
| Giải quyết tranh chấp | ✅ Hoàn thành | Admin resolve/dismiss dispute |

> **Lưu ý:** Nền tảng chỉ **xác nhận** thanh toán (confirm receipt). Tiền được trả trực tiếp giữa employer ↔ worker, nền tảng không xử lý dòng tiền.

### 7. Đánh Giá (Review)

| Chức năng | Trạng thái | Mô tả | 
|---|---|---|
| Đánh giá 2 chiều | ✅ Hoàn thành | Employer đánh giá Worker và ngược lại |
| Rating trung bình | ✅ Hoàn thành | Tính auto trên profile |

### 8. Dịch Vụ Worker (Worker Service)

| Chức năng | Trạng thái | Mô tả |
|---|---|---|
| Đăng dịch vụ | ✅ Hoàn thành | Worker tự giới thiệu kỹ năng/dịch vụ mình cung cấp |
| Lọc dịch vụ | ✅ Hoàn thành | Search, category, location, type (ONLINE/OFFLINE/BOTH), price range |
| Portfolio | ✅ Hoàn thành | Upload URL portfolio |
| AI Search (Hire Me) | ✅ Hoàn thành | Employer tìm ứng viên bằng ngôn ngữ tự nhiên (AI + Vector) |

### 9. AI & Chatbot

| Chức năng | Trạng thái | Mô tả |
|---|---|---|
| Scam Detection | ✅ Hoàn thành | Phát hiện tin lừa đảo: rule-based + vector similarity + Gemini AI |
| RAG Chatbot | ✅ Hoàn thành | Chatbot hỗ trợ Q&A + tìm kiếm việc/ứng viên từ knowledge base |
| Knowledge Sync (Queue) | ✅ Hoàn thành | **BullMQ (Redis)** — embedding chạy async, auto khi tạo/cập nhật job |
| AI Candidate Search | ✅ Hoàn thành | Tìm worker phù hợp qua natural language |
| Content Change Detection | ✅ Hoàn thành | Batch sync phát hiện content thay đổi → tự động re-embed |

### 10. Admin

| Chức năng | Trạng thái | Mô tả |
|---|---|---|
| Dashboard | ✅ Hoàn thành | Tổng quan hệ thống |
| Quản lý categories | ✅ Hoàn thành | CRUD danh mục việc làm |
| Quản lý reports | ✅ Hoàn thành | Xem/xử lý báo cáo vi phạm |
| Quản lý disputes | ✅ Hoàn thành | Giải quyết tranh chấp thanh toán |
| AI Sync | ✅ Hoàn thành | Trigger batch sync qua BullMQ queue |

### 11. Subscription & Gói Dịch Vụ

| Chức năng | Trạng thái | Mô tả |
|---|---|---|
| Pricing plans (User eKYC) | ✅ Hoàn thành | `FREE` (0đ): 2 bài tuyển/tháng; `PRO` (59k): 10 bài tuyển/tháng |
| Pricing plans (Tổ chức) | ✅ Hoàn thành | `BUSINESS_LITE` (0đ): 10 bài/tháng; `BUSINESS` (299k): không giới hạn bài |
| Trial cho ORGANIZATION | ✅ Hoàn thành | Tài khoản role `ORGANIZATION` checkout gói `BUSINESS` được miễn phí trong 3 tháng đầu (kể từ `createdAt`) |
| Quota system | ✅ Hoàn thành | Quota đăng việc theo gói; User thường bắt buộc eKYC trước khi đăng |
| Feature gate | ✅ Hoàn thành | `ai.job_chatbot.enabled` cho User PRO, `ai.candidate_match.enabled` cho Employee Unlimited |

### 12. Notification

| Chức năng | Trạng thái | Mô tả |
|---|---|---|
| Real-time notifications | ✅ Hoàn thành | Nhận thông báo mỗi bước nghiệp vụ |
| Đánh dấu đã đọc | ✅ Hoàn thành | Đọc 1 hoặc tất cả |
| Phân loại & điều hướng | ✅ Hoàn thành | Click notification → đúng trang target |

### 13. Khác

| Chức năng | Trạng thái | Mô tả |
|---|---|---|
| Firebase Realtime DB | ✅ Hoàn thành | Dùng cho chat real-time |
| Saved Jobs | ✅ Hoàn thành | Worker lưu việc yêu thích |
| Skill management | ✅ Hoàn thành | CRUD kỹ năng (admin) + worker gắn skills |

---

## 🔄 Lịch Sử Thay Đổi

| Ngày | Thay đổi | Chi tiết |
|---|---|---|
| 2026-04-18 | Tạo tài liệu | Tổng hợp toàn bộ chức năng hiện có từ codebase |
| | **[ĐỀ XUẤT]** Phân loại 3 kiểu việc làm | GIG / PART_TIME / ONLINE — xem mục "Chức năng đang đề xuất" |
| 2026-04-19 | **Queue-based AI Sync** | Chuyển embedding sang BullMQ (Redis), tự động embed khi tạo job, phát hiện content thay đổi |
| | **Thông báo Admin** | Gửi system notification tới tất cả tài khoản Role.ADMIN khi hoàn thành batch sync AI |
| | **Sửa lỗi embedding NULL** | Dùng raw SQL insert/update với `::vector` cast để bypass TypeORM/pgvector mismatch |
| 2026-04-23 | **Cập nhật nghiệp vụ phân quyền & gói cước** | User eKYC: FREE 2 bài/tháng, PRO 59k 10 bài/tháng + AI chatbot; ORGANIZATION: Basic 10 bài/tháng, Unlimited 299k không giới hạn + AI match ứng viên; trial 3 tháng đầu khi nâng gói Unlimited |

---

## 🚧 Chức Năng Đang Đề Xuất

### Phân loại 3 kiểu việc làm: GIG / PART_TIME / ONLINE

**Lý do:** Nghiệp vụ 3 loại không giống nhau. Hiện tại luồng chỉ phù hợp thời vụ.

**Nguyên tắc chung của nền tảng:**
- ⚠️ GigWork là nền tảng **KẾT NỐI** — không quản lý GPS, chấm công
- ⚠️ Part-time: employer đã có hệ thống chấm công & trả lương riêng
- ⚠️ Online: không có khái niệm check-in vật lý

| Loại | Mô tả | Khác biệt chính |
|---|---|---|
| **GIG (Thời vụ)** | 1 ca, ngắn hạn, tại chỗ | Luồng hiện tại ✅ |
| **PART_TIME** | Nhiều ca, dài hạn, employer quản lý riêng | Kết nối + theo dõi trạng thái hợp đồng |
| **ONLINE** | Remote, theo task/deliverable | Kết nối + milestone tracking |

> Chi tiết xem file đề xuất riêng (implementation_plan.md trong thư mục .gemini)

---

## 📐 Kiến Trúc Hệ Thống

### Backend (NestJS)
```
src/modules/
├── auth/           # JWT, Google OAuth, Guards
├── user/           # User CRUD
├── profile/        # Worker & Employer profiles
├── job/            # Jobs, Applications, Assignments, Progress, Chat
├── job-category/   # Danh mục việc làm
├── payment/        # Payment confirmation, Disputes
├── review/         # Đánh giá 2 chiều
├── worker-service/ # Worker tự đăng dịch vụ
├── skill/          # Quản lý kỹ năng
├── ai/             # Gemini AI, RAG Chatbot, Scam Detection
├── notification/   # Notification system
├── subscription/   # Plans, Quotas, Feature gates
├── ekyc/           # VNPT eKYC verification
├── verification/   # Verification levels
├── upload/         # AWS S3 presigned URL
├── mail/           # Email service
├── redis/          # Redis for refresh tokens
├── admin/          # Admin APIs
├── report/         # User reports
└── location/       # Province/Ward data
```

### Frontend (Next.js)
```
src/
├── app/
│   ├── (auth)/          # Login, Register, Forgot Password
│   ├── (protected)/     # Dashboard, Profile, Admin, Payments, Notifications
│   ├── jobs/            # Job listing & detail
│   ├── applications/    # Application progress
│   ├── services/        # Worker services marketplace
│   ├── pricing/         # Subscription plans
│   └── users/           # Public profiles
├── components/          # Reusable UI components
├── contexts/            # Auth, Notification contexts
├── hooks/               # Custom hooks
├── services/            # API service layer
├── types/               # TypeScript interfaces
└── lib/                 # API client, utilities
```

### Enums Quan Trọng
```
Role:              ADMIN | USER | ORGANIZATION
JobStatus:         OPEN | CLOSED | CANCELLED
ApplicationStatus: PENDING | ACCEPTED | REJECTED | CANCELLED
AssignmentStatus:  ASSIGNED | IN_PROGRESS | COMPLETED | CANCELLED
PaymentStatus:     PENDING | PAYMENT_CONFIRMED | DISPUTED
PaymentType:       FINAL_PAYMENT
JobSalaryType:     HOURLY | FIXED
ServiceType:       ONLINE | OFFLINE | BOTH
```
