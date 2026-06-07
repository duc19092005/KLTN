# Requirements Document

## Introduction

Tài liệu này mô tả các yêu cầu cho một tập hợp cải tiến đối với tính năng Quản Lý Ca Trực (Shift Management) hiện có của Hệ Thống Quản Lý Bệnh Viện KLTN. Hệ thống gồm backend NestJS, frontend React/Vite, và lớp kiểm toán blockchain (Solidity/Ethers).

Tập cải tiến này giải quyết năm vấn đề/nhu cầu do người dùng báo cáo:

1. **Phân quyền duyệt ca trực**: Trưởng phòng ban (StaffProfile là quản lý của một Department) phải được quyền duyệt/từ chối ca trực của chính phòng ban mình quản lý; Admin có toàn quyền trên mọi phòng ban. Mọi hành động duyệt/từ chối phải được ghi vào nhật ký kiểm toán chi tiết.
2. **Lời nhắn tùy chọn khi đăng ký + sửa lỗi neo blockchain**: Thêm trường lời nhắn (note) tùy chọn khi nhân viên đăng ký ca trực và hiển thị trên giao diện; đảm bảo cả luồng đăng ký và luồng duyệt ca trực cận lâm sàng đều neo (anchor) hash toàn vẹn lên blockchain thành công.
3. **Cải thiện UI/UX từ chối ca trực**: Thay thế `alert()` + `prompt()` thô sơ bằng modal/form nhập lý do từ chối đúng chuẩn UI/UX.
4. **Hệ thống thông báo (notification)**: Mở rộng thông báo cho tất cả các vai trò (ADMIN, RECEPTIONIST, DOCTOR, LAB_MANAGER), bổ sung bộ lọc theo trạng thái đã đọc/chưa đọc và theo ngày gửi, đồng thời cải thiện UI/UX.
5. **Sửa lỗi hiệu năng và hiển thị xem theo tháng**: Tối ưu hiệu năng render lịch xem theo tháng khi một ngày có nhiều ca trực, và cải thiện kích thước/cách hiển thị ô (cell).

Phạm vi bao gồm hai module ca trực hiện có: ca trực cận lâm sàng (`paraclinical-shift`) và ca trực lễ tân (`reception-shift`), cùng với module thông báo (`notification`) và lớp kiểm toán (`audit-logger`).

## Glossary

- **Hệ_Thống_Ca_Trực**: Phân hệ backend xử lý đăng ký, duyệt, từ chối và truy vấn ca trực, gồm cả ca trực cận lâm sàng và ca trực lễ tân.
- **Ca_Trực**: Một bản ghi ca làm việc của nhân viên (ParaclinicalShift hoặc ReceptionShift), có các trạng thái PENDING (chờ duyệt), APPROVED (đã duyệt), REJECTED (bị từ chối).
- **Ca_Trực_Cận_Lâm_Sàng**: Bản ghi ParaclinicalShift gắn với một phòng (ClinicalRoom), được neo toàn vẹn lên blockchain khi duyệt.
- **Ca_Trực_Lễ_Tân**: Bản ghi ReceptionShift gắn với một phòng ban hành chính, không neo lên blockchain.
- **Trưởng_Phòng_Ban**: Một StaffProfile được gán là quản lý (Department.manager) của một Department cụ thể.
- **Admin**: Người dùng có vai trò ADMIN, có toàn quyền xem và thao tác trên mọi phòng ban.
- **Người_Duyệt**: Trưởng_Phòng_Ban hoặc Admin thực hiện hành động duyệt hoặc từ chối một Ca_Trực.
- **Nhật_Ký_Kiểm_Toán**: Dịch vụ AuditLoggerService ghi bản ghi tamper-evident vào BlockchainLogger theo chuỗi hash (hash-chain).
- **Bộ_Neo_Blockchain**: Thành phần neo hash toàn vẹn của Ca_Trực lên blockchain qua cơ chế batch Merkle (AuditAnchorService).
- **Hệ_Thống_Thông_Báo**: Phân hệ NotificationService quản lý tạo, truy vấn, đánh dấu đã đọc và xóa thông báo của người dùng.
- **Thông_Báo**: Bản ghi Notification gồm tiêu đề, nội dung, trạng thái đã đọc (isRead) và thời điểm tạo (createdAt).
- **Lời_Nhắn**: Trường văn bản tùy chọn do nhân viên nhập khi đăng ký Ca_Trực.
- **Lý_Do_Từ_Chối**: Trường văn bản tùy chọn do Người_Duyệt nhập khi từ chối một Ca_Trực.
- **Lịch_Xem_Theo_Tháng**: Thành phần giao diện calendar hiển thị các Ca_Trực theo dạng lưới tháng trên frontend.
- **Vai_Trò**: Một trong các giá trị ADMIN, RECEPTIONIST, DOCTOR, LAB_MANAGER.

