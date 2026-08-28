# Tài Liệu Chi Tiết Use Cases - Backend Hospital API

Tài liệu này mô tả toàn bộ các Use Case (Trường hợp sử dụng) nghiệp vụ trong hệ thống `apps/hospital-api`, bao gồm luồng thực thi, quy tắc toàn vẹn (Invariants), giao dịch cơ sở dữ liệu và sự kiện Audit phát sinh.

---

## Mục lục Phân hệ Use Cases
1. [Phân hệ Xác thực & Bảo mật (Auth & Security)](#1-phân-hệ-xác-thực--bảo-mật-auth)
2. [Phân hệ Quyết định Lâm sàng & Trợ lý AI (Clinical Decision & Multi-AI)](#2-phân-hệ-quyết-định-lâm-sàng--trợ-lý-ai)
3. [Phân hệ Chỉ định & Kết quả Cận lâm sàng (Medical Order & Lab)](#3-phân-hệ-chỉ-định--kết-quả-cận-lâm-sàng)
4. [Phân hệ Cổng Bệnh nhân (Patient Portal)](#4-phân-hệ-cổng-bệnh-nhân-patient-portal)
5. [Phân hệ Quản lý Bệnh nhân (Patient Management)](#5-phân-hệ-quản-lý-bệnh-nhân)
6. [Phân hệ Ca khám bệnh (Visit Management)](#6-phân-hệ-ca-khám-bệnh-visit)
7. [Phân hệ Quản lý Bác sĩ & Nhân sự (Doctor & Staff)](#7-phân-hệ-quản-lý-bác-sĩ--nhân-sự)
8. [Phân hệ Quản lý Khoa phòng (Department)](#8-phân-hệ-quản-lý-khoa-phòng)
9. [Phân hệ Quản trị Mô hình AI (AI Model Registry)](#9-phân-hệ-quản-trị-mô-hình-ai)

---

## 1. Phân hệ Xác thực & Bảo mật (Auth)

### 1.1. `BootstrapAdminUseCase`
- **Mục đích:** Khởi tạo Super Admin đầu tiên của bệnh viện khi hệ thống mới dựng.
- **Đầu vào:** `username`, `email`, `secret`.
- **Luồng & Toàn vẹn:**
  - Kiểm tra xem DB đã có Super Admin chưa. Nếu đã có thì chặn để tránh ghi đè trái phép.
  - So khớp `secret` với `BOOTSTRAP_ADMIN_SECRET` trong môi trường.
  - Tạo tài khoản Admin, băm mật khẩu ngẫu nhiên tạm thời, tạo `AdminProfile` và ghi log audit `CREATE`.

### 1.2. `PasswordLoginUseCase` & `StaffLoginUseCase`
- **Mục đích:** Đăng nhập cho nhân viên bệnh viện bằng tài khoản/mật khẩu.
- **Quy tắc:** Thử sai quá 5 lần trong 15 phút sẽ bị rate limit tạm khóa IP; kiểm tra `tokenVersion` và trạng thái `ACTIVE`.

### 1.3. `VerifyFaceUseCase` & `VerifyFaceForStepUpUseCase`
- **Mục đích:** Xác thực sinh trắc học khuôn mặt cho đăng nhập và cấp vé Face Step-Up Ticket.
- **Thuật toán:** Tính khoảng cách Cosine giữa 128-d vector gửi lên và vector đã đăng ký trong DB. Ngưỡng chấp nhận $\le 0.45$.
- **Toàn vẹn:** Kiểm tra challenge nonce dùng một lần chống tấn công phát lại (Replay Attack).

### 1.4. `VerifyWalletUseCase` & `WalletLoginUseCase`
- **Mục đích:** Xác minh quyền Admin thông qua chữ ký số ví Web3 (MetaMask/EIP-191).
- **Quy tắc:** Khôi phục địa chỉ ví từ chữ ký (ecrecover) và so khớp với `IdentityRegistry.isAuthorized(wallet)`.

### 1.5. `AdminWalletRecovery*` & `AdminFaceRecovery*`
- **Mục đích:** Khôi phục tài khoản Admin tối cao khi bị mất ví hoặc hỏng dữ liệu sinh trắc học.
- **Quy tắc:** Kết hợp xác thực chéo giữa On-chain Smart Contract `FaceRegistry` và bản lưu trữ phân tán IPFS.

---

## 2. Phân hệ Quyết định Lâm sàng & Trợ lý AI

### 2.1. `GenerateAiAnalysisUseCase`
- **Mục đích:** Gửi thông tin triệu chứng, sinh hiệu và kết quả cận lâm sàng sang Multi-AI Gateway để nhận phân tích y khoa.
- **Luồng:**
  - Tổng hợp hồ sơ ca khám `Visit` và các `MedicalResult` đã hoàn thành.
  - Làm sạch PII (xóa tên, CCCD, địa chỉ bệnh nhân).
  - Định tuyến đến mô hình AI được chọn (Claude 3.5 Sonnet, GPT-4o, Gemini 1.5 Pro).
  - Lưu kết quả vào `AiDiagnosis` kèm token usage, latency và model hash.

### 2.2. `ReviewAiDiagnosisUseCase`
- **Mục đích:** Ghi nhận sự đồng thuận hoặc chỉnh sửa của Bác sĩ đối với đề xuất của AI.
- **Quy tắc:** Bác sĩ chọn `ACCEPTED`, `REJECTED`, hoặc `MODIFIED` kèm lý do lâm sàng. Tạo dữ liệu đánh giá chất lượng `AiQuality` phục vụ audit y đức.

### 2.3. `CreateMedicalConclusionUseCase`
- **Mục đích:** Ký kết luận bệnh án chính thức cho ca khám bệnh.
- **Toàn vẹn:**
  - Bắt buộc kiểm tra ca khám ở trạng thái hợp lệ.
  - Ghi nhận mã chẩn đoán quốc tế ICD-10, đơn thuốc và lời dặn.
  - Thực thi trong Transaction nguyên tử: Khóa ca khám (`COMPLETED`), phát sinh `MedicalConclusion`, tạo chữ ký băm toàn vẹn `hashSnapshot`.
  - Phát sinh sự kiện Audit `CREATE` ghi nhận vào `BlockchainLogger`.

---

## 3. Phân hệ Chỉ định & Kết quả Cận lâm sàng

### 3.1. `CreateMedicalOrderUseCase`
- **Mục đích:** Bác sĩ ra y lệnh chỉ định xét nghiệm hoặc chẩn đoán hình ảnh.
- **Quy tắc:** Sinh mã phiếu `orderCode` chuẩn (ORD-YYYYMMDD-XXXXX), gán đúng khoa phòng thực hiện (X-quang, Xét nghiệm huyết học,...).

### 3.2. `CreateMedicalResultUseCase`
- **Mục đích:** Kỹ thuật viên cận lâm sàng nhập kết quả trị số xét nghiệm.
- **Quy tắc:** Cập nhật trạng thái phiếu `MedicalOrder` sang `COMPLETED`, tính toán hash toàn vẹn của kết quả.

### 3.3. `MapUploadedResultFilesUseCase`
- **Mục đích:** Gắn tệp kết quả hình ảnh (DICOM, JPG, PDF) đã upload lên S3 vào phiếu kết quả.
- **Quy tắc:** Lưu trữ `storageProvider = S3`, `bucket`, `objectKey`, `sha256` của file để đảm bảo file trên cloud không bị thay đổi lén.

---

## 4. Phân hệ Cổng Bệnh nhân (Patient Portal)

### 4.1. `CreatePatientProfileUseCase`
- **Mục đích:** Bệnh nhân tự tạo hồ sơ khám bệnh cho mình hoặc thân nhân.
- **Quy tắc:** Sinh mã bệnh nhân duy nhất `PAT-YYYYMMDD-XXXXX`, tự động thiết lập quyền sở hữu `PatientAccess` với quan hệ `SELF`, `CHILD`, hoặc `PARENT`.

### 4.2. `CreateAppointmentUseCase`
- **Mục đích:** Bệnh nhân đặt lịch hẹn khám trực tuyến trước khi đến viện.
- **Quy tắc:**
  - Kiểm tra khung giờ khám (Slot 30 phút từ 8h00 - 16h30).
  - Chặn trùng lịch khám của cùng 1 bác sĩ trong cùng khung giờ.
  - Tự động tạo mã QR Check-in HMAC-SHA256 có thời hạn 60 ngày.

### 4.3. `CheckInAppointmentUseCase`
- **Mục đích:** Tiếp đón bệnh nhân tự động tại quầy qua việc quét mã QR lịch hẹn.
- **Luồng & Toàn vẹn:**
  - Giải mã và xác thực chữ ký HMAC-SHA256 của mã QR.
  - Chuyển trạng thái lịch hẹn `Appointment` sang `CONFIRMED`.
  - Tự động tạo ca khám `Visit` chính thức trong CSDL và phát số thứ tự tiếp đón.

---

## 5. Phân hệ Quản lý Bệnh nhân

### 5.1. `CreatePatientUseCase`
- **Mục đích:** Nhân viên tiếp đón tạo hồ sơ bệnh nhân trực tiếp tại quầy hành chính.
- **Quy tắc:** Ràng buộc duy nhất CCCD (`citizenId`) và Mã định danh y tế. Tự động tính hash toàn vẹn `dataSalt` + `hash256`.

### 5.2. `VerifyPatientPublicUseCase`
- **Mục đích:** Cung cấp API công khai cho bên thứ ba (bảo hiểm, bệnh nhân) kiểm tra mã bệnh nhân và đối chiếu hash toàn vẹn đã lưu vết.

---

## 6. Phân hệ Ca khám bệnh (Visit)

### 6.1. `CreateVisitUseCase`
- **Mục đích:** Mở ca khám bệnh mới cho bệnh nhân tại một khoa phòng cụ thể.
- **Quy tắc:** Sinh mã `visitCode` duy nhất, khởi tạo chỉ số sinh hiệu ban đầu, phân bổ vào hàng đợi của Bác sĩ trực.

### 6.2. `ListVisitsUseCase`
- **Mục đích:** Truy vấn danh sách ca khám theo bộ lọc đa chiều (bác sĩ phụ trách, khoa phòng, trạng thái điều trị, khoảng thời gian).

---

## 7. Phân hệ Quản lý Bác sĩ & Nhân sự

### 7.1. `CreateDoctorWithStaffUseCase`
- **Mục đích:** Tiếp nhận Bác sĩ mới vào bệnh viện.
- **Luồng:** Thực thi trong 1 transaction tạo đồng thời 3 bản ghi: `User` (tài khoản đăng nhập), `StaffProfile` (hồ sơ nhân sự), `DoctorProfile` (chứng chỉ hành nghề, chuyên khoa).

### 7.2. `CreateStaffUseCase` & `UpdateStaffUseCase`
- **Mục đích:** Quản lý vòng đời nhân sự (tạo tài khoản, điều chuyển phòng ban, cập nhật trạng thái hoạt động).

---

## 8. Phân hệ Quản lý Khoa phòng

### 8.1. `CreateDepartmentUseCase` & `AssignManagerUseCase`
- **Mục đích:** Thành lập khoa phòng và bổ nhiệm Trưởng khoa.
- **Quy tắc:** Ràng buộc duy nhất mã khoa phòng `departmentCode`. Khi bổ nhiệm trưởng khoa, kiểm tra nhân sự phải thuộc khoa phòng tương ứng.

---

## 9. Phân hệ Quản trị Mô hình AI

### 9.1. `CreateAiModelUseCase` & `TestAiModelApiUseCase`
- **Mục đích:** Đăng ký mô hình AI mới vào hệ thống (Claude 3.5, GPT-4o, Gemini) và kiểm tra kết nối API trực tiếp trước khi kích hoạt.
- **Toàn vẹn:** Mã hóa an toàn API Key, lưu trữ tham số nhiệt độ, prompt hệ thống và hash cấu hình.