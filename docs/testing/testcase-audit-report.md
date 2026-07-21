# BÁO CÁO ĐÁNH GIÁ MANUAL TESTCASE

> [!IMPORTANT]
> Phạm vi đánh giá là source hiện tại trong `apps/hospital-api/`, `apps/hospital-web/`, `apps/hospital-mobile/`,
> `apps/audit-contracts/` và toàn bộ 7 sheet của `_4.1 ManualTestV1.xlsx`.
> Workbook gốc không bị ghi đè trong quá trình audit này.

## 1. Executive Summary — Sau khi chuẩn hóa

| Chỉ số | Trước chuẩn hóa | Sau chuẩn hóa |
|---|---:|---:|
| Tổng số sheet | 7 | 13 |
| Tổng số testcase | 276 | 331 |
| Function có mô tả và liên kết | 5 nhóm lớn | 21 function cụ thể |
| Test scenario | 82 | 125 |
| Test Case ID trùng | 0 | 0 |
| Testcase thiếu mô tả, điều kiện, bước hoặc kết quả mong đợi | 0 | 0 |
| Function không có scenario | Chưa kiểm tra đầy đủ | 0 |
| Scenario trỏ tới function không tồn tại | Chưa kiểm tra đầy đủ | 0 |
| Link nội bộ không có đích | Link dạng chữ | 0; đã dùng hyperlink thật |
| Scenario thuộc chức năng Critical đã rà soát | Chưa tách riêng | 64 |

**Kết luận sau chuẩn hóa:** Workbook đã được mở rộng từ bộ testcase tập trung vào
CRUD Admin và quy trình khám chính thành bộ tài liệu gồm 13 sheet. Các phần mới bao
gồm xác thực nhân viên, cổng thông tin bệnh nhân, bảo vệ hồ sơ y tế, dữ liệu đã xóa,
audit và blockchain, thông báo và thông tin cá nhân.

Các mô tả mới ưu tiên ngôn ngữ nghiệp vụ: nêu rõ người dùng làm gì, hệ thống hiển thị
gì và dữ liệu nào được tạo, giữ nguyên hoặc bị từ chối. Những cụm mơ hồ như
“Backend từ chối”, “lỗi phù hợp” và “nếu hệ thống hỗ trợ” đã được loại khỏi nhóm nội
dung được rà soát.

> [!IMPORTANT]
> 331 testcase là số testcase **đã được lập tài liệu**, không có nghĩa là 331 testcase
> đã chạy thành công. Muốn kết luận hệ thống đạt yêu cầu, đội kiểm thử vẫn phải thực
> hiện từng testcase trên môi trường kiểm thử và ghi Actual Result/Pass/Fail.

> [!NOTE]
> Bản trước khi mở rộng được giữ tại `_4.1 ManualTestV1.before-expansion.xlsx` để có
> thể đối chiếu hoặc khôi phục khi cần.

### Kết quả kiểm tra cuối workbook

- Workbook mở và đọc được bằng `openpyxl`.
- SHA-256 bản đã chuẩn hóa: `1cdb481b7bc5ce20978333d67c829ebbf53d74cf3548a60aec74e9048f322a7e`.
- Không có Test Case ID trùng.
- Không có testcase thiếu trường nội dung bắt buộc.
- Không có function bị bỏ mà không có scenario.
- Không có scenario tham chiếu function không tồn tại.
- Không có hyperlink FunctionList/Test scenario bị mất đích.
- Tất cả 13 sheet có cố định hàng tiêu đề và bộ lọc dữ liệu.

---

## 2. Bảng điểm chi tiết

| Tiêu chí | Tối đa | Đạt | Lý do | Bằng chứng |
|---|---:|---:|---|---|
| Coverage chức năng | 25 | 15 | Bao phủ CRUD admin và clinical flow, thiếu nhiều module hệ thống | `AppRoutes.jsx`; 17 backend module; workbook chỉ có 5 testcase sheet nghiệp vụ |
| Business flow/state | 15 | 12 | Flow Visit khá đầy đủ, thiếu concurrency và một số chuyển lùi | `visit-transition.policy.ts:L10-L43`; sheet `Quy trình khám bệnh` |
| Negative/boundary | 15 | 10 | Có validation form tốt, thiếu timeout, retry, ID invalid, double submit | 164/276 testcase không có test data riêng |
| Authentication/authorization | 10 | 3 | Gần như không có coverage web auth, face, ownership, IDOR | `auth.controller.ts`; `ProtectedRoute` trong `AppRoutes.jsx` |
| Chất lượng testcase | 15 | 12 | ID duy nhất, pre-condition và expected đủ; một số expected có “hoặc” | Workbook: 0 duplicate ID, 0 missing expected |
| Data integrity/integration | 10 | 8 | Có CLS, conclusion, blockchain; thiếu rollback/concurrency sâu | `create-medical-conclusion.use-case.ts:L31-L74` |
| Tổ chức/bảo trì | 10 | 8 | Mapping scenario tốt; FunctionList còn quá thô, link là text | `FunctionList` chỉ 5 function cho 58 sub-function |
| **Tổng** | **100** | **68** |  |  |

