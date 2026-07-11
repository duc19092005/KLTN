# Đặc tả Use Case

Tài liệu mô tả 70 nghiệp vụ của hệ thống theo góc nhìn BA/DA. Mỗi Use Case được trình bày theo cùng một flow: `Use Case`, `Actor`, `Pre-condition`, `Post-condition`, `Trigger`, `Standard Flow` và các `Alternative`. Mỗi `Alternative` là một edge case lỗi hoặc trường hợp rẽ nhánh cần xử lý riêng.

Tài liệu không mô tả API kỹ thuật. Các thuật ngữ như Blockchain, IPFS, QR, S3, Cloudinary và xác thực khuôn mặt chỉ được giữ lại khi chúng là một phần của nghiệp vụ.

## Nguồn đối chiếu

Tài liệu này được chỉnh theo bảng nghiệp vụ STT 1-70 do khách hàng cung cấp. Tên Use Case, Actor chính và luồng nghiệp vụ ưu tiên theo bảng đó; QĐ/BM dùng để bổ sung điều kiện nghiệp vụ; source code dùng để đối chiếu khả năng hiện có của hệ thống.

Đối chiếu source hiện tại:

| Nhóm nghiệp vụ | Bằng chứng source hiện có |
|---|---|
| AI Model | Backend có `ai-models`; Frontend có `/admin/ai-models` và `/admin/ai-models/trash`. |
| Nhân sự | Backend có `staff`; Frontend có `/admin/staff` và `/admin/staff/trash`. |
| Phòng ban | Backend có `departments`; Frontend có `/admin/departments` và `/admin/departments/trash`. |
| Bác sĩ | Backend có `doctors`; Frontend có `/admin/doctors` và `/admin/doctors/trash`. |
| Nhật kí hệ thống | Backend có `audit`; Frontend có `/admin/audit`. |
| Đặt lịch, QR check-in, bệnh nhân | Backend có `patient/me/appointments`, `appointments/qr/verify`, `appointments/check-in`, `patients`, `visits`; Frontend có khu lễ tân và trang bệnh nhân. |
| Khám bệnh, chỉ định, xét nghiệm, kết luận | Backend có `visits`, `medical-orders`, `clinical-decisions`; Frontend có `/doctor/queue`, `/lab-manager/orders`, `/lab-manager/results`. |
| Xác thực | Backend có `auth`, `patient/auth`; Frontend có `/forgot-password`, `/change-password`, `/authenticate`, `/profile`. |

## Chuẩn edge case hệ thống

Ngoài Alternative riêng của từng Use Case, các lỗi hệ thống dưới đây áp dụng thống nhất cho toàn bộ UC. Khi viết test case hoặc nghiệm thu, mỗi dòng được xem là một edge case độc lập.

| Edge Case | Áp dụng | Mô tả xử lý BA/DA |
|---|---|---|
| E-SYS-01. Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước | Tất cả UC | Hệ thống không ghi/không trả dữ liệu nghiệp vụ, trả thông báo `Lỗi máy chủ nội bộ.` và ghi log lỗi phía server để kỹ thuật xử lý. |
| E-SYS-02. Phiên đăng nhập hết hạn hoặc không hợp lệ | UC yêu cầu đăng nhập | Hệ thống từ chối thao tác và yêu cầu người dùng đăng nhập lại. |
| E-SYS-03. Không đủ quyền theo vai trò | UC có phân quyền | Hệ thống không hiển thị hoặc không cho thao tác với dữ liệu ngoài quyền. |
| E-SYS-04. Dữ liệu không tồn tại hoặc đã bị xóa | UC xem/sửa/xóa/khôi phục | Hệ thống thông báo không tìm thấy bản ghi phù hợp. |
| E-SYS-05. Dữ liệu nhập thiếu hoặc sai định dạng | UC lưu trữ | Hệ thống không lưu thay đổi và yêu cầu người dùng kiểm tra lại trường dữ liệu. |
| E-SYS-06. Trạng thái nghiệp vụ không cho phép chuyển bước | UC lưu trữ theo quy trình | Hệ thống từ chối thao tác để tránh sai quy trình. |
| E-SYS-07. Lỗi Blockchain/audit/IPFS | UC audit hoặc lưu trữ quan trọng | Hệ thống giữ trạng thái chờ hoặc thất bại có kiểm soát, không coi thao tác là hoàn tất khi chưa bảo đảm truy vết. |
| E-SYS-08. Dữ liệu kiểm chứng lệch DB/Blockchain | UC có kiểm chứng | Hệ thống cảnh báo dữ liệu có dấu hiệu bị thay đổi và không cho tiếp tục thao tác rủi ro. |
| E-SYS-09. Lỗi S3/Cloudinary hoặc file không hợp lệ | UC có tệp/ảnh | Hệ thống không nhận file, không tạo public URL cho dữ liệu y tế và yêu cầu tải lại file hợp lệ. |
| E-SYS-10. Lỗi thiết bị ngoài như camera hoặc máy quét QR | UC xác thực khuôn mặt/check-in QR | Hệ thống thông báo thiết bị không khả dụng hoặc dữ liệu quét không hợp lệ và cho phép thực hiện lại. |

## Quản lý mô hình AI

### UC01. Xem Danh sách mô hình AI

| Field | Content |
|---|---|
| Use Case | Xem Danh sách mô hình AI |
| Actor | Admin |
| Pre-condition | Người dùng đã đăng nhập và có quyền truy cập phân hệ mô hình AI. |
| Post-condition | Danh sách mô hình AI được hiển thị theo phạm vi quyền; không hiển thị API key/token. |
| Trigger | Người dùng chọn chức năng xem danh sách mô hình AI. |

**Standard Flow**

1. Người dùng mở phân hệ quản lý hoặc tra cứu mô hình AI.
2. Hệ thống kiểm tra quyền truy cập của người dùng.
3. Hệ thống hiển thị danh sách gồm tên mô hình, phiên bản, nền tảng, loại mô hình, chuyên khoa, trạng thái hoạt động và trạng thái cấu hình khóa.
4. Người dùng xem danh sách để chọn model cần thao tác tiếp theo.

**Alternative 1**

Người dùng chưa đăng nhập hoặc phiên đã hết hạn. Hệ thống yêu cầu đăng nhập lại trước khi hiển thị dữ liệu.

**Alternative 2**

Người dùng không có quyền xem mô hình AI. Hệ thống từ chối truy cập và không hiển thị danh sách.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC02. xem chi tiết mô hình AI

| Field | Content |
|---|---|
| Use Case | xem chi tiết mô hình AI |
| Actor | Admin |
| Pre-condition | Mô hình AI tồn tại trong hệ thống và người dùng có quyền xem chi tiết. |
| Post-condition | Thông tin chi tiết mô hình AI được hiển thị; thông tin bí mật chỉ thể hiện ở dạng đã cấu hình hoặc dấu vân tay nếu có. |
| Trigger | Người dùng chọn một mô hình AI từ danh sách. |

**Standard Flow**

1. Người dùng chọn mô hình AI cần xem.
2. Hệ thống kiểm tra mô hình còn tồn tại và người dùng có quyền xem.
3. Hệ thống hiển thị tên, phiên bản, nền tảng, loại, chuyên khoa, mô tả, địa chỉ kết nối, trạng thái, ngày tạo, lần cập nhật cuối và trạng thái kiểm chứng.
4. Hệ thống không hiển thị API key/token hoặc giá trị bí mật dạng rõ.

**Alternative 1**

Mô hình AI không tồn tại hoặc đã bị xóa. Hệ thống thông báo không tìm thấy dữ liệu phù hợp.

**Alternative 2**

Người dùng không có quyền xem chi tiết. Hệ thống từ chối hiển thị thông tin.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC03. Lọc mô hình AI

| Field | Content |
|---|---|
| Use Case | Lọc mô hình AI |
| Actor | Admin |
| Pre-condition | Người dùng đang ở danh sách mô hình AI. |
| Post-condition | Danh sách được cập nhật theo điều kiện lọc. |
| Trigger | Người dùng nhập từ khóa hoặc chọn điều kiện lọc. |

**Standard Flow**

1. Người dùng nhập từ khóa hoặc chọn nền tảng, loại mô hình, chuyên khoa, trạng thái hoạt động, trạng thái đã xóa.
2. Hệ thống kiểm tra điều kiện lọc.
3. Hệ thống hiển thị danh sách mô hình AI thỏa điều kiện.
4. Người dùng có thể chọn một bản ghi trong kết quả để xem chi tiết.

**Alternative 1**

Điều kiện lọc không hợp lệ. Hệ thống thông báo người dùng kiểm tra lại điều kiện đã nhập.

**Alternative 2**

Không có mô hình AI phù hợp. Hệ thống hiển thị danh sách rỗng và giữ nguyên màn hình lọc.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC04. Sửa mô hình AI

| Field | Content |
|---|---|
| Use Case | Sửa mô hình AI |
| Actor | Admin |
| Pre-condition | Admin đã đăng nhập; mô hình AI tồn tại. |
| Post-condition | Thông tin mô hình AI được cập nhật theo đúng phạm vi cho phép và được ghi nhận lịch sử. |
| Trigger | Admin chọn sửa mô hình AI và xác nhận lưu thay đổi. |

**Standard Flow**

1. Admin chọn mô hình AI cần sửa.
2. Hệ thống hiển thị thông tin hiện tại của mô hình.
3. Admin cập nhật các trường cần thay đổi.
4. Hệ thống kiểm tra mô hình đã từng được sử dụng hoặc đã có đánh giá hay chưa.
5. Nếu chưa có dữ liệu liên quan, hệ thống cho phép cập nhật toàn bộ thông tin hợp lệ.
6. Nếu đã có dữ liệu liên quan, hệ thống chỉ cho phép cập nhật địa chỉ kết nối, thông tin cấu hình bí mật, mô tả và trạng thái hoạt động.
7. Hệ thống lưu thay đổi và ghi nhận lịch sử.

**Alternative 1**

Mô hình đã có dữ liệu sử dụng nhưng Admin cố đổi tên, phiên bản, loại hoặc chuyên khoa. Hệ thống từ chối lưu thay đổi.

**Alternative 2**

Thông tin nhập không hợp lệ hoặc trùng định danh. Hệ thống thông báo lỗi để Admin chỉnh lại.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC05. Đăng ký mô hình AI

| Field | Content |
|---|---|
| Use Case | Đăng ký mô hình AI |
| Actor | Admin |
| Pre-condition | Admin đã đăng nhập và có đủ thông tin mô hình AI cần đăng ký. |
| Post-condition | Mô hình AI mới được tạo và có thể được sử dụng theo trạng thái cấu hình. |
| Trigger | Admin chọn đăng ký mô hình AI và xác nhận tạo mới. |

