# Tài Liệu Cấu Trúc Hạ Tầng (Infrastructure) - Backend Hospital API

Tài liệu này mô tả chi tiết các phân hệ hạ tầng kỹ thuật (`src/infrastructure/`) trong hệ thống `apps/hospital-api`, bao gồm động cơ Kiểm toán Bất biến (Audit Engine), Smart Contract Blockchain Clients, Multi-AI Gateway, Hệ thống Lưu trữ Tệp Y tế và Dịch vụ SMS OTP.

---

## Mục lục Phân hệ Hạ tầng
1. [Động cơ Kiểm toán Bất biến (Audit Engine)](#1-động-cơ-kiểm-toán-bất-biến-audit-engine)
2. [Hạ tầng Blockchain & Smart Contract Clients](#2-hạ-tầng-blockchain--smart-contract-clients)
3. [Cổng Tích hợp AI Y tế Đa nền tảng (Multi-AI Gateway)](#3-cổng-tích-hợp-ai-y-tế-đa-nền-tảng-multi-ai-gateway)
4. [Hệ thống Lưu trữ Tệp & Đám mây (Storage Infrastructure)](#4-hệ-thống-lưu-trữ-tệp--đám-mây)
5. [Dịch vụ Tin nhắn SMS & OTP (SMS Gateway)](#5-dịch-vụ-tin-nhắn-sms--otp)

---

## 1. Động cơ Kiểm toán Bất biến (Audit Engine)
Nằm tại thư mục `src/infrastructure/audit/`, động cơ kiểm toán chịu trách nhiệm ghi nhận, băm chuỗi thời gian thực, đóng gói cây Merkle, neo on-chain và tự phục hồi dữ liệu khi bị tấn công.

```text
src/infrastructure/audit/
├── anchoring/           # Đóng gói lô, tạo cây Merkle, xuất IPFS & neo On-Chain
│   ├── audit-anchor.service.ts              # Facade chính điều phối quy trình neo
│   ├── audit-batch-preparer.ts              # Gom log PENDING & xây dựng Merkle Tree
│   ├── audit-batch-artifact-publisher.ts    # Xuất JSON bundle mã hóa & upload IPFS
│   ├── audit-chain-verifier.ts              # Kiểm tra tuần tự hash-chain off-chain
│   ├── audit-pending-batch-resumer.ts       # Xử lý phục hồi các batch treo dở
│   ├── audit-proof.service.ts               # Tạo Merkle Inclusion Proof độc lập
│   └── audit-telegram-alert.service.ts      # Bot cảnh báo sự cố bất thường qua Telegram
│
├── recovery/            # Giám sát, đối soát sai lệch & tự phục hồi dữ liệu
│   ├── audit-recovery.service.ts            # Facade điều phối phục hồi
│   ├── audit-watchdog.scheduler.ts          # Scheduler chạy nền mỗi 20 phút
│   ├── audit-deep-scan.service.ts           # Quét sâu đa tầng đối soát CSDL vs Blockchain
│   ├── audit-batch-scanner.ts               # Tìm các lô bị thiếu hoặc bị xóa khỏi DB
│   ├── audit-batch-restorer.ts              # Thực thi transaction restore batch từ IPFS
│   ├── entity-recovery.service.ts           # Phục hồi dữ liệu thực thể bị sửa lén
│   ├── entity-integrity-evaluator.ts        # So sánh snapshot live với audit đã neo
│   ├── entity-cluster-resolver.ts           # Gom nhóm phụ thuộc ca khám/bệnh nhân
│   ├── entity-recreation.service.ts         # Tái tạo thực thể bị xóa vĩnh viễn từ IPFS
│   ├── entity-recreation-blockers.ts        # Kiểm tra xung đột khóa ngoại/ràng buộc
│   ├── entity-recreation-source-resolver.ts # Trích xuất snapshot đầy đủ từ artifact
│   └── verified-audit-bundle.reader.ts      # Đọc và xác minh tính hợp lệ của IPFS bundle
│
├── logging/             # Ghi log thời gian thực & xây dựng băm V2
│   ├── audit-logger.service.ts              # Ghi log audit V2 với Advisory Lock
│   ├── audit-record-builder.util.ts         # Xây dựng các trường băm và mã hóa snapshot
│   └── audit-verification.util.ts           # Kiểm tra tính toàn vẹn từng dòng log
│
├── crypto/              # Thuật toán mật mã học
│   ├── audit-hash.util.ts                   # Băm canonical JSON SHA-256
│   ├── audit-diff.util.ts                   # Tính toán sai lệch diffJson V1
│   ├── audit-encryption.util.ts             # Mã hóa AES-256-GCM có AAD
│   └── merkle.util.ts                       # Xây dựng Cây Merkle và sinh proof
│
└── ipfs/                # Kết nối mạng lưu trữ phân tán IPFS
    └── ipfs-artifact.service.ts             # Upload/Download artifact bundle lên IPFS
```

### Chi tiết các công nghệ mật mã trong Audit:
- **Chuẩn băm V2:** `beforeHash`, `afterHash`, `diffHash`, `dataHash`, `entryHash` đảm bảo tính toàn vẹn 5 lớp.
- **Mã hóa Snapshot:** Toàn bộ dữ liệu trước và sau thao tác được mã hóa bằng **AES-256-GCM** với AAD (`seq`, `entity`, `entityId`, `action`) ngăn chặn tuyệt đối việc tráo đổi dữ liệu mã hóa giữa các dòng log.
- **Zero PII on-chain:** Blockchain chỉ chứa Merkle Root (32 bytes) và IPFS CID, tuyệt đối không lộ danh tính hay bệnh án người bệnh.

---

## 2. Hạ tầng Blockchain & Smart Contract Clients
Nằm tại `src/infrastructure/blockchain/`, cung cấp kết nối RPC an toàn, quản lý hàng đợi giao dịch (Write Mutex) và giao tiếp với 3 Smart Contract chính:

```text
src/infrastructure/blockchain/
├── blockchain.service.ts                    # Facade điều phối ví Signer & RPC Provider
├── blockchain-action-hash.util.ts           # Băm chuẩn hóa hành động backend
└── clients/
    ├── blockchain-governance.client.ts      # Giao tiếp IdentityRegistry.sol (Admin, Relayer)
    ├── blockchain-face-registry.client.ts   # Giao tiếp FaceRegistry.sol (Vector khuôn mặt)
    └── blockchain-audit-anchor.client.ts    # Giao tiếp AuditAnchor.sol (Commit Checkpoint)
```

### Cơ chế bảo mật Web3:
- **Hàng đợi Giao dịch (Write Mutex Queue):** Chống va chạm Nonce (Nonce Collision) khi backend gửi nhiều giao dịch đồng thời lên mạng Blockchain.
- **Phân tách ví (Key Separation):** Ví Admin (chỉ dùng ký thử thách) tách biệt hoàn toàn với Ví Relayer (ví nóng của backend dùng để trả gas và neo Checkpoint).

---

## 3. Cổng Tích hợp AI Y tế Đa nền tảng (Multi-AI Gateway)
Nằm tại `src/modules/clinical-decision/infrastructure/ai/`, đảm bảo khả năng mở rộng kết nối với nhiều nhà cung cấp mô hình ngôn ngữ lớn (LLM):

```text
src/modules/clinical-decision/infrastructure/ai/
├── provider-clinical-ai.gateway.ts          # Gateway điều phối chọn mô hình
├── clinical-ai-provider-client.ts           # Interface chuẩn hóa cho các AI Client
├── anthropic-clinical-ai.client.ts          # Client gọi Claude 3.5 Sonnet / Haiku
├── gemini-clinical-ai.client.ts             # Client gọi Google Gemini 1.5 Pro / Flash
├── openai-compatible-clinical-ai.client.ts  # Client gọi OpenAI GPT-4o / vLLM / DeepSeek
├── clinical-ai-credential.resolver.ts       # Quản lý & giải mã API keys an toàn
├── clinical-ai-response.parser.ts           # Chuẩn hóa JSON phản hồi từ AI
└── clinical-ai-http.client.ts               # HTTP client có timeout và retry
```

---

## 4. Hệ thống Lưu trữ Tệp & Đám mây (Storage Infrastructure)
Nằm tại `src/infrastructure/storage/` và `src/modules/medical-order/infrastructure/adapters/`:
- **AWS S3 Private Storage Adapter:**
  - Lưu trữ ảnh X-Quang, MRI, CT, PDF kết quả xét nghiệm trong S3 Private Bucket.
  - Sử dụng Pre-signed URL có thời hạn ngắn (15 phút) sau khi đã kiểm tra quyền RBAC.
  - Lưu trữ mã băm SHA-256 của từng tệp trong CSDL để đảm bảo không bị sửa đổi trên cloud.
- **Cloudinary Avatar Uploader:**
  - Lưu trữ ảnh đại diện của nhân viên và bác sĩ phục vụ hiển thị nhanh trên Frontend.

---

## 5. Dịch vụ Tin nhắn SMS & OTP (SMS Gateway)
Nằm tại `src/modules/patient-auth/sms/`:
- Tích hợp cổng SMS Brandname (eSMS API) để gửi mã xác thực OTP 6 chữ số đến số điện thoại bệnh nhân.
- Cơ chế bảo vệ Rate Limiting và mã hóa hash OTP chống rò rỉ mã xác thực.