---

## 3. Feature Inventory

| Module | Actor/Role | Chức năng cụ thể | Luồng/API/Page | Source evidence | Mức quan trọng |
|---|---|---|---|---|---|
| Staff authentication | Staff roles | Login, refresh/me, logout | `/auth/*` | `apps/hospital-api/src/modules/auth/controllers/auth.controller.ts` | Critical |
| First login | Staff roles | Đăng ký khuôn mặt trước đổi mật khẩu | `/authenticate`, `/change-password` | `apps/hospital-web/src/routes/AppRoutes.jsx`; `auth.controller.ts` | Critical |
| Face authentication | Staff roles | Face verify, liveness, step-up, secret | `/auth/face-*`, `/auth/generate-secret` | `auth.controller.ts` | Critical |
| Forgot password | Staff roles | Challenge → face verify → reset | `/auth/forgot-password/*` | `auth.controller.ts:L260-L293` | High |
| Patient authentication | Patient | OTP request/resend/verify, password login/change | `/patient/auth/*` | `patient-auth.controller.ts:L13-L40` | Critical |
| Patient profile | Patient | Danh sách/tạo/xem hồ sơ liên kết | `/patient/me/profiles*` | `patient-portal.controller.ts:L26-L38` | Critical |
| Patient medical history | Patient | Danh sách visit, chi tiết visit, download file | `/patient/me/profiles/:id/visits*` | `patient-portal.controller.ts:L44-L60` | Critical |
| Appointment | Patient | Chuyên khoa, bác sĩ, slot, tạo/list/hủy/QR | `/patient/me/booking*`, `/appointments*` | `patient-portal.controller.ts:L70-L106` | Critical |
| Appointment check-in | Admin/Receptionist | Verify QR và check-in | `/appointments/qr/verify`, `/check-in` | `patient-portal.controller.ts:L112-L118` | Critical |
| Patient management | Receptionist/Admin | Tạo, tìm, xem, sửa bệnh nhân | `/patients` | `patient.controller.ts` | Critical |
| Public verification | Public | Xác minh bệnh nhân/kết luận | `/patient-verify/*` | `patient-verify.controller.ts:L15-L24` | High |
| Visit | Receptionist/Doctor | Tạo/list/gợi ý đơn vị/chuyển trạng thái | `/visits*` | `visit.controller.ts`; `visit-transition.policy.ts` | Critical |
| Medical order | Doctor | Tạo chỉ định | `POST /medical-orders` | `medical-order.controller.ts:L22-L23` | Critical |
| Medical result | Lab manager | Tiếp nhận, upload file, trả kết quả | `/medical-orders/:id/*` | `medical-order.controller.ts:L40-L53` | Critical |
| Clinical decision | Doctor | Xem kết quả, AI, review, conclusion | `/clinical-decisions/*` | `clinical-decision.controller.ts:L19-L38` | Critical |
| Department | Admin | CRUD, manager, audit/verify | `/departments*` | `department.controller.ts:L19-L68` | High |
| Staff | Admin | CRUD, lock/unlock, avatar, audit | `/staff*` | `staff.controller.ts:L23-L90` | High |
| Doctor | Admin | CRUD, avatar, audit/verify | `/doctors*` | `doctor.controller.ts:L22-L91` | High |
| AI model | Admin/Doctor | CRUD/hide/restore/test/rate/stats | `/ai-models*` | `ai-model.controller.ts:L14-L97` | High |
| Deleted records | Admin | Xem và restore soft-deleted entity | `/admin/deleted-records` | `DeletedRecordsPage.jsx:L85-L138` | High |
| Audit dashboard | Admin | Logs, chain verify, batches, proof, anchor now | `/audit/*` | `audit.controller.ts:L28-L166`; `AuditLogsPage.jsx` | Critical |
| Notification | Staff roles | List, unread count, read/read-all/delete | `/notifications*` | `notification.controller.ts:L22-L60` | Medium |
| Profile | Staff roles | Xem hồ sơ/wallet/audit-related details | `/profile` | `ProfilePage.jsx:L43-L243` | Medium |
| AuditAnchor contract | Relayer/owner | Commit root và verify Merkle proof | `commitRoot`, `verifyProof` | `AuditAnchor.sol:L15-L104` | Critical |
| FaceRegistry contract | Relayer/owner | Set/remove/get face hash | `setFaceHash`, `removeFaceHash` | `FaceRegistry.sol:L27-L85` | Critical |

