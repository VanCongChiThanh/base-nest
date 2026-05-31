# Hướng dẫn Phân biệt & Tổng hợp Sơ đồ UML (Sequence & Activity)

## 1. Khi nào dùng Sơ đồ tuần tự (Sequence) và Sơ đồ hoạt động (Activity)?

Để báo cáo đồ án tốt nghiệp chuẩn tính hàn lâm và chuyên ngành Kỹ thuật phần mềm, việc phân định rõ khi nào vẽ sơ đồ nào là bắt buộc:

- **Sơ đồ tuần tự (Sequence Diagram):** 
  - **Mục đích:** Thể hiện **trình tự giao tiếp (gọi hàm, API, truy xuất DB) theo dòng thời gian** giữa các đối tượng hoặc các thành phần hệ thống với nhau. 
  - **Khi nào dùng:** Đối với các chức năng nặng về **kỹ thuật (Technical)**, có sự trao đổi dữ liệu qua lại nhiều vòng giữa Client - Backend - Database - 3rd Party API.
  - **Các chức năng áp dụng trong đồ án:**
    - Đăng nhập (giao tiếp với DB, tạo JWT, lưu Redis).
    - Xác thực eKYC (giao tiếp Frontend - Backend - VNPT Provider).
    - Chatbot tìm kiếm AI (giao tiếp Backend - LLM Service - Graph Database).

- **Sơ đồ hoạt động (Activity Diagram):**
  - **Mục đích:** Thể hiện **luồng điều khiển nghiệp vụ (Workflow)** từ đầu đến cuối, đặc biệt tập trung vào các rẽ nhánh logic (If/Else) và sự phân công công việc (ai làm việc gì - Swimlanes).
  - **Khi nào dùng:** Đối với các **nghiệp vụ kinh doanh (Business Logic)** có nhiều bước nối tiếp nhau, nhiều điều kiện xét duyệt, và có nhiều người dùng (Role) tham gia vào hệ thống.
  - **Các chức năng áp dụng trong đồ án:**
    - Đăng bài tuyển dụng (Logic kiểm tra gói cước người dùng, đồng bộ dữ liệu ngầm).
    - Quy trình Ứng tuyển & Thanh toán Escrow (Các bước từ apply, duyệt hồ sơ, thanh toán ví tạm giữ, bàn giao việc, giải ngân).

---

## 2. Các Sơ đồ Tuần tự (Sequence Diagrams)

### 2.1. Sơ đồ tuần tự: Đăng nhập & Xác thực Token
*Mô tả cách thức Client gọi API, Backend kiểm tra DB và cấp phát/quản lý Session qua Redis.*

```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng
    participant Client as Frontend
    participant Auth as Auth Service
    participant Redis as Redis Cache
    participant DB as PostgreSQL

    User->>Client: Nhập Email & Mật khẩu
    Client->>Auth: POST /auth/login
    Auth->>DB: Truy vấn dữ liệu User
    DB-->>Auth: Trả về Hash Password
    Auth->>Auth: Bcrypt so khớp mật khẩu
    
    alt Mật khẩu sai
        Auth-->>Client: 401 Unauthorized
    else Mật khẩu đúng
        Auth->>Auth: Ký Access & Refresh Token (JWT)
        Auth->>Redis: Lưu thông tin Session (TTL)
        Auth-->>Client: 200 OK + JWT Tokens
        Client->>Client: Lưu LocalStorage/Cookies
    end
```

### 2.2. Sơ đồ tuần tự: Xác thực định danh điện tử (eKYC)
*Mô tả cách ứng dụng trao đổi payload mã hoá và chữ ký số với đối tác VNPT eKYC.*

