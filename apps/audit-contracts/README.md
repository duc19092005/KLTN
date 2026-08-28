# Smart Contracts - Blockchain Audit & Identity Registry

Gói `apps/audit-contracts` chứa toàn bộ hợp đồng thông minh (Smart Contracts) viết bằng **Solidity (v0.8.20)** trên nền tảng **Hardhat**, phục vụ quản trị phân quyền (Governance), lưu trữ dấu vết sinh trắc học và neo các mốc Checkpoint kiểm toán (Audit Merkle Root) bất biến.

---

## 🏛️ Danh Sách Hợp Đồng Thông Minh

### 1. `IdentityRegistry.sol` (Quản trị Phân quyền Trung tâm)
- **Vai trò:** Hợp đồng gốc quản lý danh sách các địa chỉ ví có thẩm quyền trong hệ thống.
- **Chức năng chính:**
  - `addAdmin(address)` / `removeAdmin(address)`: Cấp hoặc thu hồi quyền Admin.
  - `addRelayer(address)` / `removeRelayer(address)`: Cấp hoặc thu hồi quyền ví Relayer (Backend Server).
  - `isAuthorized(address)`: Kiểm tra ví có quyền Admin/Relayer/Owner.
  - `recordAction(bytes32 actionHash)`: Ghi nhận vết băm hành động quản trị quan trọng on-chain.

### 2. `FaceRegistry.sol` (Đăng ký & Xác thực Sinh trắc học)
- **Vai trò:** Lưu trữ dấu vết băm của vector khuôn mặt phục vụ xác thực phi tập trung và khôi phục tài khoản.
- **Chức năng chính:**
  - `setFaceHash(address user, bytes32 faceHash)`: Ghi hash vector khuôn mặt đã đăng ký (chỉ Relayer/Owner được gọi).
  - `getFaceHash(address user)`: Truy vấn hash khuôn mặt để đối soát xác thực.
  - `setRecoveryArtifact(address user, bytes32 artifactHash, string uri)`: Lưu trữ artifact khôi phục trên IPFS.

### 3. `AuditAnchor.sol` (Neo Checkpoint Kiểm toán Merkle)
- **Vai trò:** Lưu trữ các mốc kiểm toán Merkle Root và IPFS CID bất biến theo thời gian.
- **Chức năng chính:**
  - `commitCheckpoint(uint256 batchId, bytes32 merkleRoot, uint256 leafCount, uint256 fromSeq, uint256 toSeq, bytes32 artifactHash, string calldata artifactUri)`: Neo lô kiểm toán mới.
  - `getCheckpoint(uint256 batchId)`: Truy vấn chi tiết mốc kiểm toán.
  - `latestBatchId()`: Lấy số hiệu lô kiểm toán mới nhất đã neo trên chuỗi.

---

## ⚙️ Cài Đặt & Triển Khai (Deployment)

### 1. Cài đặt Dependencies
```bash
cd apps/audit-contracts
npm install
```

### 2. Khởi chạy Hardhat Node Local
```bash
# Khởi chạy node blockchain local (RPC: http://localhost:8545, ChainId: 31337)
npm run node
```

### 3. Triển khai Smart Contracts lên Node Local
Mở terminal thứ hai:
```bash
npm run deploy:local
```
Sau khi triển khai thành công, các địa chỉ hợp đồng (`IdentityRegistry`, `FaceRegistry`, `AuditAnchor`) sẽ được in ra terminal để cấu hình vào `.env` của Backend và Frontend.

### 4. Chạy Kiểm thử Smart Contracts
```bash
npm test
```