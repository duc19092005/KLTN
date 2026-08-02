# Hướng Dẫn Triển Khai Blockchain & Smart Contracts KLTN

Bộ Hợp đồng thông minh (Smart Contracts) phục vụ lưu vết kiểm toán (Audit Trail) và xác thực tính toàn vẹn dữ liệu cho Hệ thống Quản lý Bệnh viện KLTN.

> [!IMPORTANT]
> Blockchain trong dự án này **chỉ dùng để neo hash, Merkle root, dấu thời gian (timestamp) và metadata kỹ thuật**. Tuyệt đối không đưa thông tin định danh bệnh nhân (PII), thông tin bệnh án, tệp PDF, ảnh X-Ray, ảnh y tế, S3 object key, tệp thô hay nội dung chẩn đoán lên chuỗi.

---

## Bộ Hợp Đồng Thông Minh (Contract Set)

| Hợp đồng | Vai trò & Chức năng | Quyền ghi dữ liệu |
|---|---|---|
| `IdentityRegistry` | **Root Governance:** Quản lý danh sách ví Admin và ví Relayer backend | `owner` |
| `FaceRegistry` | Lưu vết dấu hash khuôn mặt sinh trắc học | `IdentityRegistry.owner()` hoặc Relayer đã được ủy quyền |
| `AuditAnchor` | Neo Merkle root của lô kiểm toán (Audit batch) | `IdentityRegistry.owner()` hoặc Relayer đã được ủy quyền |

`FaceRegistry` và `AuditAnchor` không duy trì danh sách Relayer riêng. Hai hợp đồng này truy vấn quyền hạn trực tiếp từ `IdentityRegistry`, do đó việc xoay vòng (rotate) Relayer / Admin chỉ cần thao tác tại một nơi duy nhất.

---

## Mô Hình Quản Lý Khóa (Key Model)

| Loại Khóa | Mục đích sử dụng | Môi trường Local Dev | Môi trường Production |
|---|---|---|---|
| `PRIVATE_KEY` | Khóa Deployer cho mạng Hardhat `custom` | Có thể là tài khoản mặc định Hardhat #0 | Chỉ dùng trên máy deploy / CI secret; không đưa vào backend runtime. |
| `BLOCKCHAIN_OWNER_PRIVATE_KEY` | Khóa quản trị cao nhất (Owner): Thêm/xóa relayer, ủy quyền/thu hồi ví Admin, chuyển quyền sở hữu | Lưu trong `apps/audit-contracts/.env` để thao tác nhanh | **Tuyệt đối không lưu trên backend**; phải dùng Ví lạnh (Cold wallet) hoặc Ví đa chữ ký (Multisig). |
| `BLOCKCHAIN_RELAYER_PRIVATE_KEY` | Ví Hot wallet backend dùng để ký tự động `commitRoot`, `setFaceHash`, `recordAction` | Đặt tại `apps/hospital-api/.env` | Lưu trong Secret Manager / môi trường Backend runtime; có thể thu hồi & thay thế linh hoạt. |
| **Admin Wallet** | Ví cá nhân Admin để đăng nhập, xác thực nâng cao, khôi phục sự cố | Ví MetaMask dev | Hardware wallet hoặc ví quản trị được Governance ủy quyền. |

Thực tế vận hành:
- Ví Admin cá nhân không trả phí gas cho các giao dịch audit hàng ngày.
- Ví Relayer của backend mới là bên ký và trả gas cho các giao dịch vận hành.
- Owner chỉ sử dụng khi thay đổi quản trị: thêm/xóa Relayer, thêm/xóa ví Admin, chuyển quyền sở hữu hợp đồng.

---

## Cấu Trúc File Môi Trường (Environment Files)

Dự án đã phân tách biến môi trường theo từng thư mục ứng dụng:

```text
KLTN/apps/hospital-api/.env       # Backend runtime: DB, Auth, S3, Audit, Blockchain RPC/Relayer
KLTN/apps/hospital-web/.env       # Frontend công khai VITE_* config
KLTN/apps/audit-contracts/.env    # Blockchain deploy & governance config
```

Khởi tạo biến môi trường cho hợp đồng:

```bash
cd apps/audit-contracts
cp .env.example .env
```

Các biến quan trọng trong `apps/audit-contracts/.env` chỉ dành cho triển khai và quản trị:

```env
# Địa chỉ mạng triển khai
NETWORK_RPC_URL=https://your-production-rpc.example
PRIVATE_KEY=0x...

# Quản trị (Governance)
BLOCKCHAIN_OWNER_ADDRESS=0x...
BLOCKCHAIN_OWNER_PRIVATE_KEY=0x...
BLOCKCHAIN_RELAYER_ADDRESS=0x...
```

---

## Kịch Bản 1: Triển Khai Môi Trường Local Development

Sử dụng kịch bản này khi chạy đồ án trên máy cá nhân với node Hardhat miễn phí gas.

### Kiến Trúc Môi Trường Local

```text
Trình duyệt / Frontend
  └── http://localhost:5173
Backend API
  ├── Chạy trực tiếp: http://127.0.0.1:8545
  └── Chạy qua Docker: http://host.docker.internal:8545
Node Hardhat Local
  └── Chạy từ thư mục apps/audit-contracts
Database PostgreSQL
  └── Dịch vụ Docker PostgreSQL
```

