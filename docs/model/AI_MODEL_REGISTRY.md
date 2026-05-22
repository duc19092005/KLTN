# AI Model Registry - IP Hash Management

## Tổng quan

Hệ thống quản lý AI Model với IP hash được mã hóa và lưu trữ trên blockchain để đảm bảo tính toàn vẹn và bảo mật.

## Kiến trúc

### 1. Database Layer (PostgreSQL + Prisma)
- **AiModelRegistry**: Lưu trữ thông tin model và IP hash đã mã hóa
  - `modelId`: ID duy nhất của model
  - `modelName`: Tên model
  - `modelVersion`: Phiên bản
  - `ipHashEncrypted`: IP hash được mã hóa bằng AES-256
  - `ipHashPlain`: IP hash gốc (chỉ hiển thị 1 lần sau khi tạo)
  - `blockchainTxHash`: Transaction hash khi đăng ký trên blockchain
  - `isActiveOnChain`: Trạng thái active trên blockchain

### 2. Encryption Layer (AES-256)
- Sử dụng `ENCRYPTION_KEY` từ `.env` (64 hex chars = 32 bytes)
- Mã hóa IP hash trước khi lưu vào database
- Chỉ admin có thể decrypt để xem hoặc verify

### 3. Blockchain Layer (Smart Contract)
- **AiModelRegistry.sol**: Smart contract quản lý model trên blockchain
- Logic: `mapping(modelId => mapping(modelHash => bool isActive))`
- Lưu trữ SHA-256 hash của IP hash (không lưu plain text)
- Immutable và tamper-proof

## Luồng hoạt động

### Flow 1: Đăng ký Model mới

```
Admin → Vào trang quản lý Model AI
     ↓
Ấn vào thêm Model AI
     ↓
Hiển thị options (Thông qua địa chỉ IP / Thông qua API)
     ↓
Admin chọn phương thức thêm
     ↓
     ├─→ Thông qua địa chỉ IP:
     │   └─→ Thêm thông qua địa chỉ IP (Frontend)
     │
     └─→ Thông qua API:
         └─→ Thêm thông qua API (Backend)
              ↓
         Hash những thông tin quan trọng (Backend)
              ↓
         Add dữ liệu vào DB (Database)
              ↓
         Nhận kết quả
              ↓
         Kiểm tra điều kiện
              ├─→ Lỗi: Báo lỗi
              └─→ Thành công:
                   ↓
              Yêu cầu ký giao dịch Blockchain
                   ↓
              Scan khuôn mặt (Admin)
                   ↓
              Yêu cầu ký giao dịch Blockchain
                   ↓
              Admin ký giao dịch
                   ↓
              Nhận kết quả
                   ↓
              Kiểm tra điều kiện
                   ├─→ Lỗi: Báo lỗi
                   └─→ Thành công: Hoàn thành
```

### Các bước chi tiết:

#### Bước 1: Admin tạo model qua API
```bash
POST /ai-model/register
{
  "modelId": "resnet50-v1",
  "modelName": "ResNet50",
  "modelVersion": "1.0.0",
  "ipHash": "192.168.1.100:8080/model",
  "description": "ResNet50 for medical image classification"
}
```

**Backend xử lý:**
1. Mã hóa `ipHash` bằng AES-256 → `ipHashEncrypted`
2. Hash `ipHash` bằng SHA-256 → `ipHashForBlockchain`
3. Lưu vào database với `ipHashPlain` (tạm thời)
4. Trả về response với `ipHashPlain` và `ipHashForBlockchain`

**Response:**
```json
{
  "id": "uuid",
  "modelId": "resnet50-v1",
  "modelName": "ResNet50",
  "modelVersion": "1.0.0",
  "ipHashPlain": "192.168.1.100:8080/model",
  "ipHashForBlockchain": "0xabc123...",
  "message": "Model registered successfully. Save the ipHashPlain - it will not be shown again!"
}
```

#### Bước 2: Admin lưu ipHashPlain và xóa khỏi DB
```bash
POST /ai-model/:modelId/clear-plain-hash
```

#### Bước 3: Đăng ký lên Blockchain
```bash
POST /ai-model/blockchain/register/:modelId
```

**Backend xử lý:**
1. Lấy model từ database
2. Decrypt `ipHashEncrypted` → hash bằng SHA-256
3. Gọi smart contract `registerModel(modelId, modelName, modelVersion, ipHashForBlockchain)`
4. Đợi transaction confirm
5. Update database với `blockchainTxHash` và `isActiveOnChain = true`

**Response:**
```json
{
  "message": "Model registered on blockchain successfully",
  "modelId": "resnet50-v1",
  "txHash": "0x123abc...",
  "blockNumber": 12345
}
```

### Flow 2: Verify Model Hash

```bash
POST /ai-model/verify-hash
{
  "modelId": "resnet50-v1",
  "ipHash": "192.168.1.100:8080/model"
}
```

**Backend xử lý:**
1. Lấy model từ database
2. Decrypt `ipHashEncrypted`
3. So sánh với `ipHash` được cung cấp
4. Kiểm tra trạng thái trên blockchain (optional)

