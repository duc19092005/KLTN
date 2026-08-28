# Backend Core API - Hospital Management System (NestJS)

Hệ thống Backend trung tâm xây dựng trên nền tảng **NestJS 10**, **Prisma ORM** và **PostgreSQL**, tích hợp động cơ Kiểm toán Bất biến (Tamper-Evident Audit Engine) băm đa tầng V2, xác thực sinh trắc học khuôn mặt, ví Web3 và Cổng kết nối Trí tuệ nhân tạo Y tế Đa nền tảng (Multi-AI Gateway).

---

## 📚 Tài Liệu Chi Tiết

Để tra cứu chi tiết từng phần, vui lòng xem các tài liệu chuyên sâu dưới đây:

- 🎮 **[Tài Liệu Chi Tiết Toàn Bộ Controller & Endpoints (16 Controllers)](../../docs/applications/hospital-api/vi/controllers.md)**: Danh sách đầy đủ phương thức HTTP, route, phân quyền RBAC, yêu cầu Face Step-Up và mục đích nghiệp vụ.
- 🎯 **[Tài Liệu Chi Tiết Use Cases Nghiệp Vụ (59 Use Cases)](../../docs/applications/hospital-api/vi/use-cases.md)**: Quy tắc nghiệp vụ, giao dịch nguyên tử (Atomic Transactions) và sự kiện phát sinh.
- 🏗️ **[Tài Liệu Cấu Trúc Hạ Tầng (Infrastructure)](../../docs/applications/hospital-api/vi/infrastructure.md)**: Kiến trúc chi tiết Audit Engine, Blockchain Clients, Multi-AI Gateway và Cloud Storage S3.

---

## 🏛️ Cấu Trúc Mã Nguồn (Clean Architecture)

```text
apps/hospital-api/
├── prisma/
│   ├── schema.prisma              # Database Schema (30+ Tables)
│   └── migrations/                # Lịch sử Migration PostgreSQL
│
├── src/
│   ├── common/                    # Guards, Decorators, StepUp Service, Exceptions, Interceptors
│   │
│   ├── infrastructure/            # Tầng Hạ tầng Kỹ thuật
│   │   ├── audit/                 # Động cơ Kiểm toán (Anchoring, Recovery, Logging, Crypto, IPFS)
│   │   ├── blockchain/            # Web3 Signer, Governance, FaceRegistry, AuditAnchor Clients
│   │   ├── prisma/                # Prisma Service & Transaction Manager
│   │   └── storage/               # AWS S3 Private Adapter & Cloudinary Avatar Uploader
│   │
│   └── modules/                   # Các Phân hệ Nghiệp vụ (Feature Modules)
│       ├── ai-model/              # Quản lý & Giám sát các Model AI (Claude, GPT, Gemini)
│       ├── audit/                 # Controller, Queries & Presenter cho Bảng điều khiển Audit
│       ├── auth/                  # Đăng nhập Mật khẩu, Sinh trắc học Khuôn mặt, Ví Web3, Khôi phục
│       ├── clinical-decision/     # Tham vấn Chẩn đoán AI, Ký kết luận bệnh án ICD-10
│       ├── department/            # Quản lý Khoa phòng & Bổ nhiệm Trưởng khoa
│       ├── doctor/                # Quản lý Bác sĩ & Chứng chỉ hành nghề
│       ├── medical-order/         # Phiếu chỉ định cận lâm sàng & Kết quả xét nghiệm S3
│       ├── notification/          # Thông báo thời gian thực
│       ├── patient/               # Quản lý Hồ sơ Bệnh nhân
│       ├── patient-auth/          # Đăng nhập Cổng bệnh nhân bằng OTP SMS
│       ├── patient-portal/        # Cổng Bệnh nhân: Đặt lịch, Tra cứu kết quả, Check-in QR
│       ├── staff/                 # Quản lý Nhân sự bệnh viện
│       └── visit/                 # Quản lý Vòng đời Ca khám bệnh
│
└── test/                          # 56 Test Suites: Unit, Functional, Integration, Tamper-Recovery
```

---

## ⚙️ Thiết Lập & Khởi Chạy

### 1. Cài đặt Dependencies
```bash
cd apps/hospital-api
npm install
```

### 2. Cấu hình Biến Môi trường
Sao chép tệp mẫu và điền các khóa bí mật:
```bash
cp .env.example .env
```

### 3. Đồng bộ Cơ sở Dữ liệu Prisma
```bash
npx prisma generate
npx prisma db push
```

### 4. Khởi chạy Ứng dụng
```bash
# Chế độ phát triển (Development)
npm run start:dev

# Chế độ sản xuất (Production Build)
npm run build
npm run start:prod
```

---

## 🧪 Kiểm Thử Tự Động (Testing)

Hệ thống có bộ test suite toàn diện đạt tỷ lệ bao phủ cao và kiểm chứng 100% tính toàn vẹn:

```bash
# Chạy toàn bộ Unit Tests (56 Test Suites / 308 Tests)
npm run test:unit

# Chạy Kiểm thử Kịch bản Chức năng (Functional Tests)
npm run test:functional

# Chạy Kiểm thử Tích hợp Giả lập Tấn công & Tự phục hồi dữ liệu (Tamper-Recovery E2E)
npm run test:tamper:run
```