`infrastructure/compose/compose.yml` không khởi chạy container blockchain tự động. Node Blockchain phải được khởi chạy riêng từ thư mục `apps/audit-contracts/`.

### 1. Cài Đặt Thư Viện

```bash
cd apps/audit-contracts
npm install
cp .env.example .env
```

### 2. Khởi Chạy Node Hardhat Local

Mở **Terminal 1**:

```bash
cd apps/audit-contracts
npm run node
```

Lệnh này mở cổng Hardhat node tại `0.0.0.0:8545`, giúp ứng dụng Backend trong Docker truy cập được qua `host.docker.internal:8545`.

### 3. Deploy Hợp Đồng Smart Contracts

Mở **Terminal 2**:

```bash
cd apps/audit-contracts
npm run compile
npm test
npm run deploy:local
```

Script `deploy:local` sẽ tự động:
1. Triển khai `IdentityRegistry`.
2. Triển khai `FaceRegistry` liên kết với địa chỉ `IdentityRegistry`.
3. Triển khai `AuditAnchor` liên kết với địa chỉ `IdentityRegistry`.
4. Đăng ký backend relayer từ `BLOCKCHAIN_RELAYER_ADDRESS`.
5. Chuyển quyền sở hữu (Ownership) sang `BLOCKCHAIN_OWNER_ADDRESS` nếu Owner khác Deployer.
6. In ra thông số cấu hình để sao chép vào các file `.env`.

Sau khi deploy, sao chép kết quả vào `apps/audit-contracts/.env`:

```env
NETWORK_RPC_URL=http://127.0.0.1:8545
BLOCKCHAIN_OWNER_ADDRESS=0x...
BLOCKCHAIN_RELAYER_ADDRESS=0x...
```

Sao chép thông số sang `apps/hospital-api/.env`:

```env
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
IDENTITY_REGISTRY_ADDRESS=0x...
FACE_REGISTRY_ADDRESS=0x...
AUDIT_ANCHOR_ADDRESS=0x...
BLOCKCHAIN_RELAYER_ADDRESS=0x...
BLOCKCHAIN_RELAYER_PRIVATE_KEY=0x...
```

Lưu ý: Node Hardhat local sẽ xóa sạch trạng thái khi bị tắt hoặc khởi động lại. Nếu khởi động lại node, bạn phải chạy lại lệnh deploy và cập nhật địa chỉ hợp đồng mới vào `apps/hospital-api/.env`.

---

## Kịch Bản 2: Triển Khai Môi Trường Production / Mạng Thật

Sử dụng kịch bản này khi triển khai lên mạng Testnet (Sepolia/Holesky), L2 (Base/Arbitrum), hoặc mạng EVM riêng của bệnh viện.

Khuyến nghị Production:
- Nên dùng L2 / mạng EVM riêng để tối ưu chi phí gas.
- Owner phải là ví lạnh / Multisig.
- Backend chỉ giữ khóa Hot wallet Relayer và có thể thu hồi / thay thế khi cần.

### Các Bước Triển Khai Mạng Thật:

```bash
cd apps/audit-contracts
npm install
npm run compile
npm test
npm run deploy:custom
```

Sau khi hoàn tất deploy:
1. Kiểm tra trạng thái chuyển giao quyền sở hữu `IdentityRegistry.owner() == BLOCKCHAIN_OWNER_ADDRESS`.
2. Đảm bảo ví Relayer đã có đủ số dư native token để chi trả phí gas.
3. Cập nhật các biến địa chỉ hợp đồng vào môi trường Production của Backend.

---

## Các Lệnh Thường Dùng (Common Commands)

```bash
npm run compile           # Biên dịch hợp đồng Solidity
npm test                  # Chạy toàn bộ unit tests
npm run node              # Mở Hardhat node local
npm run deploy:local      # Deploy bộ hợp đồng lên Hardhat local
npm run deploy:custom     # Deploy lên mạng tùy chỉnh (Production/Testnet)
npm run deploy:audit:local # Triển khai lại hợp đồng audit local
```

---

## Xử Lý Lỗi Thường Gặp (Troubleshooting)

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Backend báo lỗi `IDENTITY_REGISTRY_ADDRESS not set` | Thiếu cấu hình địa chỉ hợp đồng backend | Kiểm tra và cập nhật `apps/hospital-api/.env` |
| Giao dịch thất bại `not authorized` | Ví Relayer chưa được thêm vào `IdentityRegistry` | Dùng ví Owner gọi `addRelayer(relayer)` |
| Giao dịch thất bại do Gas | Ví Relayer hết native token | Nạp thêm native token / ETH gas cho ví Relayer |
| Reset Hardhat node xong app lỗi | Mạng local bị mất trạng thái và địa chỉ cũ | Chạy lại lệnh deploy và cập nhật địa chỉ mới vào `.env` |

---

## Quy Tắc Bảo Mật (Security Rules)

- Không bao giờ commit tệp `.env` lên phiên bản Git.
- Không lưu dữ liệu định danh bệnh nhân (PII), tệp y tế hay nội dung bệnh án lên Blockchain.
- Không lưu private key của Owner trên server backend Production.
- Khóa Relayer là hot key, phải thiết lập giám sát số dư và có quy trình xoay vòng khóa khi lộ.
- Dữ liệu Merkle Root sau khi neo là bằng chứng bất biến (Immutable Evidence); tuyệt đối không sửa đổi lịch sử.
