# Hệ Thống Quản Lý Bệnh Viện KLTN (Hospital Management System)

Hệ thống quản lý bệnh viện full-stack xây dựng trên NestJS, React, PostgreSQL, hỗ trợ chẩn đoán hình ảnh và tư vấn Y tế bằng AI, xác thực sinh trắc học khuôn mặt và chuỗi bằng chứng kiểm toán (Audit Trail) bảo mật trên Blockchain.

> [!IMPORTANT]
> Blockchain trong dự án này chỉ dùng để neo hash / Merkle root phục vụ kiểm chứng tính toàn vẹn dữ liệu. Tuyệt đối không đưa thông tin định danh bệnh nhân (PII), nội dung bệnh án, file PDF, X-Ray, ảnh y tế, S3 object key hay file tĩnh lên Blockchain.

---

## Cấu Trúc Monorepo

```text
KLTN/
├── apps/
│   ├── hospital-api/       Backend NestJS + Prisma ORM + PostgreSQL
│   ├── hospital-web/       Frontend React + Vite + Tailwind CSS
│   ├── hospital-mobile/    Ứng dụng bệnh nhân Expo React Native
│   └── audit-contracts/    Smart Contracts Solidity + Hardhat
├── infrastructure/
│   ├── compose/            Cấu hình Docker Compose (Dev, Prod, Test)
│   ├── nginx/              Cấu hình Reverse Proxy Nginx
│   └── scripts/            Script triển khai, sao lưu, khôi phục và kiểm thử
├── docs/                   Tài liệu trung tâm của dự án
├── .env.example            Mẫu biến môi trường Docker Compose
└── README.md               Tệp tài liệu chính dự án
```

---

## Mô Hình Biến Môi Trường (Environment Model)

Tệp `.env` tại thư mục gốc không còn là tập hợp biến dùng chung cho tất cả các dịch vụ Docker Compose. Mỗi ứng dụng quản lý cấu hình riêng:

- `apps/hospital-api/.env`: Backend runtime, Database, JWT secret, thuật toán mã hóa, Audit Crypto, S3, Cloudinary avatar, RPC/Contract/Relayer Blockchain runtime.
- `apps/hospital-web/.env`: Cấu hình công khai `VITE_*` dành cho frontend.
- `apps/audit-contracts/.env`: Cấu hình triển khai và quản trị (deploy & governance) cho các script Hardhat.

Khởi tạo cấu hình ban đầu:

```bash
cp apps/hospital-api/.env.example apps/hospital-api/.env
cp apps/hospital-web/.env.example apps/hospital-web/.env
cd apps/audit-contracts
cp .env.example .env
```

> [!WARNING]
> Không bao giờ commit các tệp `.env` chứa bí mật thực tế lên Git repository.

---

## Luồng Hoạt Động Blockchain (Blockchain Flow)

Hệ thống phân định 3 vai trò rõ ràng trên Blockchain:

| Vai trò | Vị trí lưu trữ | Chức năng & Nhiệm vụ |
|---|---|---|
| **Owner / Root Governance** | `BLOCKCHAIN_OWNER_PRIVATE_KEY` trong `apps/audit-contracts/.env` (Production nên dùng ví lạnh / Multisig) | Cấp quyền hoặc thu hồi ví Admin, thêm/xóa ví Relayer, chuyển quyền sở hữu hợp đồng. |
| **Relayer / Backend Writer** | `BLOCKCHAIN_RELAYER_PRIVATE_KEY` trong `apps/hospital-api/.env` hoặc Secret Manager | Tự động ký và gửi giao dịch: `AuditAnchor.commitRoot`, `FaceRegistry.setFaceHash`, `recordAction`. |
| **Admin Wallet** | Ví cá nhân của Quản trị viên (MetaMask) | Ký các thử thách xác thực (Challenge) để chứng minh danh tính khi khôi phục hoặc thay đổi nhạy cảm. |

Backend không sử dụng ví Admin để trả phí gas cho các giao dịch audit thường nhật. Admin chỉ ký thử thách xác thực; ví Relayer của backend mới là bên gửi giao dịch vận hành lên chuỗi.

Hợp đồng `IdentityRegistry` đóng vai trò là nguồn xác thực quyền lực trung tâm:

```text
IdentityRegistry.owner()
├── Quản trị danh sách ví Admin
├── Quản trị danh sách ví Relayer backend
└── Chuyển quyền sở hữu (transferOwnership)

IdentityRegistry.isRelayerOrOwner(address)
├── Cho phép FaceRegistry ghi hash khuôn mặt
├── Cho phép AuditAnchor commit Merkle root
└── Cho phép ghi nhận hành động recordAction
```

`FaceRegistry` và `AuditAnchor` không duy trì danh sách Relayer riêng mà truy vấn trực tiếp từ `IdentityRegistry`. Do đó, khi cần xoay vòng (rotate) Relayer chỉ cần cập nhật tại một nơi duy nhất.

---

## Quy Trình Xử Lý Khi Mất Khóa Khóa Bí Mật (Key Recovery)