**Response:**
```json
{
  "modelId": "resnet50-v1",
  "isValid": true,
  "isActiveOnChain": true
}
```

### Flow 3: Thêm/Update IP Hash

```bash
POST /ai-model/add-hash
{
  "modelId": "resnet50-v1",
  "ipHash": "192.168.1.200:8080/model"
}
```

Sau đó đăng ký hash mới lên blockchain:
```bash
POST /ai-model/blockchain/add-hash/:modelId
{
  "ipHash": "192.168.1.200:8080/model"
}
```

## Smart Contract Interface

### AiModelRegistry.sol

```solidity
// Đăng ký model mới
function registerModel(
    string memory _modelId,
    string memory _modelName,
    string memory _modelVersion,
    string memory _ipHash
) external onlyAdmin

// Thêm hash mới cho model
function addModelHash(
    string memory _modelId,
    string memory _ipHash
) external onlyAdmin

// Deactivate hash
function deactivateModelHash(
    string memory _modelId,
    string memory _ipHash
) external onlyAdmin

// Activate hash
function activateModelHash(
    string memory _modelId,
    string memory _ipHash
) external onlyAdmin

// Kiểm tra hash có active không
function isModelHashActive(
    string memory _modelId,
    string memory _ipHash
) external view returns (bool)

// Lấy thông tin model
function getModelInfo(string memory _modelId)
    external view returns (
        string memory modelId,
        string memory modelName,
        string memory modelVersion,
        uint256 registeredAt,
        bool exists
    )
```

## API Endpoints

### Model Management
- `POST /ai-model/register` - Đăng ký model mới
- `GET /ai-model/list` - Danh sách models
- `GET /ai-model/:modelId` - Chi tiết model
- `POST /ai-model/verify-hash` - Verify IP hash
- `POST /ai-model/add-hash` - Thêm/update hash
- `POST /ai-model/:modelId/clear-plain-hash` - Xóa plain hash
- `GET /ai-model/:modelId/blockchain-hash` - Lấy hash cho blockchain

### Blockchain Operations
- `POST /ai-model/blockchain/register/:modelId` - Đăng ký lên blockchain
- `POST /ai-model/blockchain/add-hash/:modelId` - Thêm hash lên blockchain
- `POST /ai-model/blockchain/deactivate-hash/:modelId` - Deactivate hash
- `GET /ai-model/blockchain/verify/:modelId` - Verify trên blockchain
- `GET /ai-model/blockchain/info/:modelId` - Thông tin từ blockchain
- `GET /ai-model/blockchain/total` - Tổng số models trên blockchain

## Security Features

1. **Encryption**: IP hash được mã hóa AES-256 trước khi lưu DB
2. **One-time Display**: Plain IP hash chỉ hiển thị 1 lần sau khi tạo
3. **Blockchain Immutability**: Hash được lưu trên blockchain không thể thay đổi
4. **Admin Only**: Chỉ admin mới có quyền quản lý models
5. **Hash Verification**: Có thể verify hash mà không cần decrypt

## Deployment

### 1. Deploy Smart Contract
```bash
cd blockchain
npx hardhat run scripts/deploy-ai-model.js --network localhost
```

### 2. Update .env
```bash
AI_MODEL_REGISTRY_ADDRESS=0x...
```

### 3. Run Database Migration
```bash
cd backend
npx prisma migrate dev --name add_ai_model_registry
npx prisma generate
```

### 4. Initialize Blockchain Service
Thêm vào `blockchain.service.ts` trong `onModuleInit`:
```typescript
const aiModelAddress = process.env.AI_MODEL_REGISTRY_ADDRESS;
if (aiModelAddress) {
  this.initAiModelContract(aiModelAddress);
}
```

## Testing

### Smart Contract Tests
```bash
cd blockchain
npx hardhat test test/AiModelRegistry.test.js
```

### API Tests
```bash
# Register model
curl -X POST http://localhost:3000/ai-model/register \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "modelId": "test-model-001",
    "modelName": "Test Model",
    "modelVersion": "1.0.0",
    "ipHash": "192.168.1.100:8080/model"
  }'

# Verify hash
curl -X POST http://localhost:3000/ai-model/verify-hash \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "modelId": "test-model-001",
    "ipHash": "192.168.1.100:8080/model"
  }'
```

## Monitoring

- Check blockchain events: `ModelRegistered`, `ModelHashAdded`, `ModelHashDeactivated`
- Monitor database for `isActiveOnChain` status
- Track `blockchainTxHash` for audit trail

## Troubleshooting

1. **Encryption Error**: Kiểm tra `ENCRYPTION_KEY` trong `.env` (phải 64 hex chars)
2. **Blockchain Error**: Kiểm tra `AI_MODEL_REGISTRY_ADDRESS` và RPC connection
3. **Permission Error**: Đảm bảo user có role `ADMIN`
4. **Hash Mismatch**: Verify rằng IP hash được hash đúng cách (SHA-256)