> [!NOTE]
> `Department` được đánh giá là đơn vị vận hành, không phải doctor specialty. Booking
> specialty lấy từ doctor profile/API booking, đúng với domain rule hiện tại.

---

## 4. Traceability Matrix

| Feature ID | Module | Actor | Chức năng từ source | Testcase hiện có | Bao phủ | Thiếu chính |
|---|---|---|---|---|---|---|
| AU-01 | Staff auth | Staff | Login/logout/me | Không có sheet auth | Not Covered | Sai mật khẩu, lock, token, logout reuse |
| AU-02 | Face auth | Staff | Enroll/verify/liveness/step-up | Không có | Not Covered | Spoof, retry, lockout, chain failure |
| AU-03 | Forgot password | Staff | Face challenge/reset | Không có | Not Covered | Challenge expiry, wrong face, reuse token |
| PA-01 | Patient auth | Patient | OTP/password | Chỉ precondition đăng nhập | Partially Covered | OTP expiry/cooldown/ownership/token |
| PP-01 | Patient profile | Patient | Create/list/profile | `TC1.11.*` | Partially Covered | Ownership/IDOR, duplicate identity, API errors |
| PP-02 | Patient history | Patient | Visit history/detail/files | Không có | Not Covered | Linked profile isolation, file ownership |
| AP-01 | Booking | Patient | Specialty/doctor/slot/create/list/QR/cancel | `S1.1–S1.10` | Partially Covered | Race slot, double submit, ownership, network retry |
| AP-02 | QR check-in | Receptionist | Verify/check-in | Một số flow check-in | Partially Covered | Invalid/expired/reused QR, wrong role |
| PT-01 | Patient CRUD | Receptionist | Search/create/update | `S1.12–S1.14` | Partially Covered | Update, conflict, pagination, IDOR |
| VS-01 | Visit | Receptionist/Doctor | Create/list/status | `S1.15` và clinical flow | Covered | Concurrent transition vẫn thiếu |
| MO-01 | Medical order | Doctor | Create order | `S1.20–S1.27` | Partially Covered | Ownership, duplicate submit, API rollback |
| MR-01 | Medical result | Lab | Receive/upload/create result | `S1.28–S1.32` | Partially Covered | File malware/signature, multi-user concurrency |
| CD-01 | Conclusion | Doctor | Results/AI/review/conclusion | `S1.33–S1.40` | Partially Covered | AI review endpoint, ownership/IDOR sâu |
| DP-01 | Department | Admin | CRUD/manager/audit | Sheet `Phòng Ban` | Partially Covered | Manager endpoint, RBAC, audit failure |
| ST-01 | Staff | Admin | CRUD/lock/unlock/audit | Sheet `Nhân sự` | Partially Covered | Lock/unlock API, audit verify, role denial |
| DR-01 | Doctor | Admin | CRUD/audit | Sheet `Bác sĩ` | Partially Covered | Audit/verify, doctor read access, IDOR |
| AI-01 | AI model | Admin/Doctor | CRUD/test/hide/restore/rate/stats | Sheet `Mô hình AI` + AI flow | Partially Covered | Stats, doctor list/detail, invalid rating |
| DL-01 | Deleted records | Admin | List/restore | Không có | Not Covered | Restore conflict, pagination, role denial |
| AD-01 | Audit | Admin | Logs/verify/batches/proof/anchor | Blockchain conclusion cases | Partially Covered | UI filters, proof invalid, anchor retry |
| NT-01 | Notification | Staff | List/read/delete | Không có | Not Covered | Ownership, unread count, pagination |
| PF-01 | Profile | Staff | Profile page | Không có | Not Covered | Loading/error/role consistency |
| BC-01 | AuditAnchor | Relayer/owner | Commit/verify | Chỉ expected conclusion | Partially Covered | Unauthorized writer, duplicate batch, invalid proof |
| BC-02 | FaceRegistry | Relayer/owner | Face hash lifecycle | Không có | Not Covered | Unauthorized writer, remove missing key |