| Sự cố | Hậu quả | Phương án xử lý |
|---|---|---|
| **Mất `BLOCKCHAIN_RELAYER_PRIVATE_KEY`** | Không thể ghi Merkle root hoặc hash mới; nhật ký có thể bị dồn ở trạng thái `UNANCHORED` | Owner gọi `removeRelayer(old)` và `addRelayer(new)`, sau đó thay khóa relayer mới ở backend. |
| **Lộ `BLOCKCHAIN_RELAYER_PRIVATE_KEY`** | Kẻ xấu có thể gửi giao dịch vận hành trong phạm vi quyền Relayer | Owner lập tức thu hồi Relayer cũ, cấp quyền Relayer mới và kiểm toán lại các lô dữ liệu nghi ngờ. |
| **Mất ví Admin** | Admin đó không thể đăng nhập, thực hiện xác thực nâng cao (step-up) hoặc khôi phục dữ liệu | Owner thu hồi ví cũ và cấp quyền cho ví Admin mới. |
| **Mất khóa Owner duy nhất** | Toàn bộ quản trị bị khóa; không thể thêm/xóa Relayer hay Admin mới | Nếu hợp đồng không có cơ chế khôi phục đa chữ ký, dữ liệu không thể cứu. **Môi trường Production bắt buộc dùng Multisig / Ví lạnh.** |

---

## Chạy Blockchain Trên Môi Trường Local

**Terminal 1 (Khởi tạo Hardhat Node):**

```bash
cd apps/audit-contracts
npm install
npm run node
```

**Terminal 2 (Deploy Smart Contracts):**

```bash
cd apps/audit-contracts
npm run deploy:local
```

Sau khi deploy thành công, sao chép chính xác địa chỉ hợp đồng và thông số được in ra terminal vào tệp `.env` tương ứng của từng ứng dụng (`apps/audit-contracts/.env`, `apps/hospital-api/.env`, `apps/hospital-web/.env`).

Các lệnh hữu ích:

```bash
cd apps/audit-contracts
npm run compile           # Biên dịch hợp đồng
npm test                  # Chạy kiểm thử tự động
npm run deploy:custom     # Deploy lên mạng tùy chỉnh
npm run deploy:audit:local # Deploy nhanh bộ hợp đồng audit
```

---

## Chạy Bằng Docker Compose

Dịch vụ Docker Compose không còn tự động khởi chạy container blockchain riêng. Trước khi thực hiện `docker compose up`, hãy khởi chạy node Hardhat tại `apps/audit-contracts/` theo hướng dẫn trên.

```bash
docker compose -f infrastructure/compose/compose.yml up -d
```

Các đường dẫn dịch vụ mặc định:

- **Backend API:** `http://localhost:3001/api`
- **Frontend Web:** `http://localhost:5173`
- **PostgreSQL:** `localhost:5432`
- **Hardhat Node:** `http://localhost:8545`

---

## Lưu Trữ Tệp Y Tế & Quyền Truy Cập (File Storage)

Tệp kết quả cận lâm sàng được lưu trữ tại private bucket của AWS S3:
- Báo cáo PDF, ảnh X-Ray / MRI / CT / Siêu âm, điện tâm đồ (ECG), tệp đính kèm xét nghiệm.
- Ảnh phân tích AI: Backend tải ảnh riêng tư từ S3, chuyển đổi mã hóa base64 và gửi an toàn sang nhà cung cấp AI.

Ảnh đại diện (avatar) của bác sĩ và nhân viên không lưu ở S3 private mà sử dụng URL tĩnh / public trên Cloudinary để Frontend hiển thị trực tiếp.

Database PostgreSQL quản lý metadata và quyền truy cập (`storageProvider`, `bucket`, `objectKey`, `sha256`, `etag`). S3 chỉ giữ dữ liệu thô. Blockchain chỉ lưu vết Audit hash / Merkle root đã làm sạch định danh.

Đường dẫn tải tệp y tế:
```text
GET /api/medical-orders/results/files/:fileId/download
```
Backend kiểm tra phân quyền RBAC thành công mới tạo Pre-signed URL có thời hạn ngắn để ứng dụng tải tệp.

---

## Cổng Thông Tin Bệnh Nhân Trên Mobile

Ứng dụng `apps/hospital-mobile/` chứa cổng thông tin bệnh nhân xây dựng bằng Expo React Native. Bệnh nhân có thể đăng nhập bằng số điện thoại OTP hoặc mật khẩu lần đầu, chọn hồ sơ liên kết và tra cứu lịch sử khám chữa bệnh minh bạch.

Xem chi tiết tại: [docs/applications/hospital-mobile/README.md](docs/applications/hospital-mobile/README.md).

---

## Tài Liệu Tham Khảo Liên Quan

- [AGENTS.md](./docs/agents/AGENTS.md) - Hướng dẫn quy tắc cho AI coding agents
- [Hướng dẫn Hợp đồng Smart Contracts](docs/applications/audit-contracts/README.md)
- [Quy trình Kiểm toán Audit Logging](docs/security/audit-logging.md)
- [Chính sách Phân tầng Dữ liệu & Anchoring](docs/security/tiers-and-anchoring.md)

---

## Quy Ước Phát Triển (Development Standards)

- Backend phát triển theo kiến trúc mô-đun chức năng (feature-based modules), kiểm tra DTO bằng `class-validator`, logic nghiệp vụ nằm ở Service / Use Case.
- Các quy trình đa bước (Multi-step workflow) bắt buộc phải bọc trong Database Transaction.
- Tất cả thay đổi đối với Entity quan trọng phải ghi log Audit và tạo Hash / Merkle root neo lên Blockchain.
- Blockchain không chứa PII, nội dung bệnh án hay tệp dữ liệu lớn.
- Tệp `.env` không được commit lên repo; luôn cập nhật tệp mẫu `.env.example` khi thêm biến mới.
