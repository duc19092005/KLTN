# KLTN Hospital Management System

Hệ thống quản lý bệnh viện full-stack với NestJS, React, PostgreSQL, AI hỗ trợ chẩn đoán, xác thực sinh trắc học và blockchain audit trail. Blockchain chỉ dùng để neo hash/Merkle root phục vụ kiểm chứng toàn vẹn; tuyệt đối không lưu PII, nội dung bệnh án, PDF, X-Ray hay file y tế on-chain.

## Cấu trúc monorepo

```text
KLTN/
├── backend/      NestJS + Prisma + PostgreSQL
├── frontend/     React + Vite + Tailwind CSS
├── mobile/       Expo React Native NFC apps for receptionist and patient flows
├── blockchain/   Solidity + Hardhat + Ethers.js
├── docs/         Tài liệu kiến trúc, audit, backup/recovery
├── tools/        Công cụ khẩn cấp chạy offline
└── .env.example  Mẫu cấu hình môi trường an toàn để copy ra .env
```

## NFC mobile

`mobile/` is the single source for NFC mobile setup, APK build, and card payload docs. It contains two app surfaces:

- Receptionist scanner: pairs with the web intake flow through NFC sessions and SSE.
- Patient portal: scans the NFC CCCD card, then reuses backend patient verification with DB and blockchain checks.

Current demo backend URL:

```env
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.13:3001/api
```

See [mobile/README.md](./mobile/README.md).

## Luồng blockchain hiện tại

Blockchain trong dự án có 3 vai trò tách biệt:

| Vai trò | Nằm ở đâu | Dùng để làm gì | Có nên nằm trong backend env không? |
|---|---|---|---|
| Owner / Root Governance | `BLOCKCHAIN_OWNER_PRIVATE_KEY` trong dev; production nên là cold wallet/multisig | `authorizeAdmin`, `revokeAdmin`, `addRelayer`, `removeRelayer`, `transferOwnership` | Dev được; production không nên |
| Relayer / Backend Writer | `BLOCKCHAIN_RELAYER_PRIVATE_KEY` | Ký giao dịch tự động: `AuditAnchor.commitRoot`, `FaceRegistry.setFaceHash`, `recordAction` | Có, nhưng phải rotate được |
| Admin Wallet | Ví MetaMask/hardware của admin | Login, step-up, emergency restore, ký challenge chứng minh danh tính | Không, ví nằm phía người dùng |

Điểm quan trọng: backend không dùng ví Admin để trả gas cho từng audit transaction. Admin ký challenge để chứng minh danh tính hoặc phê duyệt thao tác nhạy cảm; backend relayer mới là ví gửi giao dịch vận hành lên chain.

## Contract authority model

`IdentityRegistry` là nguồn quyền trung tâm:

```text
IdentityRegistry.owner()
├── quản trị Admin wallets
├── quản trị backend relayers
└── chuyển ownership

IdentityRegistry.isRelayerOrOwner(address)
├── cho phép FaceRegistry ghi face hash
├── cho phép AuditAnchor commit Merkle root
└── cho phép recordAction
```

`FaceRegistry` và `AuditAnchor` không tự giữ danh sách owner/relayer riêng. Hai contract này luôn hỏi `IdentityRegistry`, nhờ vậy khi rotate relayer chỉ cần cập nhật một nơi.

## Nếu mất key thì sao?

| Sự cố | Hậu quả | Cách xử lý |
|---|---|---|
| Mất `BLOCKCHAIN_RELAYER_PRIVATE_KEY` | Không ghi được audit root/face hash mới; log có thể dồn `UNANCHORED`/failed | Owner gọi `removeRelayer(old)` và `addRelayer(new)`, backend đổi relayer key |
| Relayer bị lộ | Kẻ xấu có thể gửi giao dịch operational trong quyền relayer | Owner revoke relayer cũ, add relayer mới, audit lại batch trong khoảng nghi ngờ |
| Mất Admin wallet | Admin đó không login/step-up/recovery được | Owner revoke ví cũ, authorize ví mới |
| Mất Owner key đơn lẻ | Governance bị kẹt; sau này không rotate relayer/admin được | Không có cách cứu nếu contract không có recovery. Production phải dùng multisig/cold wallet |

## Cấu hình môi trường

Copy file mẫu:

```bash
cp .env.example .env
```

Các biến blockchain chính:

```env
BLOCKCHAIN_RPC_URL=http://blockchain:8545

IDENTITY_REGISTRY_ADDRESS=0x...
FACE_REGISTRY_ADDRESS=0x...
AUDIT_ANCHOR_ADDRESS=0x...

BLOCKCHAIN_OWNER_ADDRESS=0x...
BLOCKCHAIN_OWNER_PRIVATE_KEY=0x...

BLOCKCHAIN_RELAYER_ADDRESS=0x...
BLOCKCHAIN_RELAYER_PRIVATE_KEY=0x...
```

Ghi chú:

- `BLOCKCHAIN_OWNER_PRIVATE_KEY` hiện được hỗ trợ trong env để dev/local chạy nhanh. Production nên chuyển owner sang multisig hoặc cold wallet.
- `BLOCKCHAIN_RELAYER_PRIVATE_KEY` là hot key của backend. Key này phải có thể revoke/rotate.
- `SUPER_ADMIN_PRIVATE_KEY` là biến cũ, chỉ còn fallback tương thích ngược. Cấu hình mới không nên dùng.
- Không commit `.env`; chỉ commit `.env.example`.

## Chạy nhanh bằng Docker

```bash
docker compose up -d
```

Mặc định:

```text
Backend:  http://localhost:3001/api
Frontend: http://localhost:5173
Postgres: localhost:5432
Hardhat:  http://localhost:8545
```

## Chạy blockchain local thủ công

```bash
cd blockchain
npm install
npx hardhat node
```

Terminal khác:

```bash
cd blockchain
npx hardhat run scripts/deploy.js --network localhost
```

`scripts/deploy.js` sẽ:

1. Deploy `IdentityRegistry`.
2. Cấp quyền relayer từ `BLOCKCHAIN_RELAYER_ADDRESS` hoặc private key tương ứng.
3. Deploy `FaceRegistry` và `AuditAnchor`.
4. Chuyển ownership sang `BLOCKCHAIN_OWNER_ADDRESS` nếu cấu hình khác deployer.
5. Tự `acceptOwnership()` nếu `BLOCKCHAIN_OWNER_PRIVATE_KEY` có sẵn trong env.

## Luồng nghiệp vụ ví Admin

```text
Admin login/step-up
→ Backend tạo challenge
→ Admin ký bằng MetaMask/hardware wallet
→ Backend recover address từ signature
→ Backend kiểm tra IdentityRegistry.isAuthorized(address)
→ Nếu hợp lệ thì cấp session/JWT hoặc cho phép thao tác nhạy cảm
```

Ví Admin không thay thế relayer. Nó là human identity/recovery key.

## Luồng audit khi thêm/sửa dữ liệu

Ví dụ Admin thêm phòng ban:

```text
Admin thao tác trên UI
→ Backend kiểm tra JWT/RBAC/step-up nếu cần
→ Backend ghi dữ liệu vào PostgreSQL
→ Backend ghi BlockchainLogger
→ AuditAnchorService gom batch và tính Merkle root
→ Backend relayer ký commitRoot()
→ AuditAnchor hỏi IdentityRegistry.isRelayerOrOwner(msg.sender)
→ Root được neo on-chain
```

On-chain chỉ có hash/root/timestamp/metadata kỹ thuật, không có dữ liệu y tế.

## Thành phần chính

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| Backend | NestJS, Prisma, PostgreSQL | API, nghiệp vụ, auth, audit, AWS S3 medical storage, Cloudinary avatars, AI child process |
| Frontend | React, Vite, Tailwind CSS | SPA cho Admin, Receptionist, Doctor, Lab Manager |
| Blockchain | Solidity, Hardhat, Ethers.js v6 | Integrity anchor, wallet authorization, audit root |
| AI/ML | Python, TensorFlow, InsightFace | Diagnostic suggestions, face embedding |

## Lưu trữ file y tế

Medical result upload mới dùng AWS S3 private bucket:

- Medical result files: PDF, X-Ray/MRI/CT/Ultrasound image, ECG, lab attachments.
- AI image attachments: backend tải ảnh private từ S3, convert base64 và gửi vào AI provider.

Staff/doctor avatar không đi qua S3 private. Avatar dùng Cloudinary public/static URL để frontend render trực tiếp bằng `<img src={avatarUrl}>`.

PostgreSQL giữ metadata/quyền truy cập (`storageProvider`, `bucket`, `objectKey`, `sha256`, `etag`). S3 chỉ giữ blob. Blockchain chỉ anchor audit hash/Merkle root đã sanitize; không đưa S3 URL, object key, PDF, ảnh, PII hoặc nội dung bệnh án lên chain.

Medical file download vẫn đi qua endpoint backend `/api/medical-orders/results/files/:fileId/download`; backend kiểm tra RBAC rồi mới trả pre-signed URL ngắn hạn. File Cloudinary medical cũ không migrate trong phase này; nếu DB còn `url` legacy và URL đó còn sống thì endpoint vẫn mở được.

## Tài liệu liên quan

- [AGENTS.md](./AGENTS.md)
- [docs/security/audit-logging.md](./docs/security/audit-logging.md)
- [docs/security/tiers-and-anchoring.md](./docs/security/tiers-and-anchoring.md)
- [docs/backup-recovery/overview.md](./docs/backup-recovery/overview.md)
- [tools/recovery-signer/README.md](./tools/recovery-signer/README.md)

## Quy ước phát triển

- Backend dùng feature-based modules, DTO validation bằng `class-validator`, business logic nằm ở service/use case.
- Multi-step workflow phải dùng transaction.
- Entity quan trọng phải ghi audit và anchor hash/root.
- Blockchain không lưu PII, file y tế, nội dung chẩn đoán hoặc dữ liệu lớn.
- `.env` không được commit; cập nhật `.env.example` khi thêm biến mới.
