# Quy Trình Chuẩn Đoán 2 Bước (Two-Step Diagnosis Workflow)

## Tổng Quan

Hệ thống chuẩn đoán được thiết kế với 2 bước chính:

1. **Bước 1: Chuẩn Đoán Sơ Bộ Bằng AI** - Model AI phân tích hình ảnh y tế và đưa ra kết quả dự đoán
2. **Bước 2: Kết Luận Chuyên Môn & Xác Nhận Blockchain** - Bác sĩ xem xét kết quả AI, đưa ra kết luận cuối cùng và ghi lên blockchain

## Kiến Trúc Hệ Thống

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Doctor    │─────▶│   Backend    │─────▶│  AI Model   │
│  (Frontend) │      │   (NestJS)   │      │   Service   │
└─────────────┘      └──────────────┘      └─────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Blockchain  │
                     │  (Hardhat)   │
                     └──────────────┘
```

## Bước 1: Chuẩn Đoán Sơ Bộ Bằng AI

### Flow Diagram

```
Doctor                    Backend                    AI Service
  │                          │                           │
  │  Upload Image           │                           │
  │  + Patient ID           │                           │
  │  + AI Model ID          │                           │
  ├────────────────────────▶│                           │
  │                          │  POST /diagnose          │
  │                          │  - imageBuffer           │
  │                          │  - patientId             │
  │                          │  - modelId               │
  │                          ├──────────────────────────▶│
  │                          │                           │
  │                          │  AI Analysis Results     │
  │                          │  - confidence scores     │
  │                          │  - segment image hash    │
  │                          │◀──────────────────────────┤
  │                          │                           │
  │                          │  Create AiDiagnosis      │
  │                          │  - status: PENDING       │
  │                          │  - inputImageHash        │
  │                          │  - aiResults (JSON)      │
  │                          │                           │
  │  Return diagnosisId     │                           │
  │  + AI Results            │                           │
  │◀────────────────────────┤                           │
  │                          │                           │
```

### API Endpoint

**POST** `/api/hospital/diagnose`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Body (FormData):**
```javascript
{
  patientId: "P-12345",
  aiModelId: "uuid-of-ai-model",
  doctorId: "uuid-of-doctor",
  image: File // Image file (max 10MB)
}
```

**Response:**
```json
{
  "diagnosisId": "uuid-of-diagnosis",
  "aiResults": {
    "id": "uuid",
    "inputImageHash": "sha256-hash",
    "aiDiagnoseConfidentResults": "{\"pneumonia\":0.85,\"normal\":0.15}",
    "aiDiagnoseSegmentImageHash": "sha256-hash",
    "diagnoseStatus": "PENDING",
    "createdAt": "2026-05-24T10:30:00Z"
  },
  "message": "AI diagnosis completed successfully"
}
```

### Database Schema

```prisma
model AiDiagnosis {
  id                          String   @id @default(uuid())
  doctorId                    String
  doctor                      DoctorProfile @relation(...)
  
  aiModelId                   String
  aiModel                     AiModelInfo @relation(...)
  
  inputImageHash              String   // SHA-256 hash of input image
  aiDiagnoseConfidentResults  String   // JSON: {"disease": 0.85, "normal": 0.15}
  aiDiagnoseSegmentImageHash  String   // Hash of segmented/annotated image
  diagnoseStatus              String   @default("PENDING") // PENDING | COMPLETED
  
  finalConclude               DoctorFinalConclude?
  
  createdAt                   DateTime @default(now())
  updatedAt                   DateTime @updatedAt
}
```

## Bước 2: Kết Luận Chuyên Môn & Blockchain

### Flow Diagram

```
Doctor                    Backend                    Blockchain
  │                          │                           │
  │  Review AI Results      │                           │
  │  + Final Conclusion     │                           │
  │  + Treatment Regimen    │                           │
  │  + Notes                │                           │
  ├────────────────────────▶│                           │
  │                          │  POST /conclude          │
  │                          │                           │
  │                          │  Hash Conclusion         │
  │                          │  SHA-512(conclusion +    │
  │                          │          treatment +     │
  │                          │          note +          │
  │                          │          diagnosisId)    │
  │                          │                           │
  │                          │  Register on Blockchain  │
  │                          │  - conclusionHash        │
  │                          ├──────────────────────────▶│
  │                          │                           │
  │                          │  Transaction Hash        │
  │                          │◀──────────────────────────┤
  │                          │                           │
  │                          │  Create DoctorFinalConclude
  │                          │  + BlockchainHistory     │
  │                          │                           │
  │                          │  Update AiDiagnosis      │
  │                          │  - status: COMPLETED     │
  │                          │                           │
  │  Success + TX Hash      │                           │
  │◀────────────────────────┤                           │
  │                          │                           │