**Standard Flow**

1. Admin nhập tên mô hình, phiên bản, nền tảng, loại API/IP, chuyên khoa, mô tả, địa chỉ kết nối và thông tin cấu hình cần thiết.
2. Hệ thống kiểm tra các trường bắt buộc.
3. Hệ thống kiểm tra loại mô hình và chuyên khoa có đúng danh mục nghiệp vụ.
4. Hệ thống lưu mô hình AI ở trạng thái phù hợp.
5. Hệ thống ghi nhận lịch sử tạo mới.

**Alternative 1**

Thiếu tên, phiên bản, loại mô hình, chuyên khoa hoặc địa chỉ kết nối. Hệ thống không cho tạo mới.

**Alternative 2**

Thông tin định danh mô hình bị trùng hoặc cấu hình không hợp lệ. Hệ thống thông báo lỗi cho Admin.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC06. Xóa mô hình AI

| Field | Content |
|---|---|
| Use Case | Xóa mô hình AI |
| Actor | Admin |
| Pre-condition | Mô hình AI tồn tại trong hệ thống. |
| Post-condition | Mô hình AI được xử lý xóa theo đúng điều kiện: xóa mềm khi có quan hệ, xóa cứng chỉ khi là dữ liệu rác không có quan hệ. |
| Trigger | Admin chọn xóa mô hình AI và xác nhận. |

**Standard Flow**

1. Admin chọn mô hình AI cần xóa.
2. Hệ thống kiểm tra mô hình có dữ liệu sử dụng, đánh giá hoặc lịch sử liên quan hay không.
3. Nếu có quan hệ nghiệp vụ, hệ thống chuyển mô hình sang trạng thái đã xóa mềm.
4. Nếu không có quan hệ và đủ điều kiện dữ liệu rác, hệ thống cho phép xóa cứng theo quy định.
5. Hệ thống ghi nhận lịch sử xử lý xóa.

**Alternative 1**

Mô hình đang hoạt động hoặc chưa đủ điều kiện xóa. Hệ thống từ chối thao tác.

**Alternative 2**

Mô hình không tồn tại hoặc đã bị xử lý trước đó. Hệ thống thông báo không thể tiếp tục.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC07. Xem danh sách đã xóa

| Field | Content |
|---|---|
| Use Case | Xem danh sách đã xóa |
| Actor | Admin |
| Pre-condition | Admin đã đăng nhập và đang ở phân hệ mô hình AI. |
| Post-condition | Danh sách mô hình AI đã xóa được hiển thị trong đúng phân hệ AI Model. |
| Trigger | Admin chọn danh sách đã xóa của mô hình AI. |

**Standard Flow**

1. Admin mở khu vực mô hình AI đã xóa.
2. Hệ thống kiểm tra quyền quản trị.
3. Hệ thống hiển thị các mô hình đã xóa mềm kèm thời điểm xóa và trạng thái có thể khôi phục.
4. Admin xem dữ liệu để quyết định khôi phục hoặc xóa vĩnh viễn nếu đủ điều kiện.

**Alternative 1**

Không có mô hình AI đã xóa. Hệ thống hiển thị danh sách rỗng.

**Alternative 2**

Admin truy cập sai phân hệ hoặc sai điều kiện trạng thái. Hệ thống không hiển thị dữ liệu ngoài phạm vi.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC08. Khôi phục bản ghi

| Field | Content |
|---|---|
| Use Case | Khôi phục bản ghi |
| Actor | Admin |
| Pre-condition | Mô hình AI đang ở trạng thái đã xóa mềm và còn trong thời hạn khôi phục. |
| Post-condition | Mô hình AI được khôi phục về trạng thái phù hợp, không tự động kích hoạt nếu cần kiểm tra lại. |
| Trigger | Admin chọn khôi phục bản ghi mô hình AI. |

**Standard Flow**

1. Admin mở danh sách mô hình AI đã xóa trong phân hệ AI Model.
2. Admin chọn bản ghi cần khôi phục.
3. Hệ thống kiểm tra trạng thái xóa mềm và thời hạn khôi phục 30 ngày.
4. Hệ thống khôi phục bản ghi về trạng thái phù hợp.
5. Hệ thống ghi nhận lịch sử khôi phục.

**Alternative 1**

Bản ghi không ở trạng thái đã xóa mềm. Hệ thống từ chối khôi phục.

**Alternative 2**

Bản ghi đã quá thời hạn khôi phục. Hệ thống không cho khôi phục theo quy định.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC09. Xóa vĩnh viễn

| Field | Content |
|---|---|
| Use Case | Xóa vĩnh viễn |
| Actor | Admin |
| Pre-condition | Mô hình AI đã xóa mềm và không còn quan hệ nghiệp vụ cần bảo toàn. |
| Post-condition | Mô hình AI được xóa vĩnh viễn khỏi dữ liệu nghiệp vụ hiện hành. |
| Trigger | Admin chọn xóa vĩnh viễn mô hình AI. |

**Standard Flow**

1. Admin chọn mô hình AI đã xóa mềm.
2. Hệ thống kiểm tra mô hình còn liên quan tới chẩn đoán, đánh giá, lịch sử hoặc audit hay không.
3. Nếu không còn quan hệ cần bảo toàn, hệ thống cho phép xóa vĩnh viễn.
4. Hệ thống ghi nhận lịch sử xử lý.

**Alternative 1**

Mô hình còn dữ liệu liên quan. Hệ thống chặn xóa vĩnh viễn để bảo toàn lịch sử.

**Alternative 2**

Mô hình chưa xóa mềm hoặc không tồn tại. Hệ thống từ chối thao tác.

## Quản lý nhân sự, phòng ban và bác sĩ

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC10. Xem danh sách nhân sự

| Field | Content |
|---|---|
| Use Case | Xem danh sách nhân sự |
| Actor | Admin |
| Pre-condition | Admin đã đăng nhập. |
| Post-condition | Danh sách nhân sự được hiển thị theo các trường nghiệp vụ được phép xem. |
| Trigger | Admin chọn quản lý nhân sự. |

**Standard Flow**

1. Admin mở phân hệ nhân sự.
2. Hệ thống kiểm tra quyền quản trị.
3. Hệ thống hiển thị danh sách gồm mã nhân viên, họ tên, email, phòng ban, chức vụ, trạng thái và ghi chú.
4. Admin chọn bản ghi nếu cần xem chi tiết hoặc thao tác tiếp.

**Alternative 1**

Admin chưa đăng nhập hoặc phiên hết hạn. Hệ thống yêu cầu đăng nhập lại.

**Alternative 2**

Không có nhân sự phù hợp với phạm vi hiển thị. Hệ thống hiển thị danh sách rỗng.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC11. Xem chi tiết nhân sự

| Field | Content |
|---|---|
| Use Case | Xem chi tiết nhân sự |
| Actor | Admin |
| Pre-condition | Nhân sự tồn tại trong hệ thống. |
| Post-condition | Hồ sơ nhân sự được hiển thị theo phạm vi được phép. |
| Trigger | Admin chọn một nhân sự từ danh sách. |

**Standard Flow**

1. Admin chọn nhân sự cần xem.
2. Hệ thống kiểm tra bản ghi còn tồn tại.
3. Hệ thống hiển thị mã nhân viên, vai trò, thông tin liên hệ, phòng ban, trạng thái, vị trí, ngày tạo, lần cập nhật cuối và trạng thái kiểm chứng nếu có.
4. Hệ thống không hiển thị mật khẩu.

**Alternative 1**

Nhân sự không tồn tại hoặc đã bị xóa khỏi phạm vi hiện tại. Hệ thống thông báo không tìm thấy.

**Alternative 2**

Người dùng không có quyền xem chi tiết nhân sự. Hệ thống từ chối truy cập.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC12. Lọc danh sách nhân sự

| Field | Content |
|---|---|
| Use Case | Lọc danh sách nhân sự |
| Actor | Admin |
| Pre-condition | Admin đang ở danh sách nhân sự. |
| Post-condition | Danh sách nhân sự được hiển thị theo điều kiện lọc. |
| Trigger | Admin nhập từ khóa hoặc chọn bộ lọc. |

**Standard Flow**

1. Admin nhập từ khóa hoặc chọn phòng ban, vai trò, trạng thái.
2. Hệ thống kiểm tra điều kiện lọc.
3. Hệ thống hiển thị danh sách nhân sự phù hợp.
4. Admin có thể chọn bản ghi để xem hoặc cập nhật.

**Alternative 1**

Điều kiện lọc không hợp lệ. Hệ thống thông báo để Admin kiểm tra lại.

**Alternative 2**

Không có nhân sự phù hợp. Hệ thống hiển thị danh sách rỗng.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC13. Thêm nhân sự

| Field | Content |
|---|---|
| Use Case | Thêm nhân sự |
| Actor | Admin |
| Pre-condition | Admin đã đăng nhập; phòng ban liên quan tồn tại và còn hoạt động. |
| Post-condition | Tài khoản và hồ sơ nhân sự được tạo. |
| Trigger | Admin chọn thêm nhân sự và xác nhận lưu. |

**Standard Flow**

1. Admin nhập thông tin tài khoản, thông tin cá nhân, vai trò, phòng ban và chức vụ.
2. Hệ thống kiểm tra vai trò nhân sự có thuộc nhóm Lễ tân hoặc Kỹ thuật viên cận lâm sàng.
3. Hệ thống kiểm tra username, email, mã nhân viên và CCCD không bị trùng.
4. Hệ thống lưu tài khoản và hồ sơ nhân sự.
5. Hệ thống ghi nhận lịch sử tạo mới.

**Alternative 1**

Vai trò nhân sự không thuộc nhóm được phép. Hệ thống không cho tạo nhân sự.

**Alternative 2**

Username, email, mã nhân viên hoặc CCCD bị trùng. Hệ thống yêu cầu chỉnh lại thông tin.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC14. Sửa thông tin nhân sự

| Field | Content |
|---|---|
| Use Case | Sửa thông tin nhân sự |
| Actor | Admin |
| Pre-condition | Nhân sự tồn tại trong hệ thống. |
| Post-condition | Hồ sơ nhân sự được cập nhật; username và password không bị thay đổi trong chức năng này. |
| Trigger | Admin chọn sửa thông tin nhân sự. |

**Standard Flow**

1. Admin chọn nhân sự cần sửa.
2. Hệ thống hiển thị thông tin hiện tại.
3. Admin cập nhật các trường hồ sơ được phép.
4. Hệ thống kiểm tra dữ liệu nhập và quyền cập nhật.
5. Hệ thống lưu thay đổi và ghi nhận lịch sử.