## Requirements

### Requirement 1: Phân quyền duyệt ca trực cho trưởng phòng ban

**User Story:** Là một trưởng phòng ban, tôi muốn duyệt và từ chối ca trực của chính phòng ban mình quản lý, để tôi có thể tự chủ quản lý lịch làm việc của nhân viên thuộc quyền mà không phụ thuộc vào Admin.

#### Acceptance Criteria

1. WHEN một Trưởng_Phòng_Ban yêu cầu duyệt một Ca_Trực thuộc phòng ban mình quản lý, THE Hệ_Thống_Ca_Trực SHALL thực hiện duyệt Ca_Trực đó.
2. WHEN một Trưởng_Phòng_Ban yêu cầu từ chối một Ca_Trực thuộc phòng ban mình quản lý, THE Hệ_Thống_Ca_Trực SHALL thực hiện từ chối Ca_Trực đó.
3. WHEN một Admin yêu cầu duyệt hoặc từ chối bất kỳ Ca_Trực nào, THE Hệ_Thống_Ca_Trực SHALL thực hiện hành động đó bất kể phòng ban.
4. IF một người dùng yêu cầu duyệt hoặc từ chối một Ca_Trực không thuộc phòng ban mình quản lý và người dùng đó không phải Admin, THEN THE Hệ_Thống_Ca_Trực SHALL từ chối yêu cầu với mã lỗi 403 và thông báo lỗi quyền truy cập.
5. WHEN một Admin yêu cầu xem danh sách Ca_Trực, THE Hệ_Thống_Ca_Trực SHALL trả về Ca_Trực của tất cả phòng ban.
6. WHEN một Trưởng_Phòng_Ban yêu cầu xem danh sách Ca_Trực chờ duyệt, THE Hệ_Thống_Ca_Trực SHALL trả về các Ca_Trực thuộc phòng ban mình quản lý.
7. THE Hệ_Thống_Ca_Trực SHALL áp dụng quy tắc phân quyền duyệt giống nhau cho cả Ca_Trực_Cận_Lâm_Sàng và Ca_Trực_Lễ_Tân.

### Requirement 2: Ghi nhật ký kiểm toán chi tiết cho hành động duyệt và từ chối

**User Story:** Là một quản trị viên hệ thống, tôi muốn mọi hành động duyệt và từ chối ca trực được ghi nhật ký kiểm toán chi tiết, để tôi có thể truy vết ai đã thao tác gì, khi nào và vì lý do gì.

#### Acceptance Criteria

1. WHEN một Người_Duyệt duyệt một Ca_Trực, THE Nhật_Ký_Kiểm_Toán SHALL ghi một bản ghi gồm định danh Ca_Trực, định danh người thực hiện, hành động duyệt, và thời điểm thực hiện.
2. WHEN một Người_Duyệt từ chối một Ca_Trực, THE Nhật_Ký_Kiểm_Toán SHALL ghi một bản ghi gồm định danh Ca_Trực, định danh người thực hiện, hành động từ chối, Lý_Do_Từ_Chối (nếu có), và thời điểm thực hiện.
3. WHEN một Người_Duyệt từ chối một Ca_Trực_Lễ_Tân, THE Nhật_Ký_Kiểm_Toán SHALL ghi một bản ghi kiểm toán cho hành động đó.
4. WHEN một Người_Duyệt duyệt một Ca_Trực_Lễ_Tân, THE Nhật_Ký_Kiểm_Toán SHALL ghi một bản ghi kiểm toán cho hành động đó.
5. IF việc ghi Nhật_Ký_Kiểm_Toán thất bại trong một giao dịch duyệt hoặc từ chối, THEN THE Hệ_Thống_Ca_Trực SHALL hoàn tác (rollback) thay đổi trạng thái Ca_Trực và trả về mã lỗi.
6. THE Hệ_Thống_Ca_Trực SHALL thực hiện thay đổi trạng thái Ca_Trực và ghi Nhật_Ký_Kiểm_Toán trong cùng một giao dịch cơ sở dữ liệu (`prisma.$transaction`).