```

### API Endpoint

**POST** `/api/hospital/conclude`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Body:**
```json
{
  "diagnosisId": "uuid-of-diagnosis",
  "finalConclusion": "Bệnh nhân bị viêm phổi do vi khuẩn...",
  "treatmentRegimen": "Kháng sinh Amoxicillin 500mg x 3 lần/ngày...",
  "note": "Tái khám sau 7 ngày"
}
```

**Response:**
```json
{
  "message": "Doctor conclusion recorded successfully",
  "conclude": {
    "id": "uuid",
    "diagnoseId": "uuid",
    "finalConclusionMessageHash": "sha512-hash",
    "treatmentRegimen": "...",
    "note": "...",
    "blockchainHistory": {
      "transactionId": "0x123abc...",
      "blockchainStatus": "SUCCESS",
      "confirmTime": "2026-05-24T10:35:00Z"
    }
  },
  "blockchainTxHash": "0x123abc...",
  "blockchainStatus": "SUCCESS",
  "conclusionHash": "sha512-hash"
}
```

### Database Schema

```prisma
model DoctorFinalConclude {
  id                          String   @id @default(uuid())
  diagnoseId                  String   @unique
  diagnose                    AiDiagnosis @relation(...)
  
  finalConclusionMessageHash  String   // SHA-512 hash
  treatmentRegimen            String
  note                        String?
  
  blockchainHistoryId         String?  @unique
  blockchainHistory           BlockchainHistory? @relation(...)
  
  createdAt                   DateTime @default(now())
  updatedAt                   DateTime @updatedAt
}

model BlockchainHistory {
  id                  String   @id @default(uuid())
  transactionId       String   @unique // Blockchain TX hash
  confirmTime         DateTime
  blockchainStatus    String   // SUCCESS | FAILED | PENDING
  errorReason         String?
  errorLog            String?
  retryCount          Int      @default(0)
  
  doctorProfile       DoctorProfile? @relation(...)
  doctorConclude      DoctorFinalConclude? @relation(...)
  
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

## Security & Privacy

### 1. Data Hashing
- **Input Image**: SHA-256 hash được lưu thay vì ảnh gốc
- **AI Results**: Lưu dưới dạng JSON string
- **Final Conclusion**: SHA-512 hash của toàn bộ kết luận

### 2. Blockchain Recording
- Chỉ hash được ghi lên blockchain, không có dữ liệu nhạy cảm
- Transaction hash được lưu để audit trail
- Fallback mechanism nếu blockchain không khả dụng

### 3. Access Control
- Chỉ bác sĩ được phép tạo chuẩn đoán
- JWT authentication required
- Role-based access control (RBAC)

## Frontend Components

### 1. DiagnosisWorkflow.jsx
Component modal 2 bước cho quy trình chuẩn đoán:
- Step 1: Form upload ảnh + chọn AI model
- Step 2: Form nhập kết luận + phác đồ điều trị
- Progress indicator
- Status messages
- Error handling

### 2. DiagnosisPage.jsx
Trang quản lý danh sách chuẩn đoán:
- Statistics cards (Total, Pending, Completed)
- Diagnoses table với filter
- Button "New Diagnosis" mở DiagnosisWorkflow
- Detail view cho từng chuẩn đoán

## Environment Variables

```env
# AI Model Service URL
PATIENT_API_URL=http://localhost:8001/patients

# Blockchain
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
IDENTITY_REGISTRY_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512

# Super Admin Private Key (for blockchain transactions)
SUPER_ADMIN_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

## Testing

### Manual Testing Flow

1. **Login as Doctor**
   ```
   Username: doctor1
   Password: doctor123
   ```

2. **Navigate to Diagnosis Page**
   ```
   /diagnosis
   ```

3. **Click "New Diagnosis"**
   - Upload medical image (X-ray, CT scan, etc.)
   - Select AI Model
   - Enter Patient ID
   - Click "AI Diagnose"

4. **Review AI Results**
   - Check confidence scores
   - Review segmented image (if available)

5. **Enter Final Conclusion**
   - Write professional conclusion
   - Enter treatment regimen
   - Add notes (optional)
   - Click "Confirm & Record on Blockchain"

6. **Verify Blockchain Transaction**
   - Check transaction hash
   - Verify status is "SUCCESS"
   - View in blockchain explorer (if available)

### API Testing with cURL

**Step 1: AI Diagnosis**
```bash
curl -X POST http://localhost:3000/api/hospital/diagnose \
  -H "Authorization: Bearer <jwt_token>" \
  -F "patientId=P-12345" \
  -F "aiModelId=<model-uuid>" \
  -F "doctorId=<doctor-uuid>" \
  -F "image=@/path/to/xray.jpg"
```

**Step 2: Doctor Conclusion**
```bash
curl -X POST http://localhost:3000/api/hospital/conclude \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "diagnosisId": "<diagnosis-uuid>",
    "finalConclusion": "Patient has bacterial pneumonia...",
    "treatmentRegimen": "Amoxicillin 500mg x 3 times/day...",
    "note": "Follow-up in 7 days"
  }'
```

## Future Enhancements

1. **AI Model Versioning**: Track which version of AI model was used
2. **Multi-modal Input**: Support multiple images, videos, or sensor data
3. **Collaborative Diagnosis**: Multiple doctors can review and comment
4. **Patient Portal**: Patients can view their diagnosis results
5. **Analytics Dashboard**: Aggregate statistics on AI accuracy vs doctor conclusions
6. **IPFS Integration**: Store images on IPFS instead of centralized storage
7. **Zero-Knowledge Proofs**: Prove diagnosis validity without revealing patient data

## References

- [Prisma Schema](/backend/prisma/schema.prisma)
- [Hospital Service](/backend/src/hospital/hospital.service.ts)
- [Hospital Controller](/backend/src/hospital/hospital.controller.ts)
- [Diagnosis Workflow Component](/frontend/src/components/DiagnosisWorkflow.jsx)
- [Diagnosis Page](/frontend/src/pages/DiagnosisPage.jsx)