```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng
    participant Client as Frontend (SDK)
    participant API as Backend (NestJS)
    participant VNPT as VNPT eKYC
    participant DB as Database

    User->>Client: Mở giao diện eKYC
    Client->>API: GET /ekyc/config
    API->>VNPT: Yêu cầu OAuth Access Token
    VNPT-->>API: Trả về Access Token
    API-->>Client: Trả về Token & Config cho SDK
    
    User->>Client: Chụp ảnh CCCD và Khuôn mặt
    Client->>VNPT: SDK gửi ảnh phân tích Liveness, OCR
    VNPT-->>Client: Trả Base64 Payload & Chữ ký số (RSA)
    
    Client->>API: POST /ekyc/complete (Payload + Signature)
    API->>API: Verify Public Key & Kiểm tra logic ảnh (Mờ/Chói)
    
    alt Dữ liệu lỗi/Giả mạo
        API-->>Client: 400 Bad Request
    else Hợp lệ
        API->>DB: Cập nhật VerificationLevel & Lưu EkycResult
        API-->>Client: 200 OK (Thành công)
    end
```

### 2.3. Sơ đồ tuần tự: Tương tác Chatbot AI & GraphRAG
*Thấy rõ cách Backend gọi LLM phân tích ý định, sau đó mới gọi Graph DB để lấy thông tin.*

```mermaid
sequenceDiagram
    autonumber
    actor Employer as Nhà tuyển dụng
    participant API as Backend API
    participant DB as Database
    participant LLM as LLM (OpenAI)
    participant GraphDB as Graph Knowledge DB
    
    Employer->>API: Chat: "Tìm ứng viên Frontend React"
    API->>DB: Truy vấn Cấp độ Gói cước (Subscription)
    DB-->>API: Trả về loại tài khoản (Thường / VIP)
    
    alt Tài khoản Thường (Basic)
        API-->>Employer: 403 Forbidden (Khóa tính năng AI Matching)
    else Tài khoản VIP (Pro/Enterprise)
        API->>LLM: Gửi Prompt yêu cầu trích xuất Intent (Kỹ năng, Yêu cầu)
        LLM-->>API: Trả về JSON (Ngữ cảnh truy vấn)
        API->>GraphDB: Query (Cypher/Vector) lấy ứng viên
        GraphDB-->>API: Trả danh sách Node Ứng viên phù hợp
        API->>LLM: Gửi Data ứng viên, yêu cầu format câu trả lời
        LLM-->>API: Trả về đoạn văn bản gợi ý hoàn chỉnh
        API-->>Employer: Hiển thị đoạn chat và danh sách CV
    end
```

---

## 3. Các Sơ đồ Hoạt động (Activity Diagrams - Sử dụng Swimlanes)

### 3.1. Sơ đồ hoạt động: Luồng Đăng công việc (Có nghiệp vụ xét duyệt Gói cước)
*Phân rõ hành động bấm tạo Job của người dùng và các bước kiểm duyệt tự động trong Hệ thống.*

```plantuml
@startuml
|Nhà tuyển dụng|
start
:Điền thông tin Yêu cầu Tuyển dụng;
:Bấm Xác nhận Đăng bài;

|Hệ thống|
:Kiểm tra hạn mức đăng bài;
if (Còn hạn mức?) then (Hết)
  :Báo lỗi hết hạn mức;
  :Gợi ý Nâng cấp gói cước;
  stop
else (Còn)
  :Kiểm tra Cấp độ Tài khoản;
  if (Loại tài khoản?) then (User Thường)
    :Lưu DB: Job Thường
    - Đề xuất thấp
    - Khoá tính năng AI;
  else (User VIP/Pro)
    :Lưu DB: Job VIP
    - Đề xuất ưu tiên cao
    - Mở khoá AI Matching;
  endif
  :Thay đổi trạng thái thành PUBLISHED;
  :Kích hoạt Job đồng bộ AI Graph;
  stop
endif
@enduml
```

### 3.2. Sơ đồ hoạt động: Luồng Ứng tuyển & Thanh toán tạm giữ (Escrow Workflow)
*Đây là quy trình nghiệp vụ phức tạp nhất, đi qua 3 giai đoạn: Ứng tuyển -> Giữ tiền Escrow -> Làm việc & Giải ngân.*