### Requirement 3: Lời nhắn tùy chọn khi đăng ký ca trực

**User Story:** Là một nhân viên, tôi muốn nhập một lời nhắn tùy chọn khi đăng ký ca trực, để tôi có thể cung cấp thêm thông tin ngữ cảnh cho người duyệt.

#### Acceptance Criteria

1. WHERE nhân viên nhập Lời_Nhắn khi đăng ký Ca_Trực, THE Hệ_Thống_Ca_Trực SHALL lưu Lời_Nhắn cùng với bản ghi Ca_Trực.
2. WHERE nhân viên không nhập Lời_Nhắn khi đăng ký Ca_Trực, THE Hệ_Thống_Ca_Trực SHALL tạo Ca_Trực với Lời_Nhắn trống.
3. WHEN nhân viên nhập Lời_Nhắn vượt quá 500 ký tự, THE Hệ_Thống_Ca_Trực SHALL từ chối yêu cầu với mã lỗi 400 và thông báo lỗi xác thực.
4. WHEN giao diện hiển thị chi tiết một Ca_Trực có Lời_Nhắn, THE Lịch_Xem_Theo_Tháng SHALL hiển thị nội dung Lời_Nhắn.
5. WHEN giao diện hiển thị chi tiết một Ca_Trực không có Lời_Nhắn, THE Lịch_Xem_Theo_Tháng SHALL hiển thị Ca_Trực mà không hiển thị phần Lời_Nhắn.

### Requirement 4: Neo toàn vẹn ca trực lên blockchain khi đăng ký và khi duyệt

**User Story:** Là một quản trị viên hệ thống, tôi muốn hash toàn vẹn của ca trực cận lâm sàng được neo lên blockchain ở cả luồng đăng ký và luồng duyệt, để dữ liệu ca trực luôn có thể được xác minh chống giả mạo.

#### Acceptance Criteria

1. WHEN một Ca_Trực_Cận_Lâm_Sàng được đăng ký thành công, THE Bộ_Neo_Blockchain SHALL ghi một bản ghi neo gồm hash toàn vẹn của Ca_Trực vào Nhật_Ký_Kiểm_Toán với trạng thái on-chain PENDING.
2. WHEN một Ca_Trực_Cận_Lâm_Sàng được duyệt thành công, THE Bộ_Neo_Blockchain SHALL ghi một bản ghi neo gồm hash toàn vẹn của Ca_Trực vào Nhật_Ký_Kiểm_Toán với trạng thái on-chain PENDING.
3. IF việc ghi bản ghi neo thất bại trong giao dịch đăng ký hoặc duyệt, THEN THE Hệ_Thống_Ca_Trực SHALL hoàn tác thay đổi đối với Ca_Trực và trả về mã lỗi.
4. WHEN một Ca_Trực_Cận_Lâm_Sàng đã duyệt được xác minh toàn vẹn, THE Hệ_Thống_Ca_Trực SHALL trả về kết quả VERIFIED khi hash trong cơ sở dữ liệu và hash on-chain khớp nhau.
5. WHEN một Ca_Trực_Cận_Lâm_Sàng đã duyệt được xác minh toàn vẹn và hash trong cơ sở dữ liệu khác với hash on-chain, THE Hệ_Thống_Ca_Trực SHALL trả về kết quả TAMPERED.
6. THE Hệ_Thống_Ca_Trực SHALL neo lên blockchain chỉ hash, salt, dấu thời gian và metadata không chứa thông tin định danh cá nhân nhạy cảm.