### Coverage calculations

- Feature Coverage: `22 / 58 = 37.9%` chức năng có coverage hợp lệ ở mức tối thiểu.
- Critical Feature Coverage: `9 / 14 = 64.3%`.
- Negative Coverage: khoảng `25 / 58 = 43.1%`.
- Role/authorization Coverage: khoảng `8 / 28 = 28.6%` các cặp role-action quan trọng.
- State Transition Coverage: `6 / 9 = 66.7%` chuyển trạng thái Visit hợp lệ/không hợp lệ.

Không tính happy path đơn lẻ là Covered hoàn toàn.

---

## 5. Các điểm làm tốt

1. **ID duy nhất:** 276 testcase được nhận diện, không có `Test Case #` trùng.
2. **Pre-condition tốt:** không có testcase thiếu pre-condition.
3. **Expected Result hiện diện đầy đủ:** không có testcase thiếu hoàn toàn expected.
4. **Clinical flow có thứ tự nghiệp vụ rõ:** booking → intake → doctor → LAB → doctor conclusion.
5. **Visit state machine được phản ánh:** WAITING → IN_PROGRESS → WAITING_TEST_RESULT →
   WAITING_CONCLUSION → COMPLETED, tương thích `visit-transition.policy.ts:L10-L13`.
6. **Blockchain boundary đúng:** testcase yêu cầu chỉ hash/timestamp/metadata lên chain,
   không lưu PII, diagnosis text hoặc file.
7. **Medical result upload có validation thực tế:** PDF/JPG/PNG/WEBP và 10 MB/tệp,
   phù hợp UI `LabOrdersPage.jsx:L193-L203`, `L259-L278`.
8. **CRUD admin có validation chi tiết:** các sheet Phòng Ban, Nhân sự, Bác sĩ, Mô hình AI
   có nhiều testcase trường bắt buộc và format.
9. **Cell merge theo testcase:** các step nhiều dòng dễ đọc và giữ được context.
10. **Traceability IDs đã nhất quán:** scenario/testcase mapping không bị duplicate.

---

## 6. Các vấn đề cần cải thiện

| Issue ID | Test Case ID | Vấn đề | Mức độ | Vì sao chưa đạt | Cách cải thiện |
|---|---|---|---|---|---|
| I-01 | N/A | Không có testcase staff auth/face auth | Critical | Đây là cổng bảo vệ mọi role web | Tạo sheet Authentication hoặc đưa vào flow riêng |
| I-02 | N/A | Không test patient OTP | Critical | OTP 5 phút/cooldown 60 giây là security boundary | Thêm expiry, resend, brute force, token cases |
| I-03 | N/A | Không test patient history ownership | Critical | Có API profile/visit/file theo ID | Thêm IDOR cho profileId, visitId, fileId |
| I-04 | N/A | Không test Audit dashboard | High | Admin có logs, proof, batch, chain verify, anchor now | Thêm functional + chain failure cases |
| I-05 | N/A | Không test Deleted Records/restore | High | UI và restore API tồn tại | Thêm restore success/conflict/role denial |
| I-06 | nhiều TC | Data Test Example trống | Medium | 164/276 testcase thiếu dữ liệu cụ thể | Điền ID, input, file, status và account cụ thể |
| I-07 | TC1.10.* | Expected hủy lịch có điều kiện “nếu UI hỗ trợ” | High | Source hiện có DELETE appointment, testcase phải xác định hành vi | Viết theo API/mobile thực tế, không dùng “nếu” |
| I-08 | TC1.40.* | Blockchain expected chưa có tx status/anchor evidence | High | Chỉ nói audit chung | Kiểm tra batch/root/txHash hoặc trạng thái retry cụ thể |
| I-09 | nhiều TC | Không kiểm tra HTTP status/response khi test API trực tiếp | Medium | Khó phân biệt validation và server error | Ghi 400/401/403/404/409 khi có thể quan sát |
| I-10 | N/A | FunctionList chỉ có 5 function lớn | Medium | Không đủ trace tới 58 sub-function | Tách Function ID theo chức năng nguồn |
| I-11 | Link columns | Link chỉ là text `'Sheet'!A1` | Low | Không phải hyperlink/formula điều hướng | Dùng hyperlink nội bộ hoặc công thức HYPERLINK |
| I-12 | N/A | Không test notification/profile | Medium | Route/page và API tồn tại | Bổ sung list/read/delete/profile loading/error |
| I-13 | nhiều TC | Thiếu double click/concurrency | High | Slot/order/status có thể race | Thêm hai user hoặc request đồng thời |
| I-14 | N/A | Không test relayer/owner contract permissions | Critical | Contract dùng `onlyWriter` | Thêm unauthorized writer/invalid proof/duplicate batch |

