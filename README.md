**🌐 Language:** [🇻🇳 Tiếng Việt](./README.md) · [🇬🇧 English](./README.en.md) · [🇷🇺 Русский](./README.ru.md)

# KLTN Hospital Management System

> A modern, full-stack healthcare platform pursuing the **Triple Aim**: better patient experience, sharper clinical outcomes, and unassailable data integrity.

## Tổng quan

Hệ thống quản lý bệnh viện kết hợp **xác thực sinh trắc học**, **AI hỗ trợ chẩn đoán**, và **blockchain audit trail** để đảm bảo mỗi bản ghi y tế đều có thể chứng minh tính nguyên vẹn — cả khi server bị xâm nhập.

### Tính năng cốt lõi

| Workflow | Mô tả |
|---|---|
| **Lễ tân** | Tiếp nhận bệnh nhân, hàng đợi khám, xác minh CCCD |
| **Bác sĩ** | Hồ sơ bệnh án + AI gợi ý chẩn đoán + kết luận neo on-chain |
| **Phòng xét nghiệm** | Xử lý medical orders, upload kết quả lên Cloudinary |
| **Admin** | Quản lý phòng ban, nhân sự, mô hình AI, audit logs, backup |

### Cơ chế bảo mật khác biệt

- **Biometric Authentication:** xác thực mặt cho cả nhân sự và bệnh nhân
- **Step-up Sessions ("sudo mode"):** quét mặt 1 lần mở phiên đặc quyền, tránh "quét gãy cổ" mỗi thao tác
- **Auto-Lock màn hình:** kiểu iPhone, người dùng tự chỉnh 1–15 phút
- **Blockchain anchoring:** chỉ neo hash + Merkle root, **không bao giờ neo dữ liệu y tế**
- **Out-of-band recovery:** ký Web3 ngoại băng khi DB bị xâm nhập

---

## Kiến trúc

Monorepo với 3 thành phần độc lập:

```text
KLTN/
├── backend/      NestJS + Prisma + PostgreSQL
├── frontend/     React + Vite + Tailwind
├── blockchain/   Solidity + Hardhat
├── docs/         Tài liệu kỹ thuật theo chủ đề
└── tools/        Công cụ HTML khẩn cấp (offline)
```

| Layer | Stack | Vai trò |
|---|---|---|
| **[Backend](./backend/README.md)** | NestJS, TypeScript, Prisma, PostgreSQL | Logic nghiệp vụ, AI integration (Python child process), biometric processing |
| **[Frontend](./frontend/README.md)** | React (Vite), Tailwind, React Router v6 | SPA cho 4 role: Admin, Receptionist, Doctor, Lab Manager |
| **[Blockchain](./blockchain/README.md)** | Solidity, Hardhat, Ethers.js v6 | Audit trails + integrity verification (chỉ hash + Merkle, không có PII) |
| **AI/ML** | Python 3.12, TensorFlow, InsightFace | Diagnostic suggestions, face embedding 128D |

---

## Bắt đầu nhanh

### Yêu cầu

- Docker + Docker Compose
- Node.js 20+
- (Tùy chọn) MetaMask để test wallet flow

### Chạy đầy đủ qua Docker

```bash
docker compose up -d
# Backend:  http://localhost:3001/api
# Frontend: http://localhost:5173
# Postgres: localhost:5432
# Hardhat:  http://localhost:8545
```

### Hoặc chạy từng phần

```bash
# Backend
cd backend && npm install && npm run start:dev

# Frontend
cd frontend && npm install && npm run dev

# Blockchain (local node + deploy)
cd blockchain && npm install
npx hardhat node                          # terminal 1
npx hardhat run scripts/deploy.js --network localhost  # terminal 2
```

---

## Tài liệu

Mục lục đầy đủ tại [`docs/README.md`](./docs/README.md).

### Theo chủ đề

| Chủ đề | Tài liệu |
|---|---|
| **Kiến trúc** | [Backend Clean Architecture](./docs/architecture/backend.md) · [File Structure](./docs/architecture/backend-file-structure.md) · [Frontend UI](./docs/architecture/frontend-ui-guidelines.md) |
| **Bảo mật** | [Tiers & Anchoring Policy](./docs/security/tiers-and-anchoring.md) · [Audit Logging](./docs/security/audit-logging.md) |
| **Backup & DR** | [Overview](./docs/backup-recovery/overview.md) · [Backup CLI](./docs/backup-recovery/backup-restore-cli.md) · [Emergency Restore](./docs/backup-recovery/emergency-restore.md) |
| **Standalone Tools** | [Break-Glass Viewer](./tools/break-glass-viewer/README.md) · [Recovery Signer](./tools/recovery-signer/README.md) |
| **Cho AI/Agents** | [AGENTS.md](./AGENTS.md) |

### Câu hỏi thường gặp

| Câu hỏi | Trả lời |
|---|---|
| Tier A vs Tier B step-up là gì? | [docs/security/tiers-and-anchoring.md](./docs/security/tiers-and-anchoring.md) |
| Khi nào neo blockchain ngay, khi nào gom 5 phút? | [docs/security/tiers-and-anchoring.md](./docs/security/tiers-and-anchoring.md) |
| Backup tự động chạy khi nào? Admin tự backup thế nào? | [docs/backup-recovery/overview.md](./docs/backup-recovery/overview.md) |
| 2 công cụ HTML khác nhau ra sao? | [tools/README.md](./tools/README.md) |
| DB bị xóa hoàn toàn, làm sao restore? | [docs/backup-recovery/emergency-restore.md](./docs/backup-recovery/emergency-restore.md) |

---

## Quy ước phát triển

- **Backend:** Feature-based modules (`modules/visit`, `modules/department`...). Validation bằng `class-validator`. Multi-step workflow dùng `prisma.$transaction`.
- **Frontend:** Feature-based folders (`features/admin`, `features/receptionist`). Tailwind cyan-600 palette. Soft delete cho business entities.
- **Blockchain:** Chỉ neo hash + Merkle root + metadata. **Không bao giờ** lưu PII, file y tế, X-Ray.
- **Commit:** Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`...).

Chi tiết hơn trong [AGENTS.md](./AGENTS.md).