### Requirement 5: Cải thiện UI/UX nhập lý do từ chối ca trực

**User Story:** Là một người duyệt, tôi muốn nhập lý do từ chối ca trực qua một form/modal được thiết kế tốt, để trải nghiệm thao tác rõ ràng và chuyên nghiệp thay vì dùng hộp thoại trình duyệt thô sơ.

#### Acceptance Criteria

1. WHEN Người_Duyệt khởi động hành động từ chối một Ca_Trực, THE Hệ_Thống_Ca_Trực SHALL hiển thị một modal nhập Lý_Do_Từ_Chối.
2. WHERE Người_Duyệt nhập Lý_Do_Từ_Chối trong modal, THE Hệ_Thống_Ca_Trực SHALL gửi Lý_Do_Từ_Chối kèm theo yêu cầu từ chối.
3. WHEN Người_Duyệt xác nhận từ chối mà không nhập Lý_Do_Từ_Chối, THE Hệ_Thống_Ca_Trực SHALL gửi yêu cầu từ chối với Lý_Do_Từ_Chối trống.
4. WHEN Người_Duyệt nhập Lý_Do_Từ_Chối vượt quá 500 ký tự, THE Hệ_Thống_Ca_Trực SHALL hiển thị thông báo lỗi xác thực và ngăn việc gửi yêu cầu.
5. WHEN Người_Duyệt hủy modal nhập Lý_Do_Từ_Chối, THE Hệ_Thống_Ca_Trực SHALL đóng modal và giữ nguyên trạng thái Ca_Trực.
6. WHILE yêu cầu từ chối đang được xử lý, THE Hệ_Thống_Ca_Trực SHALL vô hiệu hóa nút xác nhận để ngăn gửi trùng lặp.
7. WHEN yêu cầu từ chối hoàn tất thành công, THE Hệ_Thống_Ca_Trực SHALL đóng modal và hiển thị thông báo xác nhận.

### Requirement 6: Thông báo kết quả duyệt ca trực

**User Story:** Là một nhân viên, tôi muốn được thông báo khi ca trực của tôi được duyệt hoặc bị từ chối, để tôi nắm được kết quả mà không cần liên tục kiểm tra thủ công.

#### Acceptance Criteria

1. WHEN một Ca_Trực của nhân viên được duyệt, THE Hệ_Thống_Thông_Báo SHALL tạo một Thông_Báo gửi đến người dùng sở hữu Ca_Trực với nội dung xác nhận đã được duyệt.
2. WHEN một Ca_Trực của nhân viên bị từ chối, THE Hệ_Thống_Thông_Báo SHALL tạo một Thông_Báo gửi đến người dùng sở hữu Ca_Trực với nội dung từ chối.
3. WHERE một Ca_Trực bị từ chối có Lý_Do_Từ_Chối, THE Hệ_Thống_Thông_Báo SHALL bao gồm Lý_Do_Từ_Chối trong nội dung Thông_Báo.
4. THE Hệ_Thống_Thông_Báo SHALL hỗ trợ tạo và truy xuất Thông_Báo cho người dùng thuộc bất kỳ Vai_Trò nào trong tập ADMIN, RECEPTIONIST, DOCTOR, LAB_MANAGER.

### Requirement 7: Lọc thông báo theo trạng thái đọc và theo ngày gửi

**User Story:** Là một người dùng, tôi muốn lọc thông báo theo trạng thái đã đọc/chưa đọc và theo ngày gửi, để tôi nhanh chóng tìm được thông báo quan tâm.

#### Acceptance Criteria