**Alternative 1**

Admin cố thay đổi username hoặc password trong hồ sơ nhân sự. Hệ thống từ chối lưu phần thay đổi này.

**Alternative 2**

Nhân sự không tồn tại hoặc dữ liệu cập nhật không hợp lệ. Hệ thống thông báo lỗi.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC15. Xóa nhân sự

| Field | Content |
|---|---|
| Use Case | Xóa nhân sự |
| Actor | Admin |
| Pre-condition | Nhân sự tồn tại và không bị khóa bởi điều kiện nghiệp vụ đặc biệt. |
| Post-condition | Nhân sự được xóa mềm hoặc được xử lý theo điều kiện dữ liệu rác. |
| Trigger | Admin chọn xóa nhân sự. |

**Standard Flow**

1. Admin chọn nhân sự cần xóa.
2. Hệ thống kiểm tra nhân sự có quan hệ nghiệp vụ, lịch sử hoặc audit liên quan.
3. Nếu có quan hệ, hệ thống chuyển nhân sự sang trạng thái đã xóa mềm.
4. Nếu không có quan hệ, hệ thống xử lý theo điều kiện xóa dữ liệu rác.
5. Hệ thống ghi nhận lịch sử xóa.

**Alternative 1**

Nhân sự không tồn tại hoặc đã bị xóa. Hệ thống thông báo không thể tiếp tục.

**Alternative 2**

Nhân sự còn dữ liệu bắt buộc bảo toàn. Hệ thống chỉ cho xóa mềm, không cho xóa vĩnh viễn.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC16. Xem danh sách đã xóa

| Field | Content |
|---|---|
| Use Case | Xem danh sách đã xóa |
| Actor | Admin |
| Pre-condition | Admin đang ở phân hệ nhân sự. |
| Post-condition | Danh sách nhân sự đã xóa được hiển thị trong đúng phân hệ nhân sự. |
| Trigger | Admin chọn khu vực nhân sự đã xóa. |

**Standard Flow**

1. Admin mở danh sách nhân sự đã xóa.
2. Hệ thống kiểm tra quyền.
3. Hệ thống hiển thị các nhân sự đã xóa mềm kèm thông tin cần thiết để xem xét khôi phục hoặc xóa vĩnh viễn.

**Alternative 1**

Không có nhân sự đã xóa. Hệ thống hiển thị danh sách rỗng.

**Alternative 2**

Điều kiện trạng thái không hợp lệ. Hệ thống không hiển thị dữ liệu ngoài phạm vi đã xóa.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC17. Khôi phục nhân sự

| Field | Content |
|---|---|
| Use Case | Khôi phục nhân sự |
| Actor | Admin |
| Pre-condition | Nhân sự đã xóa mềm và còn trong thời hạn khôi phục. |
| Post-condition | Nhân sự được khôi phục cùng dữ liệu đi kèm trong phạm vi hợp lệ. |
| Trigger | Admin chọn khôi phục nhân sự. |

**Standard Flow**

1. Admin mở danh sách nhân sự đã xóa.
2. Admin chọn nhân sự cần khôi phục.
3. Hệ thống kiểm tra trạng thái xóa và thời hạn khôi phục.
4. Hệ thống khôi phục hồ sơ nhân sự và dữ liệu đi kèm theo quy định.
5. Hệ thống ghi nhận lịch sử khôi phục.

**Alternative 1**

Nhân sự không ở trạng thái đã xóa mềm. Hệ thống từ chối khôi phục.

**Alternative 2**

Đã quá thời hạn khôi phục. Hệ thống không cho khôi phục.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC18. Xóa vĩnh viễn

| Field | Content |
|---|---|
| Use Case | Xóa vĩnh viễn |
| Actor | Admin |
| Pre-condition | Nhân sự đã xóa mềm và không còn quan hệ nghiệp vụ cần bảo toàn. |
| Post-condition | Bản ghi nhân sự được xóa vĩnh viễn khi đủ điều kiện. |
| Trigger | Admin chọn xóa vĩnh viễn nhân sự. |

**Standard Flow**

1. Admin chọn nhân sự đã xóa mềm.
2. Hệ thống kiểm tra quan hệ với lượt khám, chỉ định, kết quả, tài liệu và audit.
3. Nếu không còn quan hệ cần bảo toàn, hệ thống xóa vĩnh viễn.
4. Hệ thống ghi nhận kết quả xử lý.

**Alternative 1**

Nhân sự còn lịch sử nghiệp vụ hoặc audit. Hệ thống chặn xóa vĩnh viễn.

**Alternative 2**

Nhân sự chưa xóa mềm hoặc không tồn tại. Hệ thống từ chối thao tác.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC19. Xem danh sách phòng ban

| Field | Content |
|---|---|
| Use Case | Xem danh sách phòng ban |
| Actor | Admin |
| Pre-condition | Người dùng đã đăng nhập. |
| Post-condition | Danh sách phòng ban được hiển thị theo phạm vi quyền. |
| Trigger | Người dùng chọn danh sách phòng ban. |

**Standard Flow**

1. Người dùng mở danh sách phòng ban.
2. Hệ thống kiểm tra quyền truy cập.
3. Hệ thống hiển thị mã phòng ban, tên, loại phòng ban, khả năng nhận chỉ định, trạng thái và thông tin vận hành.
4. Người dùng chọn phòng ban nếu cần xem chi tiết hoặc thao tác tiếp.

**Alternative 1**

Người dùng chưa đăng nhập hoặc không có quyền. Hệ thống từ chối truy cập.

**Alternative 2**

Không có phòng ban phù hợp. Hệ thống hiển thị danh sách rỗng.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC20. Lọc phòng ban

| Field | Content |
|---|---|
| Use Case | Lọc phòng ban |
| Actor | Admin |
| Pre-condition | Người dùng đang ở danh sách phòng ban. |
| Post-condition | Danh sách phòng ban được cập nhật theo điều kiện lọc. |
| Trigger | Người dùng nhập từ khóa hoặc chọn bộ lọc. |

**Standard Flow**

1. Người dùng nhập từ khóa hoặc chọn loại phòng ban, trạng thái, khả năng nhận chỉ định.
2. Hệ thống kiểm tra điều kiện lọc.
3. Hệ thống hiển thị danh sách phòng ban phù hợp.

**Alternative 1**

Điều kiện lọc không hợp lệ. Hệ thống yêu cầu kiểm tra lại.

**Alternative 2**

Không có phòng ban phù hợp. Hệ thống hiển thị danh sách rỗng.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC21. Thêm phòng ban

| Field | Content |
|---|---|
| Use Case | Thêm phòng ban |
| Actor | Admin |
| Pre-condition | Admin đã đăng nhập; mã hoặc tên phòng ban chưa tồn tại. |
| Post-condition | Phòng ban mới được tạo và có trạng thái vận hành phù hợp. |
| Trigger | Admin chọn thêm phòng ban. |

**Standard Flow**

1. Admin nhập mã, tên, loại phòng ban, mô tả, trạng thái và khả năng nhận chỉ định cận lâm sàng.
2. Hệ thống kiểm tra loại phòng ban và trường nhận chỉ định.
3. Hệ thống kiểm tra mã hoặc tên phòng ban không trùng.
4. Hệ thống tạo phòng ban mới.
5. Hệ thống ghi nhận lịch sử tạo mới.

**Alternative 1**

Thiếu loại phòng ban hoặc chưa xác định khả năng nhận chỉ định. Hệ thống không cho tạo.

**Alternative 2**

Mã hoặc tên phòng ban bị trùng. Hệ thống yêu cầu thay đổi thông tin.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC22. Sửa phòng ban

| Field | Content |
|---|---|
| Use Case | Sửa phòng ban |
| Actor | Admin |
| Pre-condition | Phòng ban tồn tại trong hệ thống. |
| Post-condition | Thông tin phòng ban được cập nhật theo phạm vi cho phép. |
| Trigger | Admin chọn sửa phòng ban. |

**Standard Flow**

1. Admin chọn phòng ban cần sửa.
2. Hệ thống hiển thị thông tin hiện tại.
3. Admin cập nhật thông tin được phép.
4. Hệ thống kiểm tra phòng ban đã có nhân sự, lượt khám hoặc chỉ định liên quan hay chưa.
5. Nếu đã có dữ liệu liên quan, hệ thống chặn thay đổi các trường lõi như loại phòng ban; chỉ cho cập nhật thông tin được phép như nhân viên hoặc ghi chú vận hành.
6. Hệ thống lưu thay đổi hợp lệ.

**Alternative 1**

Phòng ban đã có dữ liệu liên quan nhưng Admin cố đổi loại phòng ban. Hệ thống từ chối.

**Alternative 2**

Phòng ban không tồn tại hoặc dữ liệu nhập không hợp lệ. Hệ thống thông báo lỗi.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC23. Xem chi tiết phòng ban

| Field | Content |
|---|---|
| Use Case | Xem chi tiết phòng ban |
| Actor | Admin |
| Pre-condition | Phòng ban tồn tại. |
| Post-condition | Thông tin chi tiết phòng ban được hiển thị. |
| Trigger | Admin chọn một phòng ban từ danh sách. |

**Standard Flow**

1. Admin chọn phòng ban cần xem.
2. Hệ thống kiểm tra phòng ban tồn tại.
3. Hệ thống hiển thị mã, tên, loại, trạng thái, khả năng nhận chỉ định, nhân sự liên quan và thông tin cập nhật.
4. Admin xem dữ liệu để quyết định thao tác tiếp theo.

**Alternative 1**

Phòng ban không tồn tại. Hệ thống thông báo không tìm thấy.

**Alternative 2**

Admin không có quyền xem chi tiết. Hệ thống từ chối truy cập.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC24. Xóa phòng ban

| Field | Content |
|---|---|
| Use Case | Xóa phòng ban |
| Actor | Admin |
| Pre-condition | Phòng ban tồn tại. |
| Post-condition | Phòng ban được chuyển về trạng thái phù hợp trước khi xóa mềm; không nhận dữ liệu mới sau khi ngừng hoạt động. |
| Trigger | Admin chọn xóa phòng ban. |

**Standard Flow**

1. Admin chọn phòng ban cần xóa.
2. Hệ thống kiểm tra phòng ban còn hoạt động hoặc còn nhận dữ liệu mới hay không.
3. Nếu phòng ban có dữ liệu liên quan, hệ thống yêu cầu đưa về trạng thái ngừng hoạt động trước khi xóa mềm.
4. Hệ thống ghi nhận trạng thái xóa mềm khi đủ điều kiện.
5. Hệ thống ghi nhận lịch sử xử lý.

**Alternative 1**

