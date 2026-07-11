# NHIỆM VỤ: PHÂN TÍCH DỰ ÁN VÀ ĐÁNH GIÁ FILE MANUAL TESTCASE

Bạn đang đóng vai trò:

- Senior QA Engineer
- Test Architect
- Business Analyst
- Software Quality Auditor

Mục tiêu của bạn là đọc toàn bộ source code dự án, đọc file testcase hiện tại, đối chiếu testcase với chức năng thực tế và đánh giá khách quan chất lượng bộ testcase.

Không được chỉ đếm số lượng testcase. Phải xác minh testcase có thực sự bao phủ chức năng, nghiệp vụ, phân quyền, luồng trạng thái và các trường hợp lỗi của hệ thống hay không.

---

## 1. PHẠM VI DỰ ÁN

Thư mục gốc hiện tại là dự án KLTN, có cấu trúc chính:

```text
backend/
frontend/
mobile/
blockchain/
docs/
_4.1 ManualTestV1.xlsx
docker-compose.yml
package-lock.json
README.md
README.en.md
frontend-ui-standardization.md

File testcase cần đánh giá:

./_4.1 ManualTestV1.xlsx

Hãy tự động đọc tất cả sheet trong file Excel, không được chỉ đọc sheet đầu tiên.

2. NGUYÊN TẮC BẮT BUỘC
Phải quét source code trước khi chấm điểm testcase.
Không suy đoán tính năng chỉ dựa vào README.
Không chỉ phân tích đăng nhập, đăng ký hoặc CRUD cơ bản.
Phải xác định toàn bộ actor, role, module, chức năng và quy trình nghiệp vụ thực tế.
Mỗi nhận xét phải có bằng chứng từ:
Đường dẫn source code.
Controller, route, service, component, page, schema hoặc tài liệu liên quan.
Test Case ID tương ứng trong Excel nếu đã tồn tại.
Không được nói chung chung như:
“Cần bổ sung testcase”.
“Testcase chưa đầy đủ”.
“Cần test thêm validation”.

Phải chỉ rõ:

Thiếu testcase cho chức năng nào.
Thuộc actor hoặc role nào.
Điều kiện nào chưa được kiểm thử.
Dữ liệu đầu vào nào cần sử dụng.
Kết quả mong đợi phải là gì.
Mức độ ưu tiên của testcase.
Source code nào chứng minh chức năng đó tồn tại.
Không được đánh giá cao chỉ vì file có nhiều testcase.
Không được tự sửa source code.
Không được ghi đè file Excel gốc.
Không được đọc hoặc hiển thị giá trị bí mật trong .env. Chỉ được dùng tên biến môi trường để hiểu cấu hình hệ thống.
Bỏ qua các thư mục không cần thiết:
node_modules/
dist/
build/
coverage/
.git/
.next/
.cache/
generated/
Testcase phải được đánh giá theo góc nhìn con người có thể đọc và thực thi, không phải testcase viết theo kiểu máy móc hoặc lặp lại code.
3. GIAI ĐOẠN 1: KHẢO SÁT TOÀN BỘ DỰ ÁN
3.1. Backend

Phân tích tối thiểu:

Controllers và API routes.
Services và use case nghiệp vụ.
DTO, request schema và validation.
Guards, middleware, interceptor.
Authentication và authorization.
Role và permission.
Database schema, entity hoặc Prisma schema.
Enum và các trạng thái nghiệp vụ.
Quan hệ dữ liệu.
Cron job, queue, notification nếu có.
Upload file, import/export nếu có.
Transaction và xử lý rollback.
Các tích hợp bên ngoài.
Error handling.
Search, filter, pagination, sort.
Các quy tắc chống tạo trùng.
Các quy tắc chuyển trạng thái.

Đối với mỗi API, xác định:

HTTP Method
Route
Actor được phép sử dụng
Input
Validation
Business rules
Output
Error cases
Database changes
State transitions
3.2. Frontend

Phân tích:

Router và danh sách page.
Sidebar, menu và điều kiện hiển thị theo role.
Form nhập liệu.
Validation phía client.
API client.
Modal, table, filter, search, pagination.
Button và action.
Loading, empty state và error state.
Các chức năng có trên giao diện nhưng có thể chưa có testcase.
Các API backend đã tồn tại nhưng frontend chưa sử dụng.
Các chức năng frontend có nhưng backend không hỗ trợ đầy đủ.
3.3. Mobile

Nếu thư mục mobile/ có source code, phân tích:

Màn hình.
Navigation.
Login, OTP hoặc xác thực.
Hồ sơ người dùng.
Đặt lịch hoặc theo dõi dữ liệu.
Validation.
Mất mạng và kết nối yếu.
Gọi API thất bại.
Token hết hạn.
Quyền camera, thư viện ảnh, thông báo nếu có.
Hành vi khi ứng dụng chạy nền hoặc mở lại.

Không áp dụng testcase mobile một cách máy móc nếu dự án không có chức năng tương ứng.

3.4. Blockchain

Nếu thư mục blockchain/ thực sự được sử dụng, phân tích:

Smart contract.
Function của contract.
Role hoặc quyền gọi transaction.
Trạng thái transaction.
Transaction thành công và thất bại.
Duplicate transaction.
Invalid wallet.
Không đủ gas.
Network lỗi.
Dữ liệu blockchain không đồng bộ với database.
Retry và idempotency.

Chỉ đề xuất testcase blockchain khi source code chứng minh chức năng đó tồn tại.

3.5. Tài liệu

Đọc:

README.md
README.en.md
docs/
docker-compose.yml
frontend-ui-standardization.md

Tài liệu chỉ dùng để bổ sung ngữ cảnh. Khi tài liệu và source code khác nhau, ưu tiên source code hiện tại và ghi rõ sự khác biệt.

4. GIAI ĐOẠN 2: TẠO FEATURE INVENTORY

Trước khi đánh giá Excel, phải lập danh sách chức năng thực tế của hệ thống.

Tạo bảng:

Module	Actor/Role	Chức năng	Luồng nghiệp vụ	API/Page	Source evidence	Mức quan trọng

Trong đó:

Source evidence phải ghi đường dẫn file và tên class/function/route.
Mức quan trọng sử dụng:
Critical
High
Medium
Low

Phải xác định đầy đủ:

Actor.
Role.
Module.
Chức năng.
Sub-function.
Trạng thái dữ liệu.
Luồng chính.
Luồng thay thế.
Luồng lỗi.
Phụ thuộc giữa các module.

Không gộp nhiều chức năng khác nhau thành một dòng chung chung.

Ví dụ không đạt:

Quản lý bệnh nhân

Ví dụ đạt:

Nhân viên tiếp nhận tạo hồ sơ bệnh nhân mới
Nhân viên tìm bệnh nhân theo số điện thoại
Nhân viên cập nhật thông tin bệnh nhân
Nhân viên từ chối tạo hồ sơ khi dữ liệu định danh bị trùng
Bác sĩ chỉ được xem bệnh nhân thuộc lượt khám được phân công
5. GIAI ĐOẠN 3: PHÂN TÍCH FILE EXCEL

Đọc toàn bộ workbook bằng công cụ phù hợp như Python và openpyxl.

Phải kiểm tra:

Tên các sheet.
Header từng sheet.
Số lượng dòng dữ liệu.
Cell merge.
Công thức.
Dữ liệu bị thiếu.
Test Case ID bị trùng.
Test Scenario ID bị trùng.
Dòng trống xen kẽ.
Testcase bị lặp nội dung.
Định dạng không nhất quán.

Cấu trúc testcase dự kiến gồm các cột như:

Test Scenario #
Scenario Description
Test Case #
Test Case Description
Pre-condition
Steps
Data Test Example
Expected Result

Nếu file sử dụng tên cột khác, hãy tự xác định cột tương ứng.

Kiểm tra từng testcase

Đối với từng testcase, đánh giá:

Test Case ID có duy nhất không.
Scenario có đúng module không.
Mô tả testcase có rõ mục tiêu không.
Pre-condition có đầy đủ không.
Steps có thể thực hiện được không.
Steps có đúng thứ tự không.
Test data có cụ thể không.
Expected Result có thể quan sát và xác minh không.
Có ghi kết quả quá chung chung không.
Có gộp nhiều mục tiêu test vào một testcase không.
Có phụ thuộc vào testcase khác nhưng không ghi rõ không.
Có khớp với source code hiện tại không.
Có đang test hành vi không tồn tại trong source code không.
Có bỏ sót role hoặc permission không.
Có bỏ sót negative case hoặc boundary case không.
Các Expected Result không đạt

Đánh dấu các kết quả mong đợi dạng:

Thành công
Hiển thị đúng
Hệ thống hoạt động bình thường
Thông báo lỗi
Không cho phép
Dữ liệu được lưu

Nếu không mô tả cụ thể:

Thông báo gì.
Trạng thái nào thay đổi.
Dữ liệu nào được tạo hoặc cập nhật.
Có redirect hay không.
API trả status code gì.
Dữ liệu có xuất hiện trong danh sách không.
Quyền truy cập bị từ chối như thế nào.
6. GIAI ĐOẠN 4: LẬP TRACEABILITY MATRIX

Lập ma trận đối chiếu:

Feature ID	Module	Actor	Chức năng từ source	Source evidence	Testcase hiện có	Mức bao phủ	Testcase còn thiếu

Mức bao phủ:

Covered: đã có đủ luồng chính, lỗi quan trọng và phân quyền.
Partially Covered: có testcase nhưng thiếu nhiều trường hợp.
Not Covered: chưa có testcase.
Invalid Coverage: testcase có nhưng không đúng source code.
Duplicate Coverage: nhiều testcase gần như giống nhau nhưng không tăng độ bao phủ.

Phải tính:

Feature Coverage = số chức năng có testcase hợp lệ / tổng số chức năng thực tế
Critical Feature Coverage = số chức năng Critical có testcase hợp lệ / tổng chức năng Critical
Negative Coverage = số chức năng có negative case / tổng chức năng cần negative case
Role Coverage = số quyền truy cập đã được kiểm thử / tổng quyền truy cập
State Transition Coverage = số chuyển trạng thái đã test / tổng chuyển trạng thái

Không được xem một chức năng là Covered nếu chỉ có happy path.

7. NHỮNG NHÓM TESTCASE PHẢI KIỂM TRA THIẾU

Không được tự động kết luận tất cả nhóm dưới đây đều cần. Chỉ đánh dấu thiếu khi source code có hành vi tương ứng.

7.1. Functional
Happy path.
Alternate flow.
Negative flow.
Cancel flow.
Retry flow.
Duplicate submission.
7.2. Validation
Bỏ trống trường bắt buộc.
Min length, max length.
Giá trị nhỏ nhất, lớn nhất.
Dữ liệu âm.
Số 0.
Ký tự đặc biệt.
Unicode tiếng Việt.
Khoảng trắng đầu và cuối.
Sai định dạng.
Ngày trong quá khứ hoặc tương lai.
Dữ liệu không tồn tại.
ID sai định dạng.
7.3. Authentication
Chưa đăng nhập.
Token không hợp lệ.
Token hết hạn.
Token bị thu hồi.
Đăng nhập sai nhiều lần.
Đăng xuất rồi dùng lại token.
7.4. Authorization
Role được phép.
Role không được phép.
Người dùng truy cập dữ liệu của người khác.
Thay đổi ID trên URL hoặc request.
Ẩn button trên frontend nhưng vẫn gọi API trực tiếp.
Quyền frontend và backend không đồng nhất.
7.5. State transition

Với mỗi enum trạng thái, xác định:

Trạng thái ban đầu.
Trạng thái được phép chuyển tới.
Trạng thái không được phép chuyển tới.
Chuyển lùi trạng thái.
Lặp lại cùng thao tác.
Thao tác sau khi bản ghi hoàn tất hoặc bị hủy.
Hai người cùng thay đổi trạng thái.
7.6. Data integrity
Tạo dữ liệu trùng.
Foreign key không tồn tại.
Dữ liệu đang được tham chiếu.
Xóa dữ liệu đang được sử dụng.
Soft delete.
Restore.
Transaction thất bại giữa chừng.
Dữ liệu backend và frontend không đồng bộ.
7.7. List và tìm kiếm
Không có dữ liệu.
Một bản ghi.
Nhiều bản ghi.
Pagination đầu, giữa và cuối.
Search không có kết quả.
Search có dấu và không dấu nếu hệ thống hỗ trợ.
Filter đơn.
Nhiều filter kết hợp.
Sort tăng và giảm.
Dữ liệu mới có xuất hiện đúng vị trí không.
7.8. UI/UX
Loading state.
Error state.
Empty state.
Disable button khi đang submit.
Double click.
Refresh trang.
Back/forward browser.
Responsive.
Nội dung dài.
Modal đóng khi chưa lưu.
Giữ hoặc mất dữ liệu khi API lỗi.
7.9. API và lỗi hệ thống
HTTP 400.
HTTP 401.
HTTP 403.
HTTP 404.
HTTP 409.
HTTP 422 nếu có.
HTTP 500.
Timeout.
Mất kết nối.
API trả thiếu field.
API trả dữ liệu rỗng.
Request lặp lại.
Idempotency.
7.10. Security

Chỉ đánh giá ở mức manual functional security testing:

Broken access control.
IDOR.
Mass assignment.
Injection input cơ bản.
XSS ở trường nhập liệu.
Upload file sai loại.
Upload file quá dung lượng.
Truy cập endpoint không đúng role.
Dữ liệu nhạy cảm xuất hiện trong response hoặc giao diện.

Không thực hiện tấn công gây hại hoặc khai thác ngoài phạm vi dự án.

8. TIÊU CHÍ CHẤM ĐIỂM

Chấm trên thang 100 và quy đổi sang thang 10.

8.1. Coverage chức năng — 25 điểm
Bao phủ đầy đủ module.
Bao phủ chức năng quan trọng.
Có traceability với source code.
8.2. Business flow và state transition — 15 điểm
Đúng quy trình nghiệp vụ.
Đủ trạng thái.
Đủ luồng thay thế.
Đủ trường hợp hủy, retry và hoàn tất.
8.3. Negative và boundary testing — 15 điểm
Validation.
Boundary.
Invalid input.
Error handling.
8.4. Authentication và authorization — 10 điểm
Đúng role.
Kiểm tra truy cập trái phép.
Kiểm tra ownership dữ liệu.
8.5. Chất lượng từng testcase — 15 điểm
Mô tả rõ.
Pre-condition rõ.
Steps thực hiện được.
Data cụ thể.
Expected Result kiểm chứng được.
8.6. Data integrity và integration — 10 điểm
Quan hệ dữ liệu.
Transaction.
Đồng bộ giữa các module.
Tích hợp bên ngoài.
8.7. Tổ chức và khả năng bảo trì — 10 điểm
ID nhất quán.
Không trùng lặp.
Nhóm module hợp lý.
Dễ đọc.
Dễ mở rộng.
Không phụ thuộc mơ hồ.

Tổng:

Overall Score = tổng điểm 7 tiêu chí
Score / 10 = Overall Score / 10

Xếp loại:

90–100: Xuất sắc, gần sẵn sàng nghiệm thu
80–89: Tốt, còn một số khoảng trống
70–79: Khá, cần bổ sung trước khi test chính thức
60–69: Trung bình, thiếu nhiều trường hợp quan trọng
40–59: Yếu, chưa phản ánh đầy đủ hệ thống
0–39: Không đạt, cần thiết kế lại bộ testcase

Không làm tròn điểm lên nếu chưa có bằng chứng bao phủ.

9. XÁC ĐỊNH MỨC ĐỘ ƯU TIÊN TESTCASE THIẾU

Mỗi testcase thiếu phải được phân loại:

P0: Thiếu testcase có thể gây sai dữ liệu nghiêm trọng, lộ dữ liệu, sai phân quyền hoặc làm hỏng quy trình chính.
P1: Chức năng nghiệp vụ chính chưa được kiểm thử đầy đủ.
P2: Validation, lỗi phụ hoặc trải nghiệm người dùng.
P3: Trường hợp hiếm, cải thiện chất lượng hoặc khả năng bảo trì.

Ngoài Priority, ghi thêm Severity:

Critical
High
Medium
Low
10. ĐỊNH DẠNG KẾT QUẢ BẮT BUỘC

Tạo file:

./docs/TESTCASE_AUDIT_REPORT.md

Không ghi đè file _4.1 ManualTestV1.xlsx.

Báo cáo phải có đầy đủ các phần sau.

10.1. Executive Summary
Tổng số sheet:
Tổng số testcase:
Số testcase hợp lệ:
Số testcase cần sửa:
Số testcase trùng:
Số testcase không còn khớp source:
Tổng số chức năng tìm thấy trong project:
Số chức năng đã bao phủ:
Số chức năng bao phủ một phần:
Số chức năng chưa có testcase:
Điểm tổng: .../100
Điểm quy đổi: .../10
Xếp loại:
Kết luận:
10.2. Bảng điểm chi tiết
Tiêu chí	Điểm tối đa	Điểm đạt	Lý do	Bằng chứng
10.3. Feature Inventory

Liệt kê toàn bộ module và chức năng tìm thấy trong source.

10.4. Traceability Matrix

Đối chiếu chức năng với testcase hiện có.

10.5. Các điểm làm tốt

Chỉ ghi các ưu điểm có bằng chứng cụ thể.

Ví dụ:

Testcase nào có Steps tốt.
Module nào có coverage tốt.
Testcase nào có Expected Result rõ.
Phân quyền nào đã được kiểm tra đầy đủ.
10.6. Các vấn đề cần cải thiện

Sử dụng bảng:

Issue ID	Test Case ID	Vấn đề	Mức độ	Vì sao chưa đạt	Cách cải thiện
10.7. Danh sách testcase còn thiếu
Gap ID	Priority	Severity	Module	Actor	Testcase cần bổ sung	Pre-condition	Test data	Expected Result	Source evidence

Phải mô tả testcase cụ thể, không chỉ ghi tên nhóm testcase.

Ví dụ không đạt:

Test validation form

Ví dụ đạt:

Kiểm tra nhân viên tạo bệnh nhân khi số điện thoại đã thuộc một hồ sơ khác nhưng họ tên và ngày sinh khác.
10.8. Top 20 testcase cần bổ sung gấp

Sắp xếp theo:

Priority.
Severity.
Mức ảnh hưởng đến nghiệp vụ.
Khả năng xảy ra.
10.9. Testcase trùng hoặc có thể gộp
Test Case ID 1	Test Case ID 2	Mức tương đồng	Đề xuất

Không gộp các testcase chỉ vì Steps giống nhau nếu mục tiêu hoặc expected result khác nhau.

10.10. Testcase không khớp source code
Test Case ID	Nội dung testcase	Source hiện tại	Kết luận

Phân biệt:

Chức năng đã bị xóa.
Chức năng đổi tên.
Luồng nghiệp vụ đã thay đổi.
Testcase mô tả sai hành vi.
Source code có thể đang thiếu so với requirement.
10.11. Mẫu testcase được viết lại

Chọn tối thiểu 10 testcase chất lượng thấp trong Excel và viết lại theo đúng format:

Test Scenario #	Scenario Description	Test Case #	Test Case Description	Pre-condition	Steps	Data Test Example	Expected Result

Steps phải đánh số rõ ràng:

1. Đăng nhập bằng tài khoản...
2. Truy cập...
3. Nhập...
4. Nhấn...

Expected Result phải mô tả:

Thông báo.
HTTP status nếu có thể xác minh.
Trạng thái dữ liệu.
Thay đổi trong database hoặc danh sách.
Quyền truy cập.
Điều hướng giao diện.
10.12. Kế hoạch cải thiện

Chia thành:

Giai đoạn 1: Sửa testcase sai hoặc không thể thực hiện
Giai đoạn 2: Bổ sung P0 và P1
Giai đoạn 3: Bổ sung validation, boundary và error handling
Giai đoạn 4: Chuẩn hóa format và loại trùng
Giai đoạn 5: Review traceability lần cuối
11. YÊU CẦU VỀ BẰNG CHỨNG

Mọi nhận xét quan trọng phải ghi nguồn theo format:

backend/src/.../example.controller.ts
- Route: POST /example
- Function: createExample()

frontend/src/pages/.../ExamplePage.tsx
- Component: ExampleForm
- Action: submitExample()

_4.1 ManualTestV1.xlsx
- Sheet: Example
- Test Case ID: TC_EXAMPLE_001

Khi có thể, ghi thêm số dòng source code.

Không được tạo đường dẫn giả hoặc Test Case ID không tồn tại.

Nếu không tìm thấy bằng chứng, ghi:

Chưa đủ bằng chứng để kết luận.
12. KIỂM TRA CHÉO TRƯỚC KHI KẾT THÚC

Trước khi hoàn thành báo cáo, tự kiểm tra:

Đã đọc tất cả sheet chưa?
Đã quét cả backend, frontend, mobile và blockchain chưa?
Đã bỏ qua thư mục generated chưa?
Đã xác định đầy đủ role chưa?
Đã kiểm tra state transition chưa?
Đã kiểm tra negative case chưa?
Đã kiểm tra authorization chưa?
Đã phát hiện testcase trùng chưa?
Đã phát hiện testcase không khớp source chưa?
Mỗi testcase thiếu có source evidence chưa?
Điểm số có được giải thích bằng bằng chứng chưa?
Có đánh giá dựa trên chất lượng thay vì số lượng không?
Báo cáo có đủ cụ thể để QA khác tiếp tục viết testcase không?

Chỉ kết thúc khi tất cả mục trên đã được xử lý.

13. CÁCH THỰC HIỆN

Thực hiện lần lượt:

Bước 1: Kiểm tra cấu trúc repository.
Bước 2: Đọc toàn bộ workbook Excel.
Bước 3: Quét backend.
Bước 4: Quét frontend.
Bước 5: Quét mobile.
Bước 6: Quét blockchain.
Bước 7: Đọc tài liệu.
Bước 8: Lập Feature Inventory.
Bước 9: Lập Traceability Matrix.
Bước 10: Đánh giá từng testcase.
Bước 11: Chấm điểm.
Bước 12: Liệt kê testcase thiếu.
Bước 13: Viết báo cáo TESTCASE_AUDIT_REPORT.md.
Bước 14: Kiểm tra chéo kết quả.

Trong quá trình làm việc, không dừng lại sau khi chỉ phân tích một vài module. Phải tiếp tục cho đến khi đã bao phủ toàn bộ repository hiện tại.
Bắt đầu thực hiện ngay.