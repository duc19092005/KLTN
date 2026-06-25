Bạn là Senior Software Architect, Backend Lead, Mobile App Architect, Business Analyst Senior và chuyên gia phân tích hệ thống y tế.

Hãy đọc và phân tích thật kỹ toàn bộ source code/dự án được cung cấp.

## Bối cảnh dự án

Đây là hệ thống hỗ trợ khám chữa bệnh / bệnh viện / phòng khám. Hệ thống hiện có các vai trò như:

- Admin
- Doctor / Bác sĩ
- Reception / Lễ tân nếu có
- Verifier / Người xác minh nếu có
- Các module liên quan đến bệnh nhân, lịch khám, kết quả khám, chẩn đoán, đơn thuốc, xét nghiệm, hình ảnh y tế, AI hỗ trợ bác sĩ nếu có.

Tôi muốn nâng cấp hệ thống bằng cách thêm:

1. **Role Bệnh nhân**
2. **Tài khoản bệnh nhân**
3. **Mobile app cho bệnh nhân**
4. **Đăng nhập bằng số điện thoại + OTP**
5. **Bệnh nhân xem được thông tin cá nhân**
6. **Bệnh nhân xem được lịch sử từng lần khám**
7. **Bệnh nhân xem được chi tiết hồ sơ khám của từng lần khám**

---

# Nhiệm vụ của bạn

Hãy phân tích toàn bộ dự án hiện tại và đưa ra kế hoạch nâng cấp thật kỹ, bao gồm cả database, backend API, phân quyền, mobile app, bảo mật, flow nghiệp vụ và các lỗi có thể phát sinh.

Không được phân tích sơ sài. Hãy phân tích như một kiến trúc sư phần mềm đang review dự án thật trước khi triển khai production.

---

# Phần 1: Phân tích hiện trạng dự án

Hãy đọc toàn bộ source code và xác định:

## 1.1 Công nghệ đang dùng

Phân tích rõ dự án đang dùng:

- Frontend framework gì
- Backend framework gì
- Database gì
- ORM gì
- Auth hiện tại đang dùng gì
- Có JWT/session/cookie không
- Có role-based access control chưa
- Có bảng users/patients/accounts/roles không
- Có module khám bệnh chưa
- Có module lịch sử khám chưa
- Có API nào đang trả dữ liệu bệnh nhân không
- Có mobile app sẵn chưa hay cần tạo mới

## 1.2 Cấu trúc thư mục

Hãy mô tả cấu trúc thư mục hiện tại:

- Folder backend
- Folder frontend
- Folder database/schema
- Folder API/controller/service/repository
- Folder auth/middleware/guard
- Folder mobile nếu có
- Các file quan trọng cần sửa

## 1.3 Phân tích database hiện tại

Hãy tìm và phân tích các bảng/model/entity hiện có, đặc biệt là:

- User
- Role
- Patient
- Doctor
- Appointment
- MedicalRecord
- Prescription
- Diagnosis
- TestResult
- LabResult
- ImagingResult
- Visit / Encounter / Examination
- Phone / Email / Account
- OTP / VerificationCode nếu có

Với mỗi bảng liên quan, hãy nêu:

- Bảng này đang lưu gì
- Quan hệ với bảng khác
- Có đủ để hỗ trợ bệnh nhân login bằng SĐT chưa
- Có đủ để bệnh nhân xem lịch sử khám chưa
- Thiếu field nào
- Field nào nên thêm
- Quan hệ nào nên chỉnh

---

# Phần 2: Thiết kế Role Bệnh nhân

Hãy thiết kế thêm role **PATIENT** hoặc **BENH_NHAN** tùy theo convention của dự án.

## 2.1 Phân quyền bệnh nhân

Bệnh nhân chỉ được phép:

- Đăng nhập bằng số điện thoại
- Xem thông tin cá nhân của chính mình
- Xem danh sách các lần khám của chính mình
- Xem chi tiết từng lần khám của chính mình
- Xem chẩn đoán của chính mình nếu bác sĩ đã công bố
- Xem đơn thuốc của chính mình nếu có
- Xem kết quả xét nghiệm/hình ảnh nếu được phép
- Xem lịch hẹn nếu hệ thống có appointment
- Đăng xuất

Bệnh nhân không được phép:

- Xem hồ sơ bệnh nhân khác
- Xem dữ liệu bác sĩ/admin
- Sửa chẩn đoán
- Sửa đơn thuốc
- Xóa dữ liệu khám
- Truy cập API nội bộ của bác sĩ/admin
- Thay đổi role
- Tự tạo hồ sơ khám giả

## 2.2 Rule bảo mật bắt buộc

Khi bệnh nhân gọi API, backend phải kiểm tra:

- Token hợp lệ
- Role là PATIENT
- PatientId trong token phải khớp với dữ liệu đang truy vấn
- Không được tin patientId gửi từ client nếu có thể lấy từ token
- Không được cho bệnh nhân query tùy ý bằng ID của người khác
- Mọi API phải có guard/middleware phân quyền

---

# Phần 3: Thiết kế đăng nhập bằng SĐT + OTP

Thiết kế flow đăng nhập cho bệnh nhân bằng số điện thoại.

## 3.1 Flow tổng quát

Bước 1: Bệnh nhân nhập số điện thoại trên mobile app  
Bước 2: App gọi API gửi OTP  
Bước 3: Backend kiểm tra số điện thoại có tồn tại trong hồ sơ bệnh nhân không  
Bước 4: Nếu tồn tại, backend tạo OTP  
Bước 5: OTP được gửi về SMS  
Bước 6: Bệnh nhân nhập OTP  
Bước 7: App gọi API verify OTP  
Bước 8: Backend kiểm tra OTP đúng/sai/hết hạn  
Bước 9: Nếu đúng, backend cấp access token / refresh token  
Bước 10: App lưu token an toàn  
Bước 11: App gọi API lấy profile và lịch sử khám

## 3.2 API cần có

Hãy thiết kế đầy đủ API:

### Auth bệnh nhân