1. WHEN người dùng yêu cầu danh sách Thông_Báo với bộ lọc trạng thái chưa đọc, THE Hệ_Thống_Thông_Báo SHALL trả về chỉ các Thông_Báo có isRead bằng false thuộc về người dùng đó.
2. WHEN người dùng yêu cầu danh sách Thông_Báo với bộ lọc trạng thái đã đọc, THE Hệ_Thống_Thông_Báo SHALL trả về chỉ các Thông_Báo có isRead bằng true thuộc về người dùng đó.
3. WHEN người dùng yêu cầu danh sách Thông_Báo với bộ lọc khoảng ngày gửi, THE Hệ_Thống_Thông_Báo SHALL trả về chỉ các Thông_Báo có createdAt nằm trong khoảng ngày được chỉ định thuộc về người dùng đó.
4. WHEN người dùng yêu cầu danh sách Thông_Báo không kèm bộ lọc, THE Hệ_Thống_Thông_Báo SHALL trả về tất cả Thông_Báo thuộc về người dùng đó, sắp xếp theo createdAt giảm dần.
5. IF người dùng cung cấp tham số khoảng ngày không hợp lệ, THEN THE Hệ_Thống_Thông_Báo SHALL từ chối yêu cầu với mã lỗi 400 và thông báo lỗi xác thực.
6. WHEN người dùng yêu cầu danh sách Thông_Báo với đồng thời bộ lọc trạng thái đọc và bộ lọc khoảng ngày, THE Hệ_Thống_Thông_Báo SHALL trả về các Thông_Báo thỏa mãn cả hai điều kiện.

### Requirement 8: Cải thiện UI/UX hiển thị thông báo

**User Story:** Là một người dùng, tôi muốn giao diện thông báo rõ ràng với khả năng phân biệt thông báo đã đọc/chưa đọc và áp dụng bộ lọc, để tôi quản lý thông báo hiệu quả.

#### Acceptance Criteria

1. WHEN giao diện hiển thị danh sách Thông_Báo, THE Hệ_Thống_Thông_Báo SHALL phân biệt trực quan giữa Thông_Báo đã đọc và chưa đọc.
2. WHEN người dùng mở một Thông_Báo chưa đọc, THE Hệ_Thống_Thông_Báo SHALL đánh dấu Thông_Báo đó là đã đọc.
3. WHEN người dùng chọn một bộ lọc trạng thái đọc hoặc khoảng ngày trên giao diện, THE Hệ_Thống_Thông_Báo SHALL hiển thị danh sách Thông_Báo đã được lọc tương ứng.
4. WHERE người dùng không có Thông_Báo nào thỏa mãn bộ lọc đang áp dụng, THE Hệ_Thống_Thông_Báo SHALL hiển thị trạng thái rỗng có nội dung mô tả.
5. WHEN giao diện hiển thị một Thông_Báo, THE Hệ_Thống_Thông_Báo SHALL hiển thị tiêu đề, nội dung và thời điểm gửi của Thông_Báo.

### Requirement 9: Tối ưu hiệu năng và hiển thị lịch xem theo tháng

**User Story:** Là một nhân viên đăng ký ca trực, tôi muốn lịch xem theo tháng hiển thị mượt và đủ thông tin ngay cả khi một ngày có nhiều ca trực, để tôi xem và đăng ký ca thuận tiện mà không bị giật/lag.

#### Acceptance Criteria

1. WHILE Lịch_Xem_Theo_Tháng hiển thị một ngày có nhiều Ca_Trực, THE Lịch_Xem_Theo_Tháng SHALL hiển thị nội dung ô (cell) mà không gây giật/lag khi cuộn và tương tác.
2. WHEN số lượng Ca_Trực trong một ngày vượt quá số mục hiển thị tối đa của ô, THE Lịch_Xem_Theo_Tháng SHALL hiển thị một chỉ báo số lượng Ca_Trực còn lại.
3. WHEN người dùng chọn chỉ báo số lượng Ca_Trực còn lại của một ngày, THE Lịch_Xem_Theo_Tháng SHALL hiển thị đầy đủ danh sách Ca_Trực của ngày đó.
4. WHEN Lịch_Xem_Theo_Tháng hiển thị một ô của ngày, THE Lịch_Xem_Theo_Tháng SHALL hiển thị mỗi Ca_Trực với khung giờ và trạng thái nhận biết được.
5. WHEN dữ liệu Ca_Trực không thay đổi giữa các lần render, THE Lịch_Xem_Theo_Tháng SHALL tránh tính toán lại không cần thiết việc bố trí Ca_Trực theo ngày.