```plantuml
@startuml
|Nhà tuyển dụng & Ứng viên|
start
:Ứng viên: Nộp CV ứng tuyển công việc;

|Hệ thống Quản lý|
:Gửi Notification cho Nhà tuyển dụng;

|Nhà tuyển dụng & Ứng viên|
:NTD: Xét duyệt hồ sơ;
:NTD: Chấp nhận Ứng viên;
repeat
  :NTD: Thanh toán vào ví Escrow;
  |Hệ thống Quản lý|
repeat while (Thanh toán thành công?) is (Thất bại)
-> Thành công;
:Tạm giữ tiền Escrow (IN_PROGRESS);
:Báo Ứng viên: Bắt đầu làm việc;

|Nhà tuyển dụng & Ứng viên|
:Ứng viên: Tiến hành làm việc và Nộp sản phẩm;
:NTD: Nghiệm thu và Duyệt sản phẩm;

|Hệ thống Quản lý|
:Giải ngân tự động cho Ứng viên (COMPLETED);
stop
@enduml
```

### 3.3. Sơ đồ hoạt động: Quy trình Thanh toán Mua Gói Dịch Vụ (Subscription Checkout)
*Mô tả cách thức người dùng nâng cấp gói cước và quá trình hệ thống nhận Webhook (IPN) từ cổng thanh toán để tự động cấp quyền.*

```plantuml
@startuml
|Người dùng|
start
:Chọn Gói dịch vụ (Pro/VIP);
:Bấm Thanh toán;

|Hệ thống|
:Khởi tạo Giao dịch (Transaction);
:Gọi API Cổng thanh toán (VNPAY/MoMo);
:Trả về URL Thanh toán;

|Người dùng|
:Chuyển hướng đến Cổng thanh toán;
:Thực hiện quét mã QR / Nhập thẻ;

|Cổng Thanh Toán|
if (Giao dịch?) then (Thành công)
  :Gửi Webhook (IPN) báo thành công;
  
  |Hệ thống|
  :Xác thực chữ ký Webhook;
  :Cập nhật trạng thái Giao dịch (SUCCESS);
  :Cộng hạn mức đăng bài & Mở khóa AI;
  :Gửi Email xác nhận;
else (Thất bại / Hủy)
  |Cổng Thanh Toán|
  :Gửi Webhook thất bại (hoặc user hủy);
  
  |Hệ thống|
  :Cập nhật trạng thái (FAILED);
endif

|Người dùng|
:Nhận kết quả giao dịch trên màn hình;
stop
@enduml
```

### 3.4. Sơ đồ hoạt động: Quy trình Rút Tiền từ Ví (Withdrawal Request)
*Dành cho nền tảng Freelance: Ứng viên sau khi hoàn thành công việc sẽ có số dư trong ví, yêu cầu rút tiền và chờ Admin duyệt đối soát.*

```plantuml
@startuml
|Người dùng (Ứng viên)|
start
:Truy cập Ví cá nhân;
:Nhập số tiền cần rút & Số tài khoản;
:Gửi Yêu cầu Rút tiền;

|Hệ thống|
:Kiểm tra Số dư khả dụng;
if (Số dư đủ?) then (Không đủ)
  :Báo lỗi Số dư không hợp lệ;
  stop
else (Đủ)
  :Trừ trực tiếp Số dư khả dụng;
  :Tạo Lịch sử Rút tiền (Trạng thái: PENDING);
  
  |Admin|
  :Nhận thông báo có Yêu cầu Rút tiền mới;
  :Kiểm tra chống gian lận & Đối soát;
  if (Quyết định duyệt?) then (Từ chối)
    |Hệ thống|
    :Hoàn lại tiền vào Ví cho Ứng viên;
    :Cập nhật trạng thái (REJECTED);
    :Gửi Email thông báo lý do từ chối;
  else (Chấp nhận)
    |Admin|
    :Chuyển khoản thực tế qua Ngân hàng;
    
    |Hệ thống|
    :Cập nhật trạng thái Yêu cầu (COMPLETED);
    :Gửi Email thông báo rút tiền thành công;
  endif
endif

|Người dùng (Ứng viên)|
:Nhận thông báo và kiểm tra tài khoản Ngân hàng;
stop
@enduml
```