Phòng ban đang hoạt động hoặc vẫn nhận chỉ định/lượt khám mới. Hệ thống chặn xóa.

**Alternative 2**

Phòng ban không tồn tại. Hệ thống thông báo không thể xử lý.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC25. Xem danh sách phòng ban đã xóa

| Field | Content |
|---|---|
| Use Case | Xem danh sách phòng ban đã xóa |
| Actor | Admin |
| Pre-condition | Admin đang ở phân hệ phòng ban. |
| Post-condition | Danh sách phòng ban đã xóa được hiển thị trong đúng phân hệ phòng ban. |
| Trigger | Admin chọn danh sách phòng ban đã xóa. |

**Standard Flow**

1. Admin mở khu vực phòng ban đã xóa.
2. Hệ thống kiểm tra quyền.
3. Hệ thống hiển thị các phòng ban đã xóa mềm, thời điểm xóa và trạng thái có thể khôi phục.

**Alternative 1**

Không có phòng ban đã xóa. Hệ thống hiển thị danh sách rỗng.

**Alternative 2**

Điều kiện trạng thái không hợp lệ. Hệ thống không hiển thị dữ liệu ngoài phạm vi.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC26. Khôi phục phòng ban

| Field | Content |
|---|---|
| Use Case | Khôi phục phòng ban |
| Actor | Admin |
| Pre-condition | Phòng ban đã xóa mềm và còn trong thời hạn khôi phục. |
| Post-condition | Phòng ban được khôi phục về trạng thái ngừng hoạt động để kiểm tra trước khi dùng lại. |
| Trigger | Admin chọn khôi phục phòng ban. |

**Standard Flow**

1. Admin mở danh sách phòng ban đã xóa.
2. Admin chọn phòng ban cần khôi phục.
3. Hệ thống kiểm tra thời hạn và trạng thái xóa mềm.
4. Hệ thống khôi phục phòng ban về trạng thái phù hợp.
5. Hệ thống ghi nhận lịch sử khôi phục.

**Alternative 1**

Phòng ban không ở trạng thái đã xóa mềm. Hệ thống từ chối khôi phục.

**Alternative 2**

Đã quá thời hạn khôi phục. Hệ thống không cho khôi phục.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC27. Xóa vĩnh viễn

| Field | Content |
|---|---|
| Use Case | Xóa vĩnh viễn |
| Actor | Admin |
| Pre-condition | Phòng ban đã xóa mềm và không còn quan hệ nghiệp vụ. |
| Post-condition | Phòng ban được xóa vĩnh viễn khi đủ điều kiện. |
| Trigger | Admin chọn xóa vĩnh viễn phòng ban. |

**Standard Flow**

1. Admin chọn phòng ban đã xóa mềm.
2. Hệ thống kiểm tra quan hệ với nhân sự, lượt khám, chỉ định, kết quả và audit.
3. Nếu không còn quan hệ cần bảo toàn, hệ thống xóa vĩnh viễn.
4. Hệ thống ghi nhận kết quả xử lý.

**Alternative 1**

Phòng ban còn dữ liệu liên quan. Hệ thống chặn xóa vĩnh viễn.

**Alternative 2**

Phòng ban chưa xóa mềm hoặc không tồn tại. Hệ thống từ chối thao tác.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC28. Xem danh sách bác sĩ

| Field | Content |
|---|---|
| Use Case | Xem danh sách bác sĩ |
| Actor | Admin |
| Pre-condition | Người dùng đã đăng nhập. |
| Post-condition | Danh sách bác sĩ được hiển thị theo phạm vi quyền. |
| Trigger | Người dùng chọn danh sách bác sĩ. |

**Standard Flow**

1. Người dùng mở danh sách bác sĩ.
2. Hệ thống kiểm tra quyền.
3. Hệ thống hiển thị thông tin bác sĩ như mã, họ tên, chuyên khoa, học vấn, kinh nghiệm, trạng thái và phòng ban liên quan nếu có.
4. Người dùng chọn bác sĩ nếu cần xem chi tiết hoặc thao tác tiếp.

**Alternative 1**

Người dùng không có quyền xem danh sách. Hệ thống từ chối truy cập.

**Alternative 2**

Không có bác sĩ phù hợp. Hệ thống hiển thị danh sách rỗng.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC29. Lọc bác sĩ

| Field | Content |
|---|---|
| Use Case | Lọc bác sĩ |
| Actor | Admin |
| Pre-condition | Người dùng đang ở danh sách bác sĩ. |
| Post-condition | Danh sách bác sĩ được cập nhật theo điều kiện lọc. |
| Trigger | Người dùng nhập từ khóa hoặc chọn bộ lọc. |

**Standard Flow**

1. Người dùng nhập tên, chuyên khoa, trạng thái hoặc điều kiện liên quan.
2. Hệ thống kiểm tra điều kiện lọc.
3. Hệ thống hiển thị bác sĩ phù hợp.

**Alternative 1**

Điều kiện lọc không hợp lệ. Hệ thống yêu cầu kiểm tra lại.

**Alternative 2**

Không có bác sĩ phù hợp. Hệ thống hiển thị danh sách rỗng.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC30. Sửa thông tin bác sĩ

| Field | Content |
|---|---|
| Use Case | Sửa thông tin bác sĩ |
| Actor | Admin |
| Pre-condition | Bác sĩ tồn tại trong hệ thống. |
| Post-condition | Hồ sơ bác sĩ được cập nhật theo các trường cho phép. |
| Trigger | Admin chọn sửa thông tin bác sĩ. |

**Standard Flow**

1. Admin chọn bác sĩ cần sửa.
2. Hệ thống hiển thị hồ sơ hiện tại.
3. Admin cập nhật năm kinh nghiệm, ảnh đại diện, chuyên khoa, số chứng chỉ hành nghề, trình độ học vấn hoặc thông tin được phép.
4. Hệ thống kiểm tra dữ liệu nhập.
5. Hệ thống lưu thay đổi và ghi nhận lịch sử.

**Alternative 1**

Admin cố sửa username hoặc mật khẩu trong chức năng hồ sơ bác sĩ. Hệ thống từ chối.

**Alternative 2**

Dữ liệu chuyên môn không hợp lệ hoặc chứng chỉ bị trùng. Hệ thống không lưu thay đổi.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC31. Thêm bác sĩ

| Field | Content |
|---|---|
| Use Case | Thêm bác sĩ |
| Actor | Admin |
| Pre-condition | Admin đã đăng nhập; thông tin tài khoản và hồ sơ bác sĩ đầy đủ. |
| Post-condition | Tài khoản và hồ sơ bác sĩ được tạo. |
| Trigger | Admin chọn thêm bác sĩ. |

**Standard Flow**

1. Admin nhập thông tin cá nhân, tài khoản, chuyên khoa, học vấn, chứng chỉ hành nghề, kinh nghiệm và ảnh đại diện.
2. Hệ thống kiểm tra các trường bắt buộc.
3. Hệ thống kiểm tra chuyên khoa theo danh mục chuyên môn bác sĩ.
4. Hệ thống kiểm tra username, email và chứng chỉ không trùng.
5. Hệ thống lưu tài khoản và hồ sơ bác sĩ.

**Alternative 1**

Thiếu chuyên khoa, học vấn, chứng chỉ, kinh nghiệm hoặc ảnh đại diện. Hệ thống không cho tạo.

**Alternative 2**

Username, email hoặc chứng chỉ hành nghề bị trùng. Hệ thống yêu cầu chỉnh lại.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC32. Xem chi tiết bác sĩ

| Field | Content |
|---|---|
| Use Case | Xem chi tiết bác sĩ |
| Actor | Admin |
| Pre-condition | Bác sĩ tồn tại trong hệ thống. |
| Post-condition | Hồ sơ chi tiết bác sĩ được hiển thị. |
| Trigger | Người dùng chọn bác sĩ từ danh sách. |

**Standard Flow**

1. Người dùng chọn bác sĩ cần xem.
2. Hệ thống kiểm tra quyền xem.
3. Hệ thống hiển thị thông tin chuyên môn, học vấn, chứng chỉ, kinh nghiệm, ảnh đại diện, trạng thái và lịch sử cập nhật.

**Alternative 1**

Bác sĩ không tồn tại. Hệ thống thông báo không tìm thấy.

**Alternative 2**

Người dùng không có quyền xem chi tiết. Hệ thống từ chối truy cập.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC33. Xóa bác sĩ

| Field | Content |
|---|---|
| Use Case | Xóa bác sĩ |
| Actor | Admin |
| Pre-condition | Bác sĩ tồn tại và đang ở trạng thái đủ điều kiện xử lý. |
| Post-condition | Bác sĩ được xóa mềm khi đủ điều kiện; bác sĩ đang hoạt động không bị xóa. |
| Trigger | Admin chọn xóa bác sĩ. |

**Standard Flow**

1. Admin chọn bác sĩ cần xóa.
2. Hệ thống kiểm tra trạng thái hoạt động của bác sĩ.
3. Hệ thống kiểm tra lịch sử khám, chỉ định, chẩn đoán, kết luận và dữ liệu liên quan.
4. Nếu đủ điều kiện, hệ thống chuyển bác sĩ sang trạng thái đã xóa mềm.
5. Hệ thống ghi nhận lịch sử xóa.

**Alternative 1**

Bác sĩ vẫn đang hoạt động. Hệ thống chặn xóa.

**Alternative 2**

Bác sĩ không tồn tại. Hệ thống thông báo không thể xử lý.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC34. Xem danh sách bác sĩ đã xóa

| Field | Content |
|---|---|
| Use Case | Xem danh sách bác sĩ đã xóa |
| Actor | Admin |
| Pre-condition | Admin đang ở phân hệ bác sĩ. |
| Post-condition | Danh sách bác sĩ đã xóa được hiển thị trong đúng phân hệ bác sĩ. |
| Trigger | Admin chọn danh sách bác sĩ đã xóa. |

**Standard Flow**

1. Admin mở khu vực bác sĩ đã xóa.
2. Hệ thống kiểm tra quyền.
3. Hệ thống hiển thị bác sĩ đã xóa mềm, thời điểm xóa và trạng thái có thể khôi phục.

**Alternative 1**

Không có bác sĩ đã xóa. Hệ thống hiển thị danh sách rỗng.

**Alternative 2**

Điều kiện trạng thái không hợp lệ. Hệ thống không hiển thị dữ liệu ngoài phạm vi.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC35. Khôi phục thông tin bác sĩ

| Field | Content |
|---|---|
| Use Case | Khôi phục thông tin bác sĩ |
| Actor | Admin |
| Pre-condition | Bác sĩ đã xóa mềm và còn trong thời hạn khôi phục. |
| Post-condition | Thông tin bác sĩ và dữ liệu liên quan được khôi phục theo phạm vi hợp lệ. |
| Trigger | Admin chọn khôi phục bác sĩ. |