```http
POST /api/patient/auth/request-otp

Body:

{
  "phone": "090xxxxxxx"
}

Response thành công:

{
  "success": true,
  "message": "OTP đã được gửi"
}
POST /api/patient/auth/verify-otp

Body:

{
  "phone": "090xxxxxxx",
  "otp": "123456"
}

Response:

{
  "accessToken": "...",
  "refreshToken": "...",
  "patient": {
    "id": "...",
    "fullName": "...",
    "phone": "..."
  }
}
POST /api/patient/auth/refresh-token
POST /api/patient/auth/logout
Profile bệnh nhân
GET /api/patient/me

Trả về:

{
  "id": "...",
  "fullName": "...",
  "gender": "...",
  "dateOfBirth": "...",
  "phone": "...",
  "address": "...",
  "healthInsuranceCode": "...",
  "createdAt": "..."
}
Lịch sử khám
GET /api/patient/me/visits

Trả về danh sách các lần khám:

[
  {
    "visitId": "...",
    "visitDate": "...",
    "doctorName": "...",
    "departmentName": "...",
    "reason": "...",
    "status": "COMPLETED"
  }
]
Chi tiết một lần khám
GET /api/patient/me/visits/:visitId

Trả về:

{
  "visitId": "...",
  "visitDate": "...",
  "doctor": {
    "id": "...",
    "fullName": "...",
    "specialty": "..."
  },
  "department": "...",
  "reason": "...",
  "symptoms": "...",
  "diagnosis": "...",
  "conclusion": "...",
  "prescriptions": [
    {
      "medicineName": "...",
      "dosage": "...",
      "frequency": "...",
      "duration": "...",
      "note": "..."
    }
  ],
  "testResults": [
    {
      "name": "...",
      "result": "...",
      "unit": "...",
      "referenceRange": "...",
      "status": "NORMAL"
    }
  ],
  "attachments": [
    {
      "type": "PDF/IMAGE",
      "name": "...",
      "url": "..."
    }
  ]
}
Phần 4: Thiết kế database cần thêm/sửa

Hãy kiểm tra database hiện tại và đề xuất thay đổi phù hợp.

Nếu chưa có, hãy thiết kế thêm các bảng/model sau:

4.1 Role

Cần có role:

ADMIN
DOCTOR
RECEPTIONIST
VERIFIER
PATIENT
4.2 Patient Account

Nếu hệ thống đang tách User và Patient, hãy thiết kế liên kết:

User 1 - 1 Patient

hoặc:

Patient có phone và có thể login trực tiếp

Tùy kiến trúc hiện tại, hãy chọn phương án tốt nhất.

4.3 OTP Verification

Thiết kế bảng OTP:

OtpVerification
- id
- phone
- otpHash
- purpose
- expiresAt
- usedAt
- attempts
- maxAttempts
- createdAt
- ipAddress
- userAgent

Yêu cầu:

Không lưu OTP plain text
Chỉ lưu hash OTP
OTP hết hạn sau 3–5 phút
Giới hạn số lần nhập sai
Giới hạn gửi lại OTP
Không leak thông tin số điện thoại có tồn tại hay không nếu cần bảo mật
Có cleanup OTP cũ
4.4 Token / Session

Nếu dùng refresh token, thiết kế bảng:

RefreshToken
- id
- userId
- tokenHash
- deviceId
- expiresAt
- revokedAt
- createdAt
4.5 Medical Visit / Encounter

Nếu chưa có bảng lịch sử khám chuẩn, thiết kế:

MedicalVisit
- id
- patientId
- doctorId
- departmentId
- appointmentId
- visitDate
- reason
- symptoms
- diagnosis
- conclusion
- status
- publishedToPatient
- createdAt
- updatedAt

Trường quan trọng:

publishedToPatient: boolean

Dùng để kiểm soát hồ sơ nào bệnh nhân được xem.

Phần 5: Thiết kế mobile app cho bệnh nhân

Hãy thiết kế app mobile theo hướng thực tế.

5.1 Công nghệ đề xuất

Dựa trên project hiện tại, hãy đề xuất dùng một trong các công nghệ:

React Native
Flutter
Kotlin/Swift native
Expo nếu phù hợp

Phân tích lý do chọn.

5.2 Màn hình mobile cần có

Thiết kế các màn hình:

1. Splash Screen
Kiểm tra token
Nếu có token hợp lệ → vào Home
Nếu chưa có → vào Login
2. Login bằng số điện thoại

Fields:

Số điện thoại
Nút gửi OTP

Validation:

Không được rỗng
Đúng định dạng số điện thoại Việt Nam
Disable button khi đang gửi OTP
3. Verify OTP

Fields:

6 ô nhập OTP hoặc 1 input OTP
Countdown gửi lại OTP
Nút xác nhận

Validation:

OTP đủ 6 số
Báo lỗi nếu sai/hết hạn
Cho gửi lại sau thời gian quy định
4. Home

Hiển thị:

Xin chào tên bệnh nhân
Hồ sơ cá nhân
Lịch sử khám
Lịch hẹn nếu có
Đăng xuất
5. Profile

Hiển thị:

Họ tên
Ngày sinh
Giới tính
Số điện thoại
Địa chỉ
Mã BHYT nếu có
Thông tin liên hệ khẩn cấp nếu có
6. Lịch sử khám

Hiển thị danh sách từng lần khám:

Ngày khám
Khoa/phòng ban
Bác sĩ khám
Lý do khám
Trạng thái

Có filter:

Theo thời gian
Theo khoa
Theo trạng thái nếu cần
7. Chi tiết lần khám

Hiển thị:

Thông tin lần khám
Triệu chứng
Chẩn đoán
Kết luận
Đơn thuốc
Kết quả xét nghiệm
File đính kèm nếu có
Ghi chú bác sĩ nếu được phép hiển thị
8. Đơn thuốc

Hiển thị:

Tên thuốc
Liều dùng
Cách dùng
Thời gian dùng
Ghi chú
9. Kết quả xét nghiệm

Hiển thị:

Tên xét nghiệm
Kết quả
Chỉ số bình thường
Trạng thái bình thường/cao/thấp
File PDF nếu có
10. Cài đặt
Đăng xuất
Chính sách bảo mật
Điều khoản sử dụng
Phần 6: Backend cần sửa gì

Hãy chỉ rõ cần sửa/thêm những phần nào trong backend.

Ví dụ:

src/auth
src/patient
src/patient-auth
src/otp
src/medical-record
src/visit
src/common/guards
src/common/middleware
src/database/schema

Với mỗi phần, hãy nêu:

File nào cần tạo
File nào cần sửa
Logic chính là gì
API endpoint là gì
Guard/middleware nào cần dùng
DTO/request/response cần tạo gì
Service xử lý gì
Repository query gì
Phần 7: Frontend/Admin cần sửa gì

Nếu hệ thống có web admin/bác sĩ, hãy phân tích cần thêm gì:

7.1 Admin

Admin cần:

Tạo/sửa bệnh nhân
Gắn số điện thoại cho bệnh nhân
Quản lý tài khoản bệnh nhân
Khóa/mở tài khoản bệnh nhân
Reset số điện thoại nếu cần
Xem trạng thái tài khoản mobile
7.2 Bác sĩ

Bác sĩ cần:

Tạo hồ sơ khám
Cập nhật chẩn đoán
Kê đơn thuốc
Đính kèm kết quả
Chọn có công bố hồ sơ cho bệnh nhân hay không
7.3 Lễ tân

Lễ tân cần:

Tạo bệnh nhân
Cập nhật số điện thoại
Xác minh thông tin bệnh nhân
Tạo lịch hẹn/lượt khám nếu có
Phần 8: Bảo mật và quyền riêng tư y tế

Vì đây là dữ liệu y tế, hãy phân tích kỹ các vấn đề bảo mật:

Không lộ hồ sơ bệnh nhân khác
Không truyền patientId từ client nếu không cần
Token phải có thời hạn
Refresh token phải có revoke
OTP phải hash
OTP phải hết hạn
Rate limit gửi OTP
Rate limit verify OTP
Log audit khi bệnh nhân xem hồ sơ
Không log dữ liệu nhạy cảm
HTTPS bắt buộc
File kết quả khám phải có signed URL hoặc API bảo vệ
Mobile app không lưu thông tin nhạy cảm dạng plain text
Token nên lưu trong Secure Storage / Keychain / Keystore
Có cơ chế logout toàn bộ thiết bị nếu cần
Phần 9: Flow nghiệp vụ chi tiết

Hãy mô tả flow bằng text.

9.1 Flow tạo bệnh nhân
Lễ tân/Admin tạo hồ sơ bệnh nhân
→ Nhập họ tên, ngày sinh, giới tính, SĐT
→ Hệ thống kiểm tra trùng SĐT
→ Tạo Patient
→ Tạo User account role PATIENT nếu kiến trúc cần
→ Bệnh nhân có thể dùng SĐT để đăng nhập mobile
9.2 Flow bệnh nhân login mobile
Bệnh nhân nhập SĐT
→ Backend kiểm tra tồn tại
→ Tạo OTP
→ Gửi SMS
→ Bệnh nhân nhập OTP
→ Backend verify
→ Cấp token
→ Mobile vào Home
9.3 Flow xem lịch sử khám
Mobile gọi GET /api/patient/me/visits
→ Backend lấy patientId từ token
→ Query các lần khám của patientId đó
→ Chỉ trả hồ sơ được phép hiển thị
→ Mobile hiển thị danh sách
9.4 Flow xem chi tiết lần khám
Mobile gọi GET /api/patient/me/visits/:visitId
→ Backend lấy patientId từ token
→ Kiểm tra visitId có thuộc patientId không
→ Kiểm tra publishedToPatient
→ Trả dữ liệu chi tiết
Phần 10: Output tôi muốn nhận

Sau khi phân tích source code, hãy trả lời theo cấu trúc sau:

A. Tổng quan hiện trạng dự án
Công nghệ đang dùng
Auth hiện tại
Role hiện tại
Database hiện tại
Các module liên quan bệnh nhân
B. Vấn đề hiện tại

Liệt kê các điểm thiếu để hỗ trợ bệnh nhân mobile:

Thiếu role nào
Thiếu bảng nào
Thiếu API nào
Thiếu phân quyền nào
Thiếu dữ liệu nào
Thiếu bảo mật nào
C. Kiến trúc đề xuất

Vẽ bằng text:

Mobile App Patient
        |
        v
Patient Auth API
        |
        v
OTP Service ---- SMS Provider
        |
        v
Patient API
        |
        v
Medical Record / Visit Database
D. Database cần thêm/sửa

Trình bày dạng bảng:

Bảng	Thêm/Sửa	Mục đích
E. API cần thêm

Trình bày dạng bảng:

Method	Endpoint	Role	Chức năng
F. Mobile app cần tạo

Trình bày:

Màn hình
Chức năng
API dùng
State cần quản lý
G. File/folder cần tạo hoặc chỉnh

Trình bày rõ:

File/Folder	Hành động	Nội dung
H. Phân quyền chi tiết

Trình bày role PATIENT được phép gì và không được phép gì.

I. Bảo mật

Phân tích kỹ OTP, token, rate limit, bảo vệ dữ liệu y tế.

J. Kế hoạch triển khai theo từng phase

Chia thành các phase:

Phase 1: Phân tích database và role
Kiểm tra User/Role/Patient
Thêm role PATIENT
Liên kết Patient với User nếu cần
Phase 2: OTP Auth
API request OTP
API verify OTP
JWT/refresh token
Rate limit
Phase 3: Patient API
GET profile
GET visit history
GET visit detail
GET prescriptions
GET test results
Phase 4: Mobile app
Login phone
Verify OTP
Home
Profile
Visit history
Visit detail
Phase 5: Admin/Doctor update
Gắn phone cho bệnh nhân
Publish hồ sơ khám cho bệnh nhân
Kiểm soát quyền xem
Phase 6: Testing & Security
Test phân quyền
Test IDOR
Test OTP brute force
Test token expired
Test bệnh nhân không xem được hồ sơ người khác
K. Test case bắt buộc

Viết test case cho:

Bệnh nhân login đúng OTP
Bệnh nhân nhập sai OTP
OTP hết hạn
Gửi OTP quá nhiều lần
Bệnh nhân xem profile của mình
Bệnh nhân cố xem profile người khác
Bệnh nhân xem lịch sử khám của mình
Bệnh nhân cố xem visitId của người khác
Hồ sơ chưa publish thì không được xem
Token hết hạn
Logout
L. Kết luận

Cuối cùng hãy kết luận:

Cách làm tốt nhất
Rủi ro lớn nhất
Những file nên sửa trước
Thứ tự triển khai tối ưu
Những điểm tuyệt đối không được làm sai