---

## 7. Danh sách testcase còn thiếu

| Gap ID | Priority | Severity | Module | Actor | Testcase cần bổ sung | Pre-condition | Test data | Expected Result | Source evidence |
|---|---|---|---|---|---|---|---|---|---|
| GAP-001 | P0 | Critical | Patient portal | Patient | Truy cập visit của profile không liên kết | Token patient A hợp lệ | patientId của B | HTTP 403/404; không trả PII/medical data | `patient-portal.controller.ts:L43-L60` |
| GAP-002 | P0 | Critical | Medical files | Patient | Tải file kết quả của bệnh nhân khác | Token A, fileId B | UUID hợp lệ của B | Từ chối; không trả signed URL | `patient-portal.controller.ts:L59-L60` |
| GAP-003 | P0 | Critical | Conclusion | Doctor | Doctor A kết luận visit của Doctor B | Hai doctor, visit thuộc B | visitId B | Từ chối; không tạo conclusion/anchor | `create-medical-conclusion.use-case.ts:L32-L41` |
| GAP-004 | P0 | Critical | Medical order | Doctor | Doctor tạo order cho visit không sở hữu | Visit doctor khác | visitId | HTTP 400/403; không tạo order | `medical-order.controller.ts:L22-L23` |
| GAP-005 | P0 | Critical | Audit contract | Wallet khác | Gọi `commitRoot` không phải writer | Contract deployed | random wallet | Revert; root không thay đổi | `AuditAnchor.sol:L56-L76` |
| GAP-006 | P0 | Critical | Face registry | Wallet khác | Gọi set/remove face hash trái phép | Contract deployed | key/value bytes32 | Revert; record không đổi | `FaceRegistry.sol:L58-L75` |
| GAP-007 | P0 | Critical | Staff auth | Any staff | Dùng lại access token sau logout | Login rồi logout | old token | 401; endpoint bảo vệ không trả dữ liệu | `auth.controller.ts:L237` |
| GAP-008 | P0 | High | QR check-in | Receptionist | Dùng QR đã check-in lần hai | Appointment checked-in | same QR | Từ chối idempotent/conflict; không tạo Visit thứ hai | `patient-portal.controller.ts:L112-L118` |
| GAP-009 | P0 | High | Booking | Patient | Hai request đặt cùng slot đồng thời | Một slot còn 1 chỗ | same doctor/time | Chỉ một lịch thành công; request còn lại conflict | `patient-portal.controller.ts:L82-L88` |
| GAP-010 | P0 | High | Audit | Admin | Anchor transaction thất bại sau khi kết luận | RPC unavailable | valid conclusion | Không tạo dữ liệu mâu thuẫn; có trạng thái retry/audit rõ | `create-medical-conclusion.use-case.ts:L55-L72` |
| GAP-011 | P1 | High | OTP | Patient | OTP hết hạn sau 5 phút | Đã request OTP | expired OTP | Verify thất bại; không cấp JWT | `patient-auth.controller.ts:L17-L27` |
| GAP-012 | P1 | High | OTP | Patient | Resend trước 60 giây | OTP vừa gửi | same phone | Từ chối/cooldown; không gửi OTP mới | `patient-auth.controller.ts:L22` |
| GAP-013 | P1 | High | Face auth | Staff | Liveness thất bại/spoof | Account active | ảnh tĩnh | Không verified; không cấp secret/token | `auth.controller.ts` face routes |
| GAP-014 | P1 | High | Forgot password | Staff | Challenge token hết hạn/reuse | Challenge cũ | token expired | Từ chối reset; password giữ nguyên | `auth.controller.ts:L260-L293` |
| GAP-015 | P1 | High | Visit | Doctor | Chuyển WAITING thẳng COMPLETED | Visit WAITING | COMPLETED | Từ chối transition | `visit-transition.policy.ts:L10-L43` |
| GAP-016 | P1 | High | Visit | Two users | Doctor và receptionist cập nhật cùng visit | Visit WAITING | concurrent requests | Một transition hợp lệ; không lost update | `visit.controller.ts:L37` |
| GAP-017 | P1 | High | Result | Lab manager | Trả kết quả hai lần đồng thời | Order IN_PROGRESS | two submissions | Một result; request còn lại conflict/idempotent | `medical-order.controller.ts:L47-L53` |
| GAP-018 | P1 | High | Deleted records | Admin | Restore entity có unique key đã được tái sử dụng | Soft-deleted record | duplicate code/email | Conflict rõ; không restore nửa chừng | `DeletedRecordsPage.jsx:L99-L138` |
| GAP-019 | P1 | High | Audit UI | Admin | Verify chain phát hiện hash mismatch | Audit record tampered fixture | seq/hash | UI hiển thị failed, bằng chứng cụ thể | `audit.controller.ts:L102-L160` |
| GAP-020 | P1 | High | AI review | Doctor | Review AI diagnosis thuộc visit khác | AI diagnosis của B | diagnosisId | Từ chối; review không đổi | `clinical-decision.controller.ts:L31-L32` |
| GAP-021 | P1 | Medium | Notification | Staff | Xóa notification của user khác | Token A | notificationId B | 403/404; notification B giữ nguyên | `notification.controller.ts:L54-L60` |
| GAP-022 | P2 | Medium | Upload | Lab manager | File có extension hợp lệ nhưng MIME sai | Order IN_PROGRESS | `.pdf` chứa binary khác | Backend từ chối; không lưu metadata | `medical-order.controller.ts:L53` |
| GAP-023 | P2 | Medium | Lists | Admin | Pagination đầu/giữa/cuối | >2 trang dữ liệu | page/limit | Đúng items/total/page, không lặp | list controllers + Pagination UI |
| GAP-024 | P2 | Medium | UI | All roles | Double click nút submit | Form hợp lệ | double click | Nút disabled; một record/request | Các button `submitting` |
| GAP-025 | P2 | Medium | Mobile | Patient | Mất mạng khi đặt lịch và retry | Offline sau confirm | valid payload | Không báo thành công giả; retry không tạo trùng | `PatientPortalScreen.tsx` |

