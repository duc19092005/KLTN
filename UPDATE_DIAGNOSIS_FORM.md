# Cập Nhật Form Chuẩn Đoán Sơ Bộ

## Thay Đổi

Form chuẩn đoán sơ bộ đã được cập nhật với các trường mới:

### Trước (Old):
- Mã bệnh nhân (Patient ID)
- Chọn AI Model
- Upload ảnh

### Sau (New):
1. **Chọn mô hình AI hoặc tìm kiếm** - Dropdown chọn AI model
2. **Họ tên bệnh nhân** - Text input
3. **Bệnh lý lâm sàng** - Text input (mô tả triệu chứng)
4. **Phác đồ & Thuốc điều trị** - Textarea (danh mục thuốc, liều lượng, cách dùng)
5. **Ghi chú bác sĩ** - Textarea (ghi chú về bệnh nhân)
6. **Upload ảnh** - Drag & drop hoặc click để chọn

## Database Migration

Đã thêm các trường mới vào bảng `AiDiagnosis`:

```sql
ALTER TABLE "AiDiagnosis" ADD COLUMN "patientName" TEXT;
ALTER TABLE "AiDiagnosis" ADD COLUMN "clinicalSymptoms" TEXT;
ALTER TABLE "AiDiagnosis" ADD COLUMN "preliminaryTreatment" TEXT;
ALTER TABLE "AiDiagnosis" ADD COLUMN "doctorNotes" TEXT;
```

## Cách Chạy Migration

### 1. Dừng backend (nếu đang chạy)
```bash
# Ctrl+C trong terminal đang chạy backend
```

### 2. Chạy Prisma migration
```bash
cd backend
npx prisma migrate dev --name add_patient_info_to_diagnosis
```

### 3. Generate Prisma Client
```bash
npx prisma generate
```

### 4. Khởi động lại backend
```bash
npm run start:dev
```

## Hoặc Chạy Migration Thủ Công

Nếu gặp lỗi với Prisma migrate, bạn có thể chạy SQL trực tiếp:

```bash
# Kết nối vào PostgreSQL
docker exec -it <postgres_container_name> psql -U postgres -d zkp_identity

# Chạy SQL
ALTER TABLE "AiDiagnosis" ADD COLUMN IF NOT EXISTS "patientName" TEXT;
ALTER TABLE "AiDiagnosis" ADD COLUMN IF NOT EXISTS "clinicalSymptoms" TEXT;
ALTER TABLE "AiDiagnosis" ADD COLUMN IF NOT EXISTS "preliminaryTreatment" TEXT;
ALTER TABLE "AiDiagnosis" ADD COLUMN IF NOT EXISTS "doctorNotes" TEXT;

# Thoát
\q
```

## API Changes

### POST /api/hospital/diagnose

**Before:**
```javascript
{
  patientId: "P-12345",
  aiModelId: "uuid",
  doctorId: "uuid",
  image: File
}
```

**After:**
```javascript
{
  patientName: "Nguyễn Văn A",
  clinicalSymptoms: "Viêm phổi cấp tính",
  preliminaryTreatment: "Amoxicillin 500mg x 3 lần/ngày",
  doctorNotes: "Bệnh nhân có tiền sử dị ứng penicillin",
  aiModelId: "uuid",
  doctorId: "uuid",
  image: File
}
```

## UI Changes

### Form Layout

```
┌─────────────────────────────────────────────┐
│  Tạo Chẩn Đoán AI Lâm Sàng Mật Mã (ZKP)   │
├─────────────────────────────────────────────┤
│                                             │
│  CHỌN MÔ HÌNH AI HOẶC TÌM KIẾM *           │
│  [Dropdown: -- Chọn mô hình AI --]         │
│                                             │
│  HỌ TÊN BỆNH NHÂN *                        │
│  [Input: e.g. Nguyễn Văn A]                │
│                                             │
│  BỆNH LÝ LÂM SÀNG *                        │
│  [Input: e.g. Viêm phổi cấp tính]          │
│                                             │
│  PHÁC ĐỒ & THUỐC ĐIỀU TRỊ *                │
│  [Textarea: Nhập danh mục thuốc...]        │
│                                             │
│  GHI CHÚ BÁC SĨ                            │
│  [Textarea: Ví dụ: Bệnh nhân có...]       │
│                                             │
│  UPLOAD ẢNH *                              │
│  [Drag & Drop Area with Preview]           │
│                                             │
│  [Hủy bỏ]  [Sinh Báo Cáo Lâm Sàng & Ký]   │
└─────────────────────────────────────────────┘
```

### Colors & Styling
- Primary color: Teal (#14b8a6)
- Button: `bg-teal-600 hover:bg-teal-700`
- Focus ring: `focus:ring-teal-500`
- Upload area: Dashed border with hover effect

## Testing

### 1. Khởi động hệ thống
```bash
# Terminal 1: Backend
cd backend
npm run start:dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

### 2. Truy cập trang chuẩn đoán
```
http://localhost:5173/diagnosis
```

### 3. Test workflow
1. Click "Chuẩn Đoán Mới"
2. Điền form:
   - Chọn AI Model
   - Nhập họ tên: "Nguyễn Văn A"
   - Nhập bệnh lý: "Viêm phổi cấp tính"
   - Nhập phác đồ: "Amoxicillin 500mg x 3 lần/ngày, uống sau ăn"
   - Nhập ghi chú: "Bệnh nhân có tiền sử dị ứng penicillin"
   - Upload ảnh X-quang
3. Click "Sinh Báo Cáo Lâm Sàng & Ký ZKP"
4. Xem kết quả AI
5. Nhập kết luận cuối cùng
6. Click "Xác Nhận & Ghi Blockchain"

## Files Changed

### Backend
- ✅ `/backend/prisma/schema.prisma` - Added patient info fields
- ✅ `/backend/src/hospital/hospital.service.ts` - Updated createAiDiagnosis()
- ✅ `/backend/src/hospital/hospital.controller.ts` - Updated endpoint params
- ✅ `/backend/prisma/migrations/add_patient_info_to_diagnosis/migration.sql` - Migration file

### Frontend
- ✅ `/frontend/src/components/DiagnosisWorkflow.jsx` - Redesigned form
- ✅ `/frontend/src/pages/DiagnosisPage.jsx` - Already created

## Troubleshooting

### Lỗi: "Column does not exist"
```bash
# Chạy lại migration
cd backend
npx prisma migrate reset
npx prisma migrate dev
npx prisma generate
```

### Lỗi: "doctorId is required"
- Đảm bảo user đã login và có doctorProfile
- Check `user?.doctorProfile?.id` trong console

### Lỗi: "Image file is required"
- Đảm bảo đã chọn file ảnh
- Check file size < 10MB
- Check file type là image/*

## Next Steps

1. ✅ Form chuẩn đoán sơ bộ đã được cập nhật
2. ✅ Database schema đã được mở rộng
3. ✅ API endpoints đã được cập nhật
4. ⏳ Chạy migration database
5. ⏳ Test workflow end-to-end
6. ⏳ Tích hợp với AI service thực tế (PATIENT_API_URL)

## References

- [Diagnosis Workflow Documentation](/docs/design/diagnosis-workflow.md)
- [Prisma Schema](/backend/prisma/schema.prisma)
- [Hospital Service](/backend/src/hospital/hospital.service.ts)
- [Diagnosis Workflow Component](/frontend/src/components/DiagnosisWorkflow.jsx)