**Standard Flow**

1. Admin mở danh sách bác sĩ đã xóa.
2. Admin chọn bác sĩ cần khôi phục.
3. Hệ thống kiểm tra trạng thái và thời hạn khôi phục.
4. Hệ thống khôi phục hồ sơ bác sĩ và dữ liệu đi kèm theo quy định.
5. Hệ thống ghi nhận lịch sử khôi phục.

**Alternative 1**

Bác sĩ không ở trạng thái đã xóa mềm. Hệ thống từ chối khôi phục.

**Alternative 2**

Đã quá thời hạn khôi phục. Hệ thống không cho khôi phục.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC36. Xóa vĩnh viễn

| Field | Content |
|---|---|
| Use Case | Xóa vĩnh viễn |
| Actor | Admin |
| Pre-condition | Bác sĩ đã xóa mềm và không còn dữ liệu liên quan. |
| Post-condition | Hồ sơ bác sĩ được xóa vĩnh viễn khi đủ điều kiện. |
| Trigger | Admin chọn xóa vĩnh viễn bác sĩ. |

**Standard Flow**

1. Admin chọn bác sĩ đã xóa mềm.
2. Hệ thống kiểm tra lịch sử khám, chỉ định, kết quả, chẩn đoán, kết luận, tài liệu và audit.
3. Nếu không còn dữ liệu liên quan, hệ thống xóa vĩnh viễn.
4. Hệ thống ghi nhận kết quả xử lý.

**Alternative 1**

Bác sĩ còn dữ liệu liên quan. Hệ thống chặn xóa vĩnh viễn.

**Alternative 2**

Bác sĩ chưa xóa mềm hoặc không tồn tại. Hệ thống từ chối thao tác.

## Nhật kí hệ thống

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC37. Xem danh sách nhật kí hệ thống

| Field | Content |
|---|---|
| Use Case | Xem danh sách nhật kí hệ thống |
| Actor | Admin |
| Pre-condition | Admin đã đăng nhập. |
| Post-condition | Danh sách audit log được hiển thị ở dạng metadata và dữ liệu đã che phần nhạy cảm. |
| Trigger | Admin chọn quản lý nhật kí hệ thống. |

**Standard Flow**

1. Admin mở danh sách nhật kí hệ thống.
2. Hệ thống kiểm tra quyền Admin.
3. Hệ thống hiển thị actor, hành động, thời điểm, entity, batch, trạng thái kiểm chứng và fieldsChanged đã redaction.
4. Hệ thống không hiển thị plaintext bệnh án, thông tin bệnh nhân nhạy cảm, encrypted snapshot, key hoặc bundle IPFS.

**Alternative 1**

Người dùng không phải Admin. Hệ thống từ chối truy cập nhật kí.

**Alternative 2**

Nhật kí cần xem chứa dữ liệu nhạy cảm. Hệ thống chỉ hiển thị nhãn thay đổi đã che, không hiển thị nội dung gốc.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC38. Ghi nhận nhật kí hệ thống

| Field | Content |
|---|---|
| Use Case | Ghi nhận nhật kí hệ thống |
| Actor | Admin |
| Pre-condition | Có nghiệp vụ phát sinh cần ghi nhận hoặc Admin yêu cầu neo các log đang chờ. |
| Post-condition | Audit log được ghi nhận, mã hóa artifact khi tạo batch và neo kiểm chứng theo quy định. |
| Trigger | Nghiệp vụ lưu trữ phát sinh, log Tier A phát sinh, batch Tier B đến thời điểm xử lý hoặc Admin trigger neo thủ công. |

**Standard Flow**

1. Nghiệp vụ phát sinh log sau khi dữ liệu nghiệp vụ được xử lý thành công.
2. Hệ thống ghi nhận audit event và đưa vào hàng chờ xử lý.
3. Hệ thống gom log theo Tier B hoặc đóng ngay khi có Tier A.
4. Hệ thống tạo recovery bundle, mã hóa và đưa artifact audit đã mã hóa lên IPFS.
5. Hệ thống ghi checkpoint gồm root, artifact hash và URI kiểm chứng lên Blockchain.
6. Hệ thống cập nhật trạng thái batch thành đã neo khi hoàn tất.

**Alternative 1**

IPFS chưa upload hoặc pin thành công. Hệ thống giữ batch ở trạng thái chuẩn bị và retry, chưa ghi checkpoint.

**Alternative 2**

Blockchain chưa ghi nhận thành công sau khi IPFS đã sẵn sàng. Hệ thống giữ cùng CID/hash để retry, không tạo artifact khác.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC39. Xem chi tiết nhật kí hệ thống

| Field | Content |
|---|---|
| Use Case | Xem chi tiết nhật kí hệ thống |
| Actor | Admin |
| Pre-condition | Nhật kí tồn tại và Admin có quyền xem. |
| Post-condition | Chi tiết nhật kí được hiển thị ở phạm vi được phép. |
| Trigger | Admin chọn một nhật kí từ danh sách. |

**Standard Flow**

1. Admin chọn nhật kí cần xem.
2. Hệ thống kiểm tra quyền và trạng thái nhật kí.
3. Hệ thống hiển thị metadata, actor, action, thời điểm, batch, hash/proof, trạng thái kiểm chứng và fieldsChanged đã che.
4. Hệ thống không hiển thị nội dung bệnh án nhạy cảm hoặc dữ liệu giải mã.

**Alternative 1**

Nhật kí không tồn tại. Hệ thống thông báo không tìm thấy.

**Alternative 2**

Nhật kí liên quan dữ liệu nhạy cảm. Hệ thống tiếp tục che nội dung nhạy cảm theo quy định.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC40. Lọc danh sách nhật kí hệ thống

| Field | Content |
|---|---|
| Use Case | Lọc danh sách nhật kí hệ thống |
| Actor | Admin |
| Pre-condition | Admin đang ở danh sách nhật kí. |
| Post-condition | Danh sách nhật kí được cập nhật theo điều kiện lọc. |
| Trigger | Admin nhập/chọn điều kiện lọc nhật kí. |

**Standard Flow**

1. Admin nhập actor, action, entity, khoảng thời gian, batch hoặc trạng thái kiểm chứng.
2. Hệ thống kiểm tra điều kiện lọc.
3. Hệ thống hiển thị danh sách nhật kí phù hợp.
4. Dữ liệu nhạy cảm vẫn được che trong kết quả lọc.

**Alternative 1**

Khoảng thời gian hoặc batch không hợp lệ. Hệ thống yêu cầu kiểm tra lại.

**Alternative 2**

Không có nhật kí phù hợp. Hệ thống hiển thị danh sách rỗng.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC41. Phục hồi nhật kí hệ thống

| Field | Content |
|---|---|
| Use Case | Phục hồi nhật kí hệ thống |
| Actor | Admin |
| Pre-condition | Batch audit có dấu hiệu lệch; Admin có quyền và thực hiện xác thực khuôn mặt cho thao tác phục hồi. |
| Post-condition | Chỉ batch lỗi được phục hồi khi DB, Blockchain, IPFS artifact và chuỗi hash đều khớp. |
| Trigger | Admin chọn batch lỗi, nhập lý do và xác nhận phục hồi. |

**Standard Flow**

1. Admin chọn batch có dấu hiệu sai lệch.
2. Hệ thống yêu cầu Admin quét khuôn mặt cho thao tác phục hồi.
3. Hệ thống kiểm tra grant phục hồi gắn với Admin, phiên đăng nhập, batch, lý do và thời hạn.
4. Hệ thống đối chiếu Merkle root trong dữ liệu hiện tại với root trên Blockchain.
5. Nếu lệch, hệ thống tải artifact theo checkpoint, kiểm artifact hash, giải mã nội bộ và tính lại root của bundle.
6. Hệ thống restore vào vùng kiểm tra, xác minh sequence, prevHash, entryHash và số lượng log.
7. Khi toàn bộ kiểm chứng đạt, hệ thống khôi phục transactionally đúng batch bị lỗi.
8. Hệ thống verify từ batch vừa khôi phục đến batch mới nhất và ghi nhận AUDIT_RECOVERY_EXECUTED.

**Alternative 1**

Grant phục hồi thiếu, hết hạn, sai batch, khác phiên hoặc đã dùng. Hệ thống từ chối phục hồi.

**Alternative 2**

Artifact hash, GCM tag, bundle root hoặc chuỗi hash không khớp. Hệ thống dừng phục hồi và không ghi thay đổi.

**Alternative 3**

DB và Blockchain root đã khớp. Hệ thống thông báo không cần phục hồi.

## Bệnh nhân, lịch hẹn và lượt khám

### UC42. Đặt lịch khám Online

| Field | Content |
|---|---|
| Use Case | Đặt lịch khám Online |
| Actor | Bệnh nhân |
| Pre-condition | Bệnh nhân đã xác thực OTP và có hồ sơ bệnh nhân liên kết. |
| Post-condition | Lịch hẹn online được tạo kèm mã QR check-in. |
| Trigger | Bệnh nhân chọn đặt lịch khám online và xác nhận thông tin. |

**Standard Flow**

1. Bệnh nhân chọn hồ sơ bệnh nhân liên kết.
2. Bệnh nhân chọn chuyên khoa, bác sĩ, ngày khám và khung giờ.
3. Hệ thống kiểm tra hồ sơ thuộc tài khoản, bác sĩ còn hoạt động và khung giờ còn trống.
4. Hệ thống tạo lịch hẹn online.
5. Hệ thống cấp mã QR dùng cho check-in.

**Alternative 1**

Hồ sơ bệnh nhân không thuộc tài khoản hiện tại. Hệ thống từ chối đặt lịch.

**Alternative 2**

Bác sĩ hoặc khung giờ không còn khả dụng. Hệ thống yêu cầu chọn lại.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC43. Xem danh sách lịch hẹn

| Field | Content |
|---|---|
| Use Case | Xem danh sách lịch hẹn |
| Actor | Bệnh nhân |
| Pre-condition | Người dùng đã đăng nhập và có quyền xem lịch hẹn. |
| Post-condition | Danh sách lịch hẹn được hiển thị theo phạm vi quyền. |
| Trigger | Người dùng chọn danh sách lịch hẹn. |

**Standard Flow**

1. Người dùng mở danh sách lịch hẹn.
2. Hệ thống kiểm tra phạm vi quyền.
3. Hệ thống hiển thị lịch hẹn với bệnh nhân, bác sĩ, chuyên khoa, ngày giờ, trạng thái và thông tin check-in.

**Alternative 1**