---

## 8. Top 20 testcase cần bổ sung gấp

Theo thứ tự ưu tiên: `GAP-001`, `GAP-002`, `GAP-003`, `GAP-005`, `GAP-006`,
`GAP-007`, `GAP-008`, `GAP-009`, `GAP-010`, `GAP-004`, `GAP-011`,
`GAP-012`, `GAP-013`, `GAP-014`, `GAP-015`, `GAP-016`, `GAP-017`,
`GAP-018`, `GAP-019`, `GAP-020`.

Các gap này ưu tiên ownership, phân quyền, dữ liệu y tế, state machine, duplicate
submission và tính toàn vẹn audit — đều có khả năng gây sai dữ liệu hoặc lộ dữ liệu.

---

## 9. Testcase trùng hoặc có thể gộp

| Nhóm | Mức tương đồng | Đề xuất |
|---|---:|---|
| Các case mở popup trong Phòng Ban/Nhân sự/Bác sĩ/AI | 70% | Giữ riêng do module khác, chuẩn hóa wording thay vì gộp |
| Các case search không kết quả ở nhiều sheet | 80% | Giữ riêng, dùng template chung |
| Validate file JPG/PNG/WEBP | 75% | Có thể parameterize trong một testcase nếu expected giống hệt |
| Các case bỏ trống từng trường | 60% | Không gộp nếu backend trả message riêng; có thể dùng bảng dữ liệu |
| Blockchain “ghi audit” và “không lưu raw PII” | 55% | Không gộp: một case integrity, một case privacy |
| AI failure và AI optional | 40% | Không gộp vì mục tiêu khác nhau |

Không phát hiện duplicate ID. Việc lặp cấu trúc step không tự động được coi là duplicate coverage.

---

## 10. Testcase không khớp source code hoặc cần xác minh

