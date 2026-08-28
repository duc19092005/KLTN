# Tài Liệu Chi Tiết Các Controller - Backend Hospital API

Tài liệu này liệt kê toàn bộ các Controller, danh sách Endpoints, phương thức HTTP, phân quyền truy cập (RBAC), yêu cầu bảo mật nâng cao (Face Step-Up) và mục đích nghiệp vụ của từng API trong hệ thống `apps/hospital-api`.

---

## Mục lục
1. [Authentication (`AuthController`)](#1-authentication-authcontroller)
2. [Account & Recovery (`AuthRecoveryController`)](#2-account--recovery-authrecoverycontroller)
3. [Audit & Integrity (`AuditController`)](#3-audit--integrity-auditcontroller)
4. [Patient Management (`PatientController`, `PatientVerifyController`)](#4-patient-management)
5. [Patient Authentication (`PatientAuthController`)](#5-patient-authentication-patientauthcontroller)
6. [Patient Portal (`PatientPortalController`)](#6-patient-portal-patientportalcontroller)
7. [Visit Management (`VisitController`)](#7-visit-management-visitcontroller)
8. [Medical Orders & Laboratory (`MedicalOrderController`)](#8-medical-orders--laboratory-medicalordercontroller)
9. [Clinical Decision & AI Consultation (`ClinicalDecisionController`)](#9-clinical-decision--ai-consultation-clinicaldecisioncontroller)
10. [Doctor Management (`DoctorController`)](#10-doctor-management-doctorcontroller)
11. [Staff Management (`StaffController`)](#11-staff-management-staffcontroller)
12. [Department Management (`DepartmentController`)](#12-department-management-departmentcontroller)
13. [AI Model Registry (`AiModelController`)](#13-ai-model-registry-aimodelcontroller)
14. [Notification (`NotificationController`)](#14-notification-notificationcontroller)
15. [System Health (`AppController`)](#15-system-health-appcontroller)

---

## 1. Authentication (`AuthController`)
- **Prefix:** `/api/auth`
- **Mô tả:** Xử lý xác thực người dùng nội bộ (Admin, Bác sĩ, Nhân viên y tế, Kỹ thuật viên), đăng nhập mật khẩu, sinh trắc học khuôn mặt, kết nối ví Web3 và phiên làm việc.

| Endpoint | Method | Quyền (RBAC) | Step-Up | Mục đích |
|---|---|---|---|---|
| `/bootstrap` | `POST` | Public | Không | Khởi tạo tài khoản Quản trị viên (Super Admin) đầu tiên với Secret Token. |
| `/invite-login` | `POST` | Public | Không | Đăng nhập lần đầu bằng mã mời (Invite Token) do Admin cấp. |
| `/staff-login` | `POST` | Public | Không | Đăng nhập tài khoản nhân sự bằng username và password. |
| `/change-password` | `POST` | Đã đăng nhập (JWT) | Không | Đổi mật khẩu người dùng nội bộ (bắt buộc ở lần đầu kích hoạt). |
| `/register-face` | `POST` | Đã đăng nhập (JWT) | Không | Đăng ký vector đặc trưng khuôn mặt (128-d embedding) vào hệ thống. |
| `/wallet-bind-challenge` | `POST` | Đã đăng nhập (JWT) | Không | Tạo chuỗi thử thách để liên kết địa chỉ ví Web3 với tài khoản Admin. |
| `/verify-wallet` | `POST` | Đã đăng nhập (JWT) | Không | Xác minh chữ ký ví Web3 và liên kết chính thức vào hồ sơ Admin. |
| `/wallet-challenge/:address` | `GET` | Public | Không | Lấy chuỗi thử thách đăng nhập nhanh bằng ví Web3. |
| `/wallet-login` | `POST` | Public | Không | Đăng nhập bằng chữ ký số ví Web3 (EIP-191/Personal Sign). |
| `/face-challenge` | `POST` | Đã đăng nhập (JWT) | Không | Tạo nonce thử thách xác thực khuôn mặt sinh trắc học. |
| `/verify-face` | `POST` | Đã đăng nhập (JWT) | Không | Xác thực vector khuôn mặt với ngưỡng Cosine similarity (threshold 0.45). |
| `/face-stepup` | `POST` | Đã đăng nhập (JWT) | Không | Cấp vé xác thực nâng cao (Face Step-Up Ticket) cho các thao tác nhạy cảm. |
| `/generate-secret` | `POST` | Đã đăng nhập (JWT) | Không | Tạo secret MFA / TOTP cho tài khoản. |
| `/me` | `GET` | Đã đăng nhập (JWT) | Không | Lấy thông tin phiên làm việc hiện tại và quyền hạn. |
| `/profile` | `GET` | Đã đăng nhập (JWT) | Không | Lấy chi tiết hồ sơ nhân sự/bác sĩ tương ứng của người dùng. |
| `/logout` | `POST` | Public / JWT | Không | Đăng xuất và thu hồi cookie `token` an toàn (HttpOnly). |
| `/face-login/challenge` | `POST` | Public | Không | Tạo thử thách đăng nhập nhanh bằng khuôn mặt cho username. |
| `/face-login` | `POST` | Public | Không | Đăng nhập trực tiếp bằng khuôn mặt không cần nhập mật khẩu. |

---

## 2. Account & Recovery (`AuthRecoveryController`)
- **Prefix:** `/api/auth`
- **Mô tả:** Xử lý toàn bộ quy trình khôi phục tài khoản, quên mật khẩu và khôi phục ví Admin bằng sinh trắc học.

| Endpoint | Method | Quyền (RBAC) | Step-Up | Mục đích |
|---|---|---|---|---|
| `/forgot-password/challenge` | `POST` | Public | Không | Yêu cầu thử thách khôi phục mật khẩu qua khuôn mặt. |
| `/forgot-password/verify-face` | `POST` | Public | Không | Xác minh khuôn mặt chủ tài khoản để cấp Reset Token tạm thời. |
| `/forgot-password/reset` | `POST` | Public | Không | Đặt lại mật khẩu mới bằng Reset Token đã xác thực sinh trắc học. |
| `/admin-face-recovery/challenge` | `POST` | `ADMIN` | Không | Tạo thử thách khôi phục lại khuôn mặt Admin bị hỏng/lệch vector. |
| `/admin-face-recovery/restore` | `POST` | `ADMIN` | Không | Tải lại vector khuôn mặt gốc từ artifact IPFS đã neo Blockchain. |
| `/admin-account-recovery/challenge` | `POST` | Public | Không | Khởi tạo quy trình khôi phục khẩn cấp tài khoản Admin (mất ví/mật khẩu). |
| `/admin-account-recovery/verify-face` | `POST` | Public | Không | Xác thực khuôn mặt Admin đối chiếu với on-chain FaceRegistry. |
| `/admin-account-recovery/wallet-challenge`| `POST`| Public | Không | Cấp thử thách ký số cho địa chỉ ví mới cần gắn lại vào Admin. |
| `/admin-account-recovery/confirm-wallet` | `POST` | Public | Không | Xác nhận ví mới, kích hoạt lại quyền Admin trên hệ thống. |

---

## 3. Audit & Integrity (`AuditController`)
- **Prefix:** `/api/audit`
- **Mô tả:** Bảng điều khiển quản trị kiểm toán, đối soát Merkle Root on-chain, tra cứu hash-chain, xuất bằng chứng toán học và khôi phục dữ liệu bị can thiệp.

| Endpoint | Method | Quyền (RBAC) | Step-Up | Mục đích |
|---|---|---|---|---|
| `/logs` | `GET` | `ADMIN` | Không | Danh sách toàn bộ nhật ký kiểm toán (phân trang, lọc theo thực thể, actor, ngày). |
| `/logs/:seq` | `GET` | `ADMIN` | Không | Chi tiết 1 dòng log V2 (hiển thị diffJson, băm đa tầng, làm mờ dữ liệu nhạy cảm). |
| `/logs/:seq/proof` | `GET` | `ADMIN` | Không | Xuất Merkle Inclusion Proof (Sibling hashes) để xác minh độc lập với Blockchain. |
| `/verify-chain` | `GET` | `ADMIN` | Không | Duyệt tuần tự toàn bộ off-chain hash-chain V2 từ bản ghi 1 đến hiện tại. |
| `/batches` | `GET` | `ADMIN` | Không | Danh sách các lô Checkpoint đã neo trên Smart Contract `AuditAnchor.sol`. |
| `/batches/:batchId` | `GET` | `ADMIN` | Không | Chi tiết một batch kiểm toán, danh sách lá log và tỷ lệ toàn vẹn. |
| `/anchor-now` | `POST` | `ADMIN` | Không | Niêm phong cưỡng bức các log đang pending thành batch mới và neo On-chain. |
| `/recovery/:batchId` | `POST` | `ADMIN` | `RECOVER_AUDIT_BATCH` | Khôi phục một batch audit local bị hacker sửa/xóa từ IPFS Artifact. |
| `/recovery/deep-scan/status`| `GET`| `ADMIN` | Không | Xem trạng thái tiến trình Deep Scan và tự phục hồi nền. |
| `/recovery/watchdog/status` | `GET` | `ADMIN` | Không | Xem lịch trình và kết quả của Watchdog tự động 20 phút. |
| `/recovery/deep-scan` | `POST` | `ADMIN` | `DEEP_SCAN_SELF_HEAL` | Kích hoạt quét sâu toàn diện đối soát CSDL với Blockchain & IPFS. |
| `/recovery/entities/warnings`| `GET`| `ADMIN` | Không | Danh sách các thực thể nghiệp vụ có dữ liệu lệch với audit log đã neo. |
| `/recovery/entities` | `POST` | `ADMIN` | `RECOVER_AUDIT_ENTITIES` | Khôi phục dữ liệu nghiệp vụ bị can thiệp về snapshot audit đã xác thực. |
| `/recovery/entities/preview` | `POST` | `ADMIN` | Không | Xem trước kết quả khôi phục thực thể (kiểm tra xung đột & phụ thuộc). |

---

## 4. Patient Management
### `PatientController` (`/api/patients`)
- **Mô tả:** Quản lý thông tin hành chính của bệnh nhân trong bệnh viện.

| Endpoint | Method | Quyền (RBAC) | Mục đích |
|---|---|---|---|
| `/` | `GET` | `ADMIN`, `STAFF`, `DOCTOR` | Tìm kiếm và phân trang danh sách bệnh nhân (theo tên, mã, CCCD, SĐT). |
| `/` | `POST` | `ADMIN`, `STAFF` | Tiếp nhận và tạo mới hồ sơ bệnh nhân tại quầy tiếp đón. |
| `/:id` | `GET` | `ADMIN`, `STAFF`, `DOCTOR` | Xem chi tiết hồ sơ bệnh nhân và lịch sử điều trị. |
| `/:id` | `PATCH` | `ADMIN`, `STAFF` | Cập nhật thông tin hành chính bệnh nhân (địa chỉ, SĐT, người liên hệ). |
| `/:id` | `DELETE` | `ADMIN` | Xóa logic hoặc lưu trữ hồ sơ bệnh nhân. |

### `PatientVerifyController` (`/api/patients/public`)
- **Mô tả:** Cổng xác minh tính minh bạch hồ sơ bệnh nhân công khai.

| Endpoint | Method | Quyền | Mục đích |
|---|---|---|---|
| `/verify/:patientCode` | `GET` | Public | Xác minh mã bệnh nhân hợp lệ và kiểm tra hash toàn vẹn đã lưu vết. |

---

## 5. Patient Authentication (`PatientAuthController`)
- **Prefix:** `/api/patient-auth`
- **Mô tả:** Dành riêng cho bệnh nhân đăng nhập cổng thông tin/ứng dụng di động qua OTP SMS.

| Endpoint | Method | Quyền | Mục đích |
|---|---|---|---|
| `/request-otp` | `POST` | Public | Gửi mã OTP 6 số qua SMS (eSMS gateway) đến số điện thoại bệnh nhân. |
| `/resend-otp` | `POST` | Public | Gửi lại mã OTP sau thời gian chờ cooldown (60 giây). |
| `/verify-otp` | `POST` | Public | Xác minh OTP, liên kết hồ sơ bệnh nhân tự động và cấp JWT Token. |
| `/password-login`| `POST`| Public | Đăng nhập bằng số điện thoại và mật khẩu đã thiết lập. |
| `/change-password`| `POST`| `PATIENT` | Đổi mật khẩu tài khoản bệnh nhân. |

---

## 6. Patient Portal (`PatientPortalController`)
- **Prefix:** `/api/patient-portal`
- **Mô tả:** Dành cho bệnh nhân xem bệnh án, kết quả xét nghiệm/X-quang, đặt lịch khám và check-in QR.

| Endpoint | Method | Quyền | Mục đích |
|---|---|---|---|
| `/profiles` | `GET` | `PATIENT` | Danh sách hồ sơ bệnh nhân được liên kết với tài khoản này. |
| `/profiles` | `POST` | `PATIENT` | Tạo thêm hồ sơ người thân (con cái, cha mẹ) để quản lý chung. |
| `/profiles/:patientId` | `GET` | `PATIENT` | Xem chi tiết một hồ sơ liên kết. |
| `/profiles/:patientId/visits` | `GET` | `PATIENT` | Danh sách các ca khám chữa bệnh của hồ sơ. |
| `/profiles/:patientId/visits/:visitId` | `GET` | `PATIENT` | Chi tiết ca khám (chẩn đoán, đơn thuốc, chỉ định cận lâm sàng). |
| `/profiles/:patientId/results/files/:fileId/download` | `GET` | `PATIENT` | Lấy Pre-signed URL tải file kết quả PDF/ảnh X-Ray từ S3. |
| `/booking/specialties` | `GET` | `PATIENT` | Danh sách các chuyên khoa đang tiếp nhận đặt lịch. |
| `/booking/specialties/:specialty/doctors` | `GET` | `PATIENT` | Danh sách bác sĩ thuộc chuyên khoa được chọn. |
| `/booking/doctors/:doctorId/slots` | `GET` | `PATIENT` | Lấy danh sách khung giờ khám còn trống của bác sĩ theo ngày. |
| `/appointments` | `POST` | `PATIENT` | Đặt lịch hẹn khám bệnh trực tuyến. |
| `/appointments` | `GET` | `PATIENT` | Xem danh sách lịch hẹn khám của tài khoản. |
| `/appointments/:id/qr` | `GET` | `PATIENT` | Tạo mã QR Check-in mã hóa bảo mật dùng tại quầy bệnh viện. |
| `/appointments/:id/cancel` | `POST` | `PATIENT` | Hủy lịch hẹn đã đặt trước. |
| `/checkin/verify-qr` | `POST` | `STAFF`, `ADMIN` | Quét và giải mã mã QR của bệnh nhân tại quầy tiếp đón. |
| `/checkin/confirm` | `POST` | `STAFF`, `ADMIN` | Xác nhận check-in, tự động tạo ca khám (`Visit`) chính thức. |

---

## 7. Visit Management (`VisitController`)
- **Prefix:** `/api/visits`
- **Mô tả:** Quản lý toàn bộ vòng đời ca khám bệnh từ tiếp nhận đến kết thúc.

| Endpoint | Method | Quyền | Mục đích |
|---|---|---|---|
| `/` | `GET` | `ADMIN`, `STAFF`, `DOCTOR` | Tìm kiếm danh sách ca khám (theo mã ca khám, trạng thái, khoa phòng, ngày). |
| `/` | `POST` | `ADMIN`, `STAFF` | Khởi tạo ca khám mới cho bệnh nhân tại khoa khám. |
| `/:id` | `GET` | `ADMIN`, `STAFF`, `DOCTOR` | Xem chi tiết ca khám, sinh hiệu (huyết áp, mạch, nhiệt độ), triệu chứng. |
| `/:id/status` | `PATCH` | `ADMIN`, `STAFF`, `DOCTOR` | Cập nhật trạng thái ca khám (`WAITING_DOCTOR`, `IN_CONSULTATION`, `COMPLETED`, `CANCELLED`). |
| `/:id/transfer` | `POST` | `ADMIN`, `DOCTOR` | Chuyển ca khám sang khoa khác hoặc bác sĩ chuyên khoa khác. |

---

## 8. Medical Orders & Laboratory (`MedicalOrderController`)
- **Prefix:** `/api/medical-orders`
- **Mô tả:** Quản lý phiếu chỉ định cận lâm sàng (Xét nghiệm máu, X-Quang, MRI, CT, Siêu âm) và kết quả kỹ thuật viên.

| Endpoint | Method | Quyền | Mục đích |
|---|---|---|---|
| `/` | `GET` | `ADMIN`, `STAFF`, `DOCTOR` | Danh sách phiếu chỉ định cận lâm sàng (lọc theo loại xét nghiệm, trạng thái). |
| `/` | `POST` | `DOCTOR`, `ADMIN` | Bác sĩ tạo phiếu chỉ định cận lâm sàng cho ca khám. |
| `/:id` | `GET` | `ADMIN`, `STAFF`, `DOCTOR` | Xem chi tiết phiếu chỉ định. |
| `/:id/status` | `PATCH` | `STAFF`, `DOCTOR`, `ADMIN` | Cập nhật trạng thái xử lý phiếu (`PENDING` ➔ `PROCESSING` ➔ `COMPLETED`). |
| `/:id/results` | `POST` | `STAFF`, `DOCTOR`, `ADMIN` | Kỹ thuật viên nhập kết quả trị số xét nghiệm và kết luận sơ bộ. |
| `/results/:resultId/files` | `POST` | `STAFF`, `ADMIN` | Upload tệp đính kèm kết quả (ảnh DICOM, JPG, PDF) lên AWS S3. |
| `/results/files/:fileId/download` | `GET` | `DOCTOR`, `STAFF`, `ADMIN` | Sinh Pre-signed URL tải tệp y tế an toàn với thời hạn ngắn. |

---

## 9. Clinical Decision & AI Consultation (`ClinicalDecisionController`)
- **Prefix:** `/api/clinical-decisions`
- **Mô tả:** Bàn làm việc của Bác sĩ: tham vấn chẩn đoán AI đa mô hình và ký kết luận bệnh án bất biến.

| Endpoint | Method | Quyền | Mục đích |
|---|---|---|---|
| `/visits/:visitId/results` | `GET` | `DOCTOR`, `ADMIN` | Lấy toàn bộ kết quả cận lâm sàng đã có để chuẩn bị chẩn đoán. |
| `/visits/:visitId/history` | `GET` | `DOCTOR`, `ADMIN` | Xem lịch sử các lần khám và dị ứng thuốc trước đây của bệnh nhân. |
| `/visits/:visitId/ai-analysis` | `POST` | `DOCTOR`, `ADMIN` | Gửi dữ liệu lâm sàng sang AI Gateway (Claude/GPT/Gemini) nhận tư vấn chẩn đoán. |
| `/ai-diagnoses/:id/review` | `POST` | `DOCTOR`, `ADMIN` | Bác sĩ đánh giá (Accept / Reject / Modify) đề xuất của mô hình AI. |
| `/visits/:visitId/conclusion` | `POST` | `DOCTOR`, `ADMIN` | **Ký kết luận bệnh án chính thức** (Chẩn đoán ICD-10, phác đồ, đơn thuốc). |

---

## 10. Doctor Management (`DoctorController`)
- **Prefix:** `/api/doctors`
- **Mô tả:** Quản lý thông tin chuyên môn, chứng chỉ hành nghề và lịch làm việc của Bác sĩ.

| Endpoint | Method | Quyền | Mục đích |
|---|---|---|---|
| `/` | `GET` | `ADMIN`, `STAFF` | Danh sách bác sĩ trong bệnh viện (chuyên khoa, học hàm, phòng ban). |
| `/` | `POST` | `ADMIN` | Đăng ký hồ sơ bác sĩ mới (tạo đồng thời StaffProfile và User). |
| `/:id` | `GET` | `ADMIN`, `STAFF`, `DOCTOR` | Xem chi tiết hồ sơ bác sĩ và giấy phép hành nghề. |
| `/:id` | `PATCH` | `ADMIN` | Cập nhật chuyên khoa, số năm kinh nghiệm, học hàm/học vị. |
| `/:id/status` | `PATCH` | `ADMIN` | Kích hoạt / Tạm dừng hoạt động của bác sĩ. |

---

## 11. Staff Management (`StaffController`)
- **Prefix:** `/api/staffs`
- **Mô tả:** Quản lý hồ sơ nhân sự bệnh viện (điều dưỡng, kỹ thuật viên, hành chính).

| Endpoint | Method | Quyền | Mục đích |
|---|---|---|---|
| `/` | `GET` | `ADMIN` | Danh sách nhân viên bệnh viện với phân quyền chi tiết. |
| `/` | `POST` | `ADMIN` | Tuyển dụng / Tạo nhân sự mới kèm tài khoản đăng nhập. |
| `/:id` | `GET` | `ADMIN` | Xem chi tiết hồ sơ nhân sự, mã nhân viên, phòng ban trực thuộc. |
| `/:id` | `PATCH` | `ADMIN` | Cập nhật thông tin nhân viên, điều chuyển phòng ban. |
| `/:id/status` | `PATCH` | `ADMIN` | Cập nhật trạng thái làm việc của nhân viên (`ACTIVE`, `INACTIVE`). |

---

## 12. Department Management (`DepartmentController`)
- **Prefix:** `/api/departments`
- **Mô tả:** Quản lý cơ cấu tổ chức khoa phòng trong bệnh viện.

| Endpoint | Method | Quyền | Mục đích |
|---|---|---|---|
| `/` | `GET` | `ADMIN`, `STAFF`, `DOCTOR` | Danh sách tất cả các khoa phòng chức năng. |
| `/` | `POST` | `ADMIN` | Thành lập khoa/phòng ban mới (khoa Nội, Ngoại, Cấp cứu, Chẩn đoán hình ảnh,...). |
| `/:id` | `GET` | `ADMIN`, `STAFF`, `DOCTOR` | Xem chi tiết khoa, danh sách nhân sự và trưởng khoa. |
| `/:id` | `PATCH` | `ADMIN` | Cập nhật tên, mã phòng ban, mô tả nhiệm vụ. |
| `/:id/manager` | `POST` | `ADMIN` | Bổ nhiệm / Thay đổi Trưởng khoa phòng. |
| `/:id` | `DELETE` | `ADMIN` | Hủy / Ngừng hoạt động phòng ban. |

---

## 13. AI Model Registry (`AiModelController`)
- **Prefix:** `/api/ai-models`
- **Mô tả:** Quản trị đăng ký, cấu hình và giám sát hiệu năng các mô hình Trí tuệ nhân tạo y tế.

| Endpoint | Method | Quyền | Mục đích |
|---|---|---|---|
| `/` | `GET` | `ADMIN`, `DOCTOR` | Danh sách các mô hình AI đã đăng ký (nhà cung cấp, phiên bản, độ chính xác). |
| `/` | `POST` | `ADMIN` | Đăng ký mô hình AI mới vào hệ thống (OpenAI, Anthropic Claude, Google Gemini). |
| `/:id` | `GET` | `ADMIN`, `DOCTOR` | Xem thông số kỹ thuật, cấu hình endpoint và thông tin mô hình. |
| `/:id` | `PATCH` | `ADMIN` | Cập nhật API endpoint, phiên bản hoặc tham số nhiệt độ (temperature). |
| `/:id/status` | `PATCH` | `ADMIN` | Bật / Tắt trạng thái hoạt động của mô hình AI. |
| `/:id/stats` | `GET` | `ADMIN` | Thống kê số lượt tham vấn, tỷ lệ đồng thuận của bác sĩ và thời gian phản hồi. |
| `/:id/test` | `POST` | `ADMIN` | Kiểm tra kết nối trực tiếp đến nhà cung cấp AI. |

---

## 14. Notification (`NotificationController`)
- **Prefix:** `/api/notifications`
- **Mô tả:** Quản lý thông báo thời gian thực cho người dùng qua Web/Mobile.

| Endpoint | Method | Quyền | Mục đích |
|---|---|---|---|
| `/` | `GET` | Đã đăng nhập | Lấy danh sách thông báo của người dùng hiện tại. |
| `/:id/read` | `PATCH` | Đã đăng nhập | Đánh dấu một thông báo đã được đọc. |
| `/read-all` | `POST` | Đã đăng nhập | Đánh dấu tất cả thông báo là đã đọc. |

---

## 15. System Health (`AppController`)
- **Prefix:** `/api`
- **Mô tả:** Kiểm tra sức khỏe toàn bộ hệ thống (Health Check & Liveness Probe).

| Endpoint | Method | Quyền | Mục đích |
|---|---|---|---|
| `/health` | `GET` | Public | Kiểm tra kết nối CSDL PostgreSQL, Smart Contract RPC, IPFS Gateway và Redis. |
| `/version` | `GET` | Public | Xem phiên bản hiện tại của Backend và cấu hình môi trường. |