Bệnh nhân yêu cầu xem lịch hẹn không thuộc hồ sơ liên kết. Hệ thống từ chối.

**Alternative 2**

Không có lịch hẹn phù hợp. Hệ thống hiển thị danh sách rỗng.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC44. Xem chi tiết lịch hẹn

| Field | Content |
|---|---|
| Use Case | Xem chi tiết lịch hẹn |
| Actor | Bệnh nhân |
| Pre-condition | Lịch hẹn tồn tại và thuộc phạm vi được phép xem. |
| Post-condition | Chi tiết lịch hẹn được hiển thị. |
| Trigger | Người dùng chọn một lịch hẹn. |

**Standard Flow**

1. Người dùng chọn lịch hẹn cần xem.
2. Hệ thống kiểm tra lịch hẹn thuộc phạm vi quyền.
3. Hệ thống hiển thị thông tin bệnh nhân, bác sĩ, chuyên khoa, ngày giờ, trạng thái, QR và thông tin check-in nếu có.

**Alternative 1**

Lịch hẹn không tồn tại. Hệ thống thông báo không tìm thấy.

**Alternative 2**

Lịch hẹn không thuộc phạm vi người dùng. Hệ thống từ chối hiển thị.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC45. Check-in lượt khám từ lịch hẹn online

| Field | Content |
|---|---|
| Use Case | Check-in lượt khám từ lịch hẹn online |
| Actor | Lễ tân |
| Pre-condition | Có mã QR lịch hẹn hợp lệ và lịch hẹn chưa check-in. |
| Post-condition | Lượt khám được tạo và lịch hẹn được đánh dấu đã check-in. |
| Trigger | Lễ tân quét QR lịch hẹn online. |

**Standard Flow**

1. Lễ tân quét mã QR của bệnh nhân.
2. Hệ thống kiểm tra QR còn hiệu lực, đúng lịch hẹn và chưa sử dụng.
3. Hệ thống kiểm tra lịch hẹn còn hợp lệ để check-in.
4. Hệ thống tạo lượt khám và cập nhật lịch hẹn đã check-in trong cùng một lần xử lý.
5. Hệ thống hiển thị kết quả check-in.

**Alternative 1**

QR sai, hết hạn hoặc không thuộc lịch hẹn hợp lệ. Hệ thống từ chối check-in.

**Alternative 2**

QR đã dùng hoặc lịch hẹn đã check-in trước đó. Hệ thống không tạo lượt khám trùng.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC46. Xem lịch sử khám

| Field | Content |
|---|---|
| Use Case | Xem lịch sử khám |
| Actor | Bệnh nhân |
| Pre-condition | Bệnh nhân đã đăng nhập và có hồ sơ liên kết. |
| Post-condition | Lịch sử khám của hồ sơ liên kết được hiển thị. |
| Trigger | Bệnh nhân chọn lịch sử khám. |

**Standard Flow**

1. Bệnh nhân chọn hồ sơ muốn xem.
2. Hệ thống kiểm tra hồ sơ thuộc tài khoản.
3. Hệ thống hiển thị danh sách lượt khám, ngày khám, bác sĩ, trạng thái và kết quả được phép xem.

**Alternative 1**

Hồ sơ không thuộc tài khoản bệnh nhân. Hệ thống từ chối hiển thị.

**Alternative 2**

Hồ sơ chưa có lượt khám. Hệ thống hiển thị danh sách rỗng.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC47. Xem chi tiết lịch sử khám

| Field | Content |
|---|---|
| Use Case | Xem chi tiết lịch sử khám |
| Actor | Bệnh nhân |
| Pre-condition | Lượt khám thuộc hồ sơ bệnh nhân liên kết. |
| Post-condition | Chi tiết lượt khám được hiển thị theo phạm vi bệnh nhân được xem. |
| Trigger | Bệnh nhân chọn một lượt khám trong lịch sử. |

**Standard Flow**

1. Bệnh nhân chọn lượt khám cần xem.
2. Hệ thống kiểm tra lượt khám thuộc hồ sơ liên kết.
3. Hệ thống hiển thị thông tin khám, chỉ định, kết quả, kết luận và tệp được cấp quyền nếu có.

**Alternative 1**

Lượt khám không thuộc hồ sơ liên kết. Hệ thống từ chối hiển thị.

**Alternative 2**

Lượt khám chưa có kết quả hoặc kết luận. Hệ thống chỉ hiển thị thông tin hiện có.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC48. Xem Danh sách bệnh nhân

| Field | Content |
|---|---|
| Use Case | Xem Danh sách bệnh nhân |
| Actor | Lễ tân |
| Pre-condition | Người dùng đã đăng nhập và có quyền quản lý bệnh nhân. |
| Post-condition | Danh sách bệnh nhân được hiển thị. |
| Trigger | Người dùng chọn danh sách bệnh nhân. |

**Standard Flow**

1. Người dùng mở danh sách bệnh nhân.
2. Hệ thống kiểm tra quyền.
3. Hệ thống hiển thị mã bệnh nhân, họ tên, ngày sinh, giới tính, số điện thoại, CCCD/BHYT nếu được phép và trạng thái hồ sơ.
4. Người dùng chọn bệnh nhân nếu cần xem hoặc đăng ký lượt khám.

**Alternative 1**

Người dùng không có quyền xem danh sách bệnh nhân. Hệ thống từ chối.

**Alternative 2**

Không có bệnh nhân phù hợp. Hệ thống hiển thị danh sách rỗng.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC49. Đăng ký lượt khám

| Field | Content |
|---|---|
| Use Case | Đăng ký lượt khám |
| Actor | Lễ tân |
| Pre-condition | Bệnh nhân đã tồn tại; bác sĩ và phòng ban hợp lệ. |
| Post-condition | Lượt khám được tạo và đưa vào quy trình khám. |
| Trigger | Lễ tân chọn đăng ký lượt khám và xác nhận. |

**Standard Flow**

1. Lễ tân tìm hoặc chọn bệnh nhân đã có trong hệ thống.
2. Lễ tân chọn phòng ban, bác sĩ, ngày khám và thông tin tiếp nhận.
3. Hệ thống kiểm tra bệnh nhân tồn tại, bác sĩ hoạt động và phòng ban hợp lệ.
4. Hệ thống tạo lượt khám.
5. Hệ thống ghi nhận lịch sử nghiệp vụ.

**Alternative 1**

Bệnh nhân chưa tồn tại. Hệ thống yêu cầu tạo hồ sơ bệnh nhân trước khi đăng ký lượt khám.

**Alternative 2**

Bác sĩ hoặc phòng ban không hoạt động/không hợp lệ. Hệ thống từ chối tạo lượt khám.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC50. Thêm hồ sơ bệnh nhân

| Field | Content |
|---|---|
| Use Case | Thêm hồ sơ bệnh nhân |
| Actor | Lễ tân |
| Pre-condition | Thông tin bệnh nhân đầy đủ và chưa bị trùng theo điều kiện định danh. |
| Post-condition | Hồ sơ bệnh nhân mới được tạo. |
| Trigger | Người dùng chọn thêm hồ sơ bệnh nhân. |

**Standard Flow**

1. Người dùng nhập họ tên, ngày sinh, giới tính, số điện thoại, địa chỉ, CCCD/BHYT và thông tin cần thiết.
2. Hệ thống kiểm tra các trường bắt buộc.
3. Hệ thống kiểm tra trùng bệnh nhân theo thông tin định danh.
4. Hệ thống tạo hồ sơ bệnh nhân.
5. Hệ thống ghi nhận lịch sử tạo hồ sơ.

**Alternative 1**

Thiếu thông tin bắt buộc. Hệ thống không cho tạo hồ sơ.

**Alternative 2**

Thông tin định danh bị trùng với bệnh nhân đã có. Hệ thống cảnh báo và không tạo bản ghi trùng.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC51. Tìm kiếm thông tin bệnh nhân

| Field | Content |
|---|---|
| Use Case | Tìm kiếm thông tin bệnh nhân |
| Actor | Lễ tân |
| Pre-condition | Người dùng đã đăng nhập và có quyền tra cứu bệnh nhân. |
| Post-condition | Thông tin bệnh nhân phù hợp được hiển thị. |
| Trigger | Người dùng nhập họ tên, số điện thoại, CCCD hoặc BHYT để tìm kiếm. |

**Standard Flow**

1. Người dùng nhập thông tin tìm kiếm.
2. Hệ thống kiểm tra điều kiện tìm kiếm.
3. Hệ thống hiển thị danh sách bệnh nhân phù hợp.
4. Người dùng chọn bệnh nhân để xem hoặc tiếp tục đăng ký lượt khám.

**Alternative 1**

Điều kiện tìm kiếm quá ngắn hoặc không hợp lệ. Hệ thống yêu cầu nhập lại.

**Alternative 2**

Không tìm thấy bệnh nhân. Hệ thống cho phép chuyển sang tạo hồ sơ mới nếu người dùng có quyền.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC52. Xem danh sách lượt khám

| Field | Content |
|---|---|
| Use Case | Xem danh sách lượt khám |
| Actor | Bác sĩ |
| Pre-condition | Người dùng đã đăng nhập và có quyền xem lượt khám. |
| Post-condition | Danh sách lượt khám được hiển thị theo phạm vi quyền. |
| Trigger | Người dùng chọn danh sách lượt khám. |

**Standard Flow**

1. Người dùng mở danh sách lượt khám.
2. Hệ thống kiểm tra vai trò và phạm vi dữ liệu.
3. Hệ thống hiển thị mã lượt khám, bệnh nhân, bác sĩ, phòng ban, ngày khám và trạng thái.
4. Bác sĩ chỉ thấy lượt khám thuộc phạm vi được phân công.

**Alternative 1**

Người dùng không có quyền xem lượt khám. Hệ thống từ chối.

**Alternative 2**

Không có lượt khám phù hợp. Hệ thống hiển thị danh sách rỗng.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC53. Lọc danh sách lượt khám

| Field | Content |
|---|---|
| Use Case | Lọc danh sách lượt khám |
| Actor | Bác sĩ |
| Pre-condition | Người dùng đang ở danh sách lượt khám. |
| Post-condition | Danh sách lượt khám được cập nhật theo điều kiện lọc. |
| Trigger | Người dùng nhập/chọn điều kiện lọc lượt khám. |

**Standard Flow**

1. Người dùng nhập mã lượt khám, bệnh nhân, bác sĩ, phòng ban, ngày khám hoặc trạng thái.
2. Hệ thống kiểm tra điều kiện lọc và phạm vi quyền.
3. Hệ thống hiển thị kết quả phù hợp.

**Alternative 1**

Điều kiện lọc không hợp lệ. Hệ thống yêu cầu kiểm tra lại.