| Test Case ID/nhóm | Nội dung | Source hiện tại | Kết luận |
|---|---|---|---|
| `TC1.10.*` | Hủy lịch mô tả điều kiện “nếu UI hỗ trợ” | Có `DELETE /patient/me/appointments/:id` | Testcase phải viết dứt khoát theo UI/API hiện tại |
| Một số CLS status | Dùng nhãn “Đã trả KQ” | UI `LabOrdersPage` dùng “Có kết quả” | Đổi nhãn Expected Result |
| Blockchain failure | Có thể “rollback hoặc hiển thị lỗi” | Anchor change nằm callback transaction; immediate trigger sau commit | Không dùng “hoặc”; tách enqueue và immediate anchor failure |
| File storage wording cũ | Có thể nhắc Cloudinary | Canonical hiện tại dùng S3 private; legacy URL chỉ đọc | Expected phải nói signed URL/private S3 |
| Specialty/phòng ban | Một số mô tả dễ lẫn | Specialty từ doctor profile, Department là đơn vị vận hành | Không dùng Department làm danh sách specialty |
| FunctionList F1.1 | Gộp toàn bộ end-to-end thành một function | Source có nhiều sub-function/API | Traceability quá thô, cần tách function |
| AI model name sample | Tên model có thể không tồn tại | Model lấy từ cấu hình hiện tại | Dùng model seed hiện hành hoặc mô tả “model ACTIVE” |
| HTTP error expected | Nhiều case chỉ ghi “hiển thị lỗi phù hợp” | Backend có exception cụ thể | Ghi message/status cụ thể theo endpoint |

---

## 11. Mẫu testcase được viết lại

| Scenario # | Scenario | Test Case # | Test Case Description | Pre-condition | Steps | Data | Expected Result |
|---|---|---|---|---|---|---|---|
| S-AUTH-01 | Staff logout | TC-AUTH-001 | Token cũ không dùng được sau logout | Staff login hợp lệ | 1. Login; 2. Lưu token; 3. POST logout; 4. GET `/auth/me` bằng token cũ | ADMIN active | Logout thành công; request bước 4 trả 401; không trả profile |
| S-OTP-01 | OTP expiry | TC-OTP-001 | Không xác thực OTP quá 5 phút | OTP đã gửi | 1. Request OTP; 2. Chờ/giả lập >5 phút; 3. Verify | phone hợp lệ, OTP cũ | Không cấp JWT; hiển thị OTP hết hạn; profile không được trả |
| S-BOOK-01 | Slot concurrency | TC-BOOK-001 | Hai bệnh nhân đặt slot cuối | Slot capacity=1 | 1. Chuẩn bị 2 token; 2. Gửi đồng thời create appointment | same doctor/scheduledAt | Chỉ một appointment được tạo; request còn lại conflict; capacity không âm |
| S-QR-01 | QR reuse | TC-QR-001 | Không check-in QR lần hai | Appointment đã check-in | 1. Verify QR; 2. Check-in lại | same QR payload | Không tạo Visit thứ hai; trả conflict/idempotent response rõ |
| S-IDOR-01 | Patient history | TC-IDOR-001 | Patient A không xem visit B | Hai patient token/profile | 1. Login A; 2. GET visit của B | patientId B, visitId B | 403/404; response không chứa PII, diagnosis hoặc file metadata |
| S-VISIT-01 | Invalid transition | TC-VISIT-001 | Chặn WAITING → COMPLETED | Visit WAITING | 1. PATCH status COMPLETED | visitId hợp lệ | 400; Visit vẫn WAITING; không tạo conclusion/audit completion |
| S-ORDER-01 | Doctor ownership | TC-ORDER-001 | Doctor không tạo order cho visit khác | Visit thuộc doctor B | 1. Login A; 2. POST order cho visit B | LAB_TEST | 403/400; không tạo MedicalOrder; visit không đổi |
| S-RESULT-01 | Duplicate result | TC-RESULT-001 | Hai lần trả kết quả cùng order | Order IN_PROGRESS | 1. Upload file; 2. Submit result hai request đồng thời | PDF hợp lệ | Chỉ một MedicalResult; trạng thái RESULT_READY; request còn lại conflict |
| S-CONCLUSION-01 | Pending order | TC-CON-001 | Không kết luận khi còn order pending | Visit WAITING_TEST_RESULT | 1. Login doctor owner; 2. POST conclusion | finalDiagnosis hợp lệ | 400 với số phiếu pending; không tạo conclusion; visit giữ trạng thái |
| S-CHAIN-01 | Unauthorized anchor | TC-CHAIN-001 | Wallet lạ không commit root | AuditAnchor deployed | 1. Connect random wallet; 2. commitRoot | batchId/root/leafCount | Transaction revert; checkpoint không tồn tại; không phát event commit |
| S-AUDIT-01 | Invalid proof | TC-AUDIT-001 | Verify proof sai | Batch đã anchored | 1. GET proof; 2. thay sibling; 3. verify | tampered proof | Verify false/failed; UI cảnh báo integrity; không sửa log |
| S-RESTORE-01 | Restore conflict | TC-RESTORE-001 | Không restore khi unique key bị dùng lại | Record soft-delete; key đã tái sử dụng | 1. Open trash; 2. Restore | departmentCode/email duplicate | Conflict rõ; record vẫn deleted; bản ghi hiện hành không đổi |

---

## 12. Kế hoạch cải thiện

### Giai đoạn 1 — Sửa testcase sai/không thể thực hiện

- Loại tất cả Expected Result chứa “hoặc”, “nếu hệ thống hỗ trợ”, “lỗi phù hợp”.
- Đồng bộ nhãn trạng thái UI hiện tại.
- Chuyển link text thành hyperlink nội bộ thật.
- Điền Data Test Example cho 164 testcase còn trống khi testcase cần input.

### Giai đoạn 2 — Bổ sung P0/P1

- Authentication, OTP, face verification, ownership/IDOR.
- Slot concurrency, QR reuse, duplicate medical result.
- Doctor ownership và state transition bất hợp lệ.
- Blockchain writer permission và audit inconsistency.

### Giai đoạn 3 — Validation/boundary/error handling

- ID invalid/nonexistent, 400/401/403/404/409/500.
- Timeout/offline/retry/double-click.
- Pagination/filter combination và upload MIME mismatch.

### Giai đoạn 4 — Chuẩn hóa tổ chức

- Tách FunctionList thành function nhỏ theo API/use-case.
- Mỗi Test Scenario ánh xạ một mục tiêu; parameterize case cùng logic.
- Chuẩn hóa ID theo module: `TC-AUTH-*`, `TC-BOOK-*`, `TC-VISIT-*`.

### Giai đoạn 5 — Review traceability

- Mỗi route/page/contract function Critical phải có ít nhất happy path, negative path,
  authorization và state/data-integrity case.
- Review lại source sau mỗi thay đổi schema/DTO/state machine.

---

## 13. Kiểm tra chéo

- [x] Đọc toàn bộ 7 sheet workbook.
- [x] Kiểm tra header, merge, formula, ID, trường thiếu.
- [x] Quét backend module/controller/policy chính.
- [x] Quét frontend route và page chính.
- [x] Quét mobile patient portal/API.
- [x] Quét smart contract AuditAnchor/FaceRegistry.
- [x] Kiểm tra role và ProtectedRoute.
- [x] Kiểm tra Visit state transition.
- [x] Lập Feature Inventory và Traceability Matrix.
- [x] Liệt kê gap kèm source evidence.
- [x] Không đọc/hiển thị giá trị `.env`.
- [x] Không sửa source code hoặc workbook gốc trong bước audit.

## Nguồn chính

- `apps/hospital-api/prisma/schema.prisma`
- `apps/hospital-api/src/modules/**/controllers/*.controller.ts`
- `apps/hospital-api/src/modules/visit/application/policies/visit-transition.policy.ts`
- `apps/hospital-api/src/modules/clinical-decision/application/use-cases/create-medical-conclusion.use-case.ts`
- `apps/hospital-web/src/routes/AppRoutes.jsx`
- `apps/hospital-web/src/features/doctor/pages/DoctorQueuePage.jsx`
- `apps/hospital-web/src/features/lab-manager/pages/LabOrdersPage.jsx`
- `apps/hospital-web/src/features/admin/pages/AuditLogsPage.jsx`
- `apps/hospital-web/src/features/admin/pages/DeletedRecordsPage.jsx`
- `apps/hospital-mobile/src/apps/patient-portal/PatientPortalScreen.tsx`
- `apps/audit-contracts/contracts/AuditAnchor.sol`
- `apps/audit-contracts/contracts/FaceRegistry.sol`
- `_4.1 ManualTestV1.xlsx`