**Alternative 2**

Bác sĩ lọc dữ liệu ngoài phạm vi được phân công. Hệ thống không hiển thị dữ liệu ngoài quyền.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC54. Xem chi tiết lượt khám

| Field | Content |
|---|---|
| Use Case | Xem chi tiết lượt khám |
| Actor | Bác sĩ |
| Pre-condition | Lượt khám tồn tại và thuộc phạm vi quyền. |
| Post-condition | Chi tiết lượt khám được hiển thị. |
| Trigger | Người dùng chọn một lượt khám. |

**Standard Flow**

1. Người dùng chọn lượt khám cần xem.
2. Hệ thống kiểm tra quyền và phạm vi dữ liệu.
3. Hệ thống hiển thị thông tin bệnh nhân, bác sĩ, phòng ban, trạng thái, chỉ định, kết quả, AI hỗ trợ và kết luận nếu có.

**Alternative 1**

Lượt khám không tồn tại. Hệ thống thông báo không tìm thấy.

**Alternative 2**

Người dùng không có quyền xem lượt khám này. Hệ thống từ chối hiển thị.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC55. Xác nhận lượt khám

| Field | Content |
|---|---|
| Use Case | Xác nhận lượt khám |
| Actor | Bác sĩ được phân công |
| Pre-condition | Lượt khám tồn tại, đúng bác sĩ phụ trách và đang ở trạng thái cho phép xác nhận. |
| Post-condition | Trạng thái lượt khám được cập nhật đúng quy trình. |
| Trigger | Bác sĩ chọn xác nhận lượt khám. |

**Standard Flow**

1. Bác sĩ mở lượt khám được phân công.
2. Bác sĩ chọn xác nhận lượt khám.
3. Hệ thống kiểm tra bác sĩ phụ trách và trạng thái hiện tại.
4. Hệ thống cập nhật trạng thái lượt khám theo quy trình.
5. Hệ thống ghi nhận lịch sử.

**Alternative 1**

Bác sĩ không phải người phụ trách lượt khám. Hệ thống từ chối xác nhận.

**Alternative 2**

Trạng thái lượt khám không cho phép xác nhận. Hệ thống thông báo không thể chuyển trạng thái.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC56. Tạo chỉ định cận lâm sàng

| Field | Content |
|---|---|
| Use Case | Tạo chỉ định cận lâm sàng |
| Actor | Bác sĩ |
| Pre-condition | Lượt khám hợp lệ; phòng ban nhận chỉ định đang hoạt động và có quyền nhận chỉ định. |
| Post-condition | Chỉ định cận lâm sàng được tạo và chuyển tới đơn vị thực hiện. |
| Trigger | Bác sĩ chọn tạo chỉ định cận lâm sàng. |

**Standard Flow**

1. Bác sĩ mở lượt khám phụ trách.
2. Bác sĩ nhập loại chỉ định, phòng ban nhận, ghi chú và thông tin cần thiết.
3. Hệ thống kiểm tra lượt khám, bác sĩ phụ trách và phòng ban nhận chỉ định.
4. Hệ thống tạo chỉ định ở trạng thái chờ xử lý.
5. Hệ thống ghi nhận lịch sử.

**Alternative 1**

Phòng ban nhận chỉ định không hoạt động hoặc không được nhận chỉ định. Hệ thống từ chối tạo.

**Alternative 2**

Bác sĩ không phụ trách lượt khám hoặc lượt khám không hợp lệ. Hệ thống không cho tạo chỉ định.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC57. Xem kết quả cận lâm sàng

| Field | Content |
|---|---|
| Use Case | Xem kết quả cận lâm sàng |
| Actor | Bác sĩ |
| Pre-condition | Kết quả cận lâm sàng tồn tại và người dùng có quyền xem. |
| Post-condition | Kết quả và tệp y tế được hiển thị theo quyền truy cập. |
| Trigger | Người dùng chọn kết quả cận lâm sàng. |

**Standard Flow**

1. Người dùng chọn chỉ định hoặc kết quả cần xem.
2. Hệ thống kiểm tra quyền truy cập.
3. Hệ thống hiển thị kết quả, ghi chú, trạng thái, người thực hiện và tệp y tế được phép xem.
4. Tệp y tế được truy cập theo cơ chế riêng tư, không public trực tiếp.

**Alternative 1**

Người dùng không có quyền xem kết quả. Hệ thống từ chối.

**Alternative 2**

Kết quả hoặc tệp đính kèm không tồn tại. Hệ thống thông báo dữ liệu chưa sẵn sàng.

## Chẩn đoán, xét nghiệm và kết luận

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC58. Hỗ trợ chẩn đoán bằng AI

| Field | Content |
|---|---|
| Use Case | Hỗ trợ chẩn đoán bằng AI |
| Actor | Bác sĩ |
| Pre-condition | Bác sĩ phụ trách lượt khám; mô hình AI hoạt động và phù hợp. |
| Post-condition | Gợi ý AI được lưu gắn với lượt khám, bác sĩ và mô hình AI; không thay thế kết luận cuối. |
| Trigger | Bác sĩ chọn hỗ trợ chẩn đoán bằng AI. |

**Standard Flow**

1. Bác sĩ mở lượt khám phụ trách.
2. Bác sĩ chọn mô hình AI phù hợp và gửi yêu cầu hỗ trợ.
3. Hệ thống kiểm tra quyền bác sĩ, trạng thái lượt khám và trạng thái mô hình.
4. Hệ thống tạo gợi ý chẩn đoán AI.
5. Hệ thống lưu gợi ý để bác sĩ tham khảo.

**Alternative 1**

Bác sĩ không phụ trách lượt khám. Hệ thống từ chối sử dụng AI cho lượt khám đó.

**Alternative 2**

Mô hình AI không hoạt động hoặc không phù hợp chuyên khoa. Hệ thống thông báo để chọn lại.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC59. Đánh giá AI Model

| Field | Content |
|---|---|
| Use Case | Đánh giá AI Model |
| Actor | Bác sĩ |
| Pre-condition | Bác sĩ đã sử dụng AI trong lượt khám tương ứng. |
| Post-condition | Đánh giá mô hình AI được lưu và liên kết đúng lần sử dụng. |
| Trigger | Bác sĩ chọn đánh giá AI Model. |

**Standard Flow**

1. Bác sĩ chọn gợi ý AI đã sử dụng trong lượt khám.
2. Bác sĩ nhập mức đánh giá và nhận xét.
3. Hệ thống kiểm tra gợi ý AI có thuộc bác sĩ và lượt khám tương ứng.
4. Hệ thống lưu đánh giá AI Model.

**Alternative 1**

Bác sĩ chưa từng sử dụng AI trong lượt khám. Hệ thống không cho đánh giá.

**Alternative 2**

Gợi ý AI hoặc mô hình AI không tồn tại. Hệ thống thông báo không thể lưu đánh giá.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC60. Kết luận cuối & đưa lên blockchain

| Field | Content |
|---|---|
| Use Case | Kết luận cuối & đưa lên blockchain |
| Actor | Bác sĩ phụ trách |
| Pre-condition | Lượt khám hợp lệ; bác sĩ phụ trách; các chỉ định bắt buộc đã có kết quả hoặc đã được xử lý hợp lệ. |
| Post-condition | Kết luận cuối được lưu, lượt khám được cập nhật và audit Tier A được ghi nhận. |
| Trigger | Bác sĩ nhập kết luận cuối và xác nhận. |

**Standard Flow**

1. Bác sĩ mở lượt khám phụ trách.
2. Bác sĩ xem dữ liệu khám, gợi ý AI nếu có và kết quả cận lâm sàng.
3. Bác sĩ nhập chẩn đoán cuối, kết luận, hướng xử lý và thông tin cần thiết.
4. Hệ thống kiểm tra điều kiện hoàn tất chỉ định và trạng thái lượt khám.
5. Hệ thống lưu kết luận cuối.
6. Hệ thống ghi nhật kí quan trọng để neo Blockchain ngay theo Tier A.

**Alternative 1**

Bác sĩ không phụ trách lượt khám. Hệ thống từ chối tạo kết luận.

**Alternative 2**

Còn chỉ định bắt buộc chưa có kết quả hoặc chưa được xử lý hợp lệ. Hệ thống chưa cho kết luận cuối.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC61. Xem danh sách cần chờ xét nghiệm

| Field | Content |
|---|---|
| Use Case | Xem danh sách cần chờ xét nghiệm |
| Actor | Lab |
| Pre-condition | Người dùng đã đăng nhập với vai trò phù hợp. |
| Post-condition | Danh sách chỉ định chờ xử lý của đơn vị được hiển thị. |
| Trigger | Quản lý xét nghiệm chọn danh sách chờ xét nghiệm. |

**Standard Flow**

1. Quản lý xét nghiệm mở danh sách chờ.
2. Hệ thống kiểm tra vai trò và đơn vị phụ trách.
3. Hệ thống hiển thị các chỉ định đang chờ xử lý theo phòng ban.
4. Người dùng chọn một chỉ định để nhận hồ sơ hoặc xem thông tin.

**Alternative 1**

Người dùng không có vai trò phù hợp. Hệ thống từ chối truy cập.

**Alternative 2**

Không có chỉ định chờ xử lý. Hệ thống hiển thị danh sách rỗng.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC62. Xem chi tiết yêu cầu xét nghiệm

| Field | Content |
|---|---|
| Use Case | Xem chi tiết yêu cầu xét nghiệm |
| Actor | Lab |
| Pre-condition | Yêu cầu xét nghiệm tồn tại và thuộc đơn vị phụ trách. |
| Post-condition | Chi tiết yêu cầu xét nghiệm được hiển thị. |
| Trigger | Quản lý xét nghiệm chọn một yêu cầu xét nghiệm. |

**Standard Flow**

1. Quản lý xét nghiệm chọn yêu cầu cần xem.
2. Hệ thống kiểm tra yêu cầu thuộc phòng ban phụ trách.
3. Hệ thống hiển thị thông tin bệnh nhân cần thiết, bác sĩ chỉ định, loại xét nghiệm, ghi chú, trạng thái và thời điểm tạo.

**Alternative 1**

Yêu cầu không tồn tại. Hệ thống thông báo không tìm thấy.

**Alternative 2**

Yêu cầu không thuộc đơn vị phụ trách. Hệ thống từ chối hiển thị.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC63. Nhận hồ sơ xét nghiệm

| Field | Content |
|---|---|
| Use Case | Nhận hồ sơ xét nghiệm |
| Actor | Lab |
| Pre-condition | Chỉ định thuộc phòng ban nhận và đang ở trạng thái chờ. |
| Post-condition | Chỉ định được chuyển sang trạng thái đang thực hiện. |
| Trigger | Quản lý xét nghiệm chọn nhận hồ sơ. |

**Standard Flow**

1. Quản lý xét nghiệm chọn chỉ định chờ xử lý.
2. Hệ thống kiểm tra chỉ định thuộc phòng ban phụ trách.
3. Hệ thống kiểm tra trạng thái hiện tại còn cho phép nhận.
4. Hệ thống chuyển chỉ định sang đang thực hiện.
5. Hệ thống ghi nhận lịch sử.

**Alternative 1**

Chỉ định không thuộc phòng ban phụ trách. Hệ thống từ chối nhận.

**Alternative 2**

Chỉ định đã được nhận hoặc đã có kết quả. Hệ thống không cho nhận lại.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC64. Trả kết quả xét nghiệm

| Field | Content |
|---|---|
| Use Case | Trả kết quả xét nghiệm |
| Actor | Lab |
| Pre-condition | Chỉ định đang được thực hiện và chưa có kết quả hoàn tất. |
| Post-condition | Kết quả xét nghiệm được lưu; tệp y tế được lưu ở kho riêng tư. |
| Trigger | Quản lý xét nghiệm nhập kết quả và xác nhận trả kết quả. |

**Standard Flow**

1. Quản lý xét nghiệm mở chỉ định đang thực hiện.
2. Người dùng nhập kết quả, ghi chú và đính kèm tệp nếu có.
3. Hệ thống kiểm tra trạng thái chỉ định và dữ liệu kết quả.
4. Hệ thống lưu kết quả và tệp y tế vào nơi lưu trữ riêng tư phù hợp.
5. Hệ thống chuyển trạng thái kết quả sang sẵn sàng.
6. Hệ thống ghi nhận lịch sử.

**Alternative 1**

Chỉ định chưa được nhận hoặc đã có kết quả hoàn tất. Hệ thống không cho trả kết quả.

**Alternative 2**

Tệp đính kèm sai loại, vượt giới hạn hoặc dữ liệu kết quả không hợp lệ. Hệ thống yêu cầu chỉnh lại.

## Xác thực và tài khoản

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC65. Đăng nhập

| Field | Content |
|---|---|
| Use Case | Đăng nhập |
| Actor | Người dùng hệ thống |
| Pre-condition | Người dùng có phương thức xác thực phù hợp với vai trò. |
| Post-condition | Người dùng có phiên đăng nhập hợp lệ và được chuyển đến khu vực đúng vai trò. |
| Trigger | Người dùng nhập thông tin đăng nhập, kết nối ví hoặc xác thực OTP. |

**Standard Flow**

1. Người dùng mở chức năng đăng nhập.
2. Admin xác thực bằng cơ chế ví/quản trị theo quy định; nhân sự nhập username/password; bệnh nhân xác thực OTP điện thoại.
3. Với Admin và nhân sự, hệ thống yêu cầu quét khuôn mặt sau bước xác thực đầu.
4. Nếu là lần đầu đăng nhập của nhân sự, hệ thống yêu cầu đổi mật khẩu.
5. Hệ thống tạo phiên và chuyển người dùng vào khu vực đúng vai trò.

**Alternative 1**

Thông tin đăng nhập, ví hoặc OTP không đúng. Hệ thống thông báo đăng nhập thất bại.

**Alternative 2**

Xác thực khuôn mặt thất bại hoặc tài khoản bị khóa. Hệ thống không tạo phiên đăng nhập.

**Alternative 3**

Admin đăng nhập lần đầu nhưng thiếu thông tin bí mật/ví quản trị hợp lệ. Hệ thống từ chối kích hoạt.

### UC66. Đăng xuất

| Field | Content |
|---|---|
| Use Case | Đăng xuất |
| Actor | Người dùng hệ thống |
| Pre-condition | Người dùng đang có phiên đăng nhập. |
| Post-condition | Phiên đăng nhập hiện tại bị thu hồi và người dùng quay về trạng thái chưa đăng nhập. |
| Trigger | Người dùng chọn đăng xuất. |

**Standard Flow**

1. Người dùng mở khu vực tài khoản.
2. Người dùng chọn đăng xuất.
3. Hệ thống thu hồi phiên hiện tại.
4. Hệ thống đưa người dùng về màn hình đăng nhập hoặc trang công khai phù hợp.

**Alternative 1**

Phiên đã hết hạn trước khi đăng xuất. Hệ thống vẫn xóa trạng thái đăng nhập ở phía người dùng.

**Alternative 2**

Hệ thống không thể xác nhận phiên hiện tại. Người dùng được yêu cầu đăng nhập lại khi truy cập chức năng bảo vệ.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC67. Quên mật khẩu

| Field | Content |
|---|---|
| Use Case | Quên mật khẩu |
| Actor | Người dùng hệ thống |
| Pre-condition | Tài khoản nhân sự tồn tại và có dữ liệu khuôn mặt đã đăng ký. |
| Post-condition | Mật khẩu mới được thiết lập sau khi xác thực khuôn mặt thành công. |
| Trigger | Nhân sự chọn quên mật khẩu. |

**Standard Flow**

1. Nhân sự chọn quên mật khẩu.
2. Nhân sự nhập tên tài khoản.
3. Hệ thống kiểm tra tài khoản thuộc nhóm được phép đặt lại mật khẩu.
4. Hệ thống yêu cầu quét khuôn mặt.
5. Nhân sự nhập mật khẩu mới và xác nhận mật khẩu.
6. Hệ thống cập nhật mật khẩu mới và yêu cầu đăng nhập lại.

**Alternative 1**

Tên tài khoản không tồn tại hoặc thuộc Admin/bệnh nhân. Hệ thống không cho đặt lại mật khẩu.

**Alternative 2**

Khuôn mặt không khớp hoặc không có dữ liệu khuôn mặt hợp lệ. Hệ thống từ chối đặt lại mật khẩu.

**Alternative 3**

Mật khẩu mới và mật khẩu xác nhận không khớp. Hệ thống yêu cầu nhập lại.

### UC68. Xác thực khuôn mặt

| Field | Content |
|---|---|
| Use Case | Xác thực khuôn mặt |
| Actor | Người dùng hệ thống |
| Pre-condition | Người dùng đã qua bước xác thực đầu hoặc đang thực hiện thao tác yêu cầu xác thực bổ sung. |
| Post-condition | Hệ thống xác nhận đúng người dùng hoặc từ chối thao tác nếu không khớp. |
| Trigger | Hệ thống yêu cầu quét khuôn mặt. |

**Standard Flow**

1. Hệ thống tạo yêu cầu xác thực khuôn mặt cho đúng người dùng và phiên hiện tại.
2. Người dùng bật camera và thực hiện quét khuôn mặt theo hướng dẫn.
3. Hệ thống đối chiếu khuôn mặt với dữ liệu đã đăng ký.
4. Nếu khớp, hệ thống cho phép tiếp tục đăng nhập hoặc thao tác nhạy cảm.
5. Nếu thao tác là phục hồi audit, kết quả xác thực chỉ dùng cho lần thao tác đó.

**Alternative 1**

Camera không khả dụng hoặc không trích xuất được khuôn mặt. Hệ thống yêu cầu thử lại.

**Alternative 2**

Khuôn mặt không khớp hoặc vượt số lần thử. Hệ thống từ chối xác thực.

**Alternative 3**

Yêu cầu xác thực hết hạn, sai phiên hoặc đã dùng. Hệ thống yêu cầu tạo yêu cầu mới.

### UC69. Xem thông tin tài khoản cá nhân

| Field | Content |
|---|---|
| Use Case | Xem thông tin tài khoản cá nhân |
| Actor | Người dùng hệ thống |
| Pre-condition | Người dùng có phiên đăng nhập hợp lệ. |
| Post-condition | Thông tin tài khoản cá nhân được hiển thị theo vai trò. |
| Trigger | Người dùng chọn xem thông tin tài khoản cá nhân. |

**Standard Flow**

1. Người dùng mở khu vực tài khoản cá nhân.
2. Hệ thống kiểm tra phiên đăng nhập.
3. Hệ thống hiển thị thông tin cá nhân, vai trò, trạng thái và thông tin liên hệ được phép.
4. Hệ thống không hiển thị mật khẩu hoặc dữ liệu bí mật.

**Alternative 1**

Phiên đăng nhập hết hạn. Hệ thống yêu cầu đăng nhập lại.

**Alternative 2**

Không tìm thấy hồ sơ tương ứng với tài khoản. Hệ thống thông báo dữ liệu chưa đầy đủ.

**Alternative 3**

Lỗi DB/Prisma hoặc lỗi máy chủ không lường trước. Hệ thống không ghi/không trả dữ liệu nghiệp vụ và hiển thị Lỗi máy chủ nội bộ..

### UC70. đổi mật khẩu

| Field | Content |
|---|---|
| Use Case | đổi mật khẩu |
| Actor | Người dùng hệ thống |
| Pre-condition | Nhân sự biết mật khẩu hiện tại và tài khoản còn hoạt động. |
| Post-condition | Mật khẩu mới được cập nhật và có hiệu lực cho lần đăng nhập sau. |
| Trigger | Nhân sự chọn đổi mật khẩu. |

**Standard Flow**

1. Nhân sự mở chức năng đổi mật khẩu.
2. Nhân sự nhập mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu mới.
3. Hệ thống kiểm tra mật khẩu hiện tại.
4. Hệ thống kiểm tra mật khẩu mới và xác nhận mật khẩu.
5. Hệ thống cập nhật mật khẩu mới.
6. Hệ thống thông báo đổi mật khẩu thành công.

**Alternative 1**

Mật khẩu hiện tại không đúng. Hệ thống từ chối đổi mật khẩu.

**Alternative 2**

Mật khẩu mới không hợp lệ hoặc xác nhận không khớp. Hệ thống yêu cầu nhập lại.

**Alternative 3**

Actor là Admin hoặc bệnh nhân. Hệ thống không áp dụng chức năng đổi mật khẩu này.

## Ghi chú kiểm soát

- UC01-UC70 được mô tả theo tên nghiệp vụ đã chốt.
- Các nghiệp vụ xem và lọc mô tả theo hành vi người dùng, không mô tả theo hướng kỹ thuật.
- Các nghiệp vụ lưu trữ đều có bước kiểm tra điều kiện, lưu thay đổi và ghi nhận lịch sử.
- Các thao tác khôi phục/xóa mềm/xóa vĩnh viễn nằm trong từng phân hệ entity tương ứng, không mô tả thành dashboard thùng rác chung.
- Admin xem audit log không xem plaintext bệnh án, dữ liệu nhạy cảm, encrypted snapshot, key hoặc bundle IPFS.

