# Danh sách biểu mẫu nghiệp vụ (BM01 - BM54)

Tài liệu chuẩn hóa 54 biểu mẫu theo đúng thứ tự gốc, trường dữ liệu đang hiển thị và bố cục UI hiện hành. Mỗi BM chỉ có **một bảng**; các trường toàn chiều rộng được gộp ô bằng `colspan`; không đưa nút bấm hoặc cột thao tác vào biểu mẫu.

## Quy ước giá trị

- Trường nhập hoặc chọn được biểu diễn bằng đường kẻ co giãn hết chiều rộng ô.
- Trường xem: dùng dữ liệu mẫu đại diện, đúng kiểu dữ liệu và nhãn đang có trong code.
- Giá trị bí mật: dùng `__________` khi nhập; khi xem chỉ ghi `Đã cấu hình`, không hiển thị bản rõ.
- Thuật ngữ định danh bác sĩ: dùng **Số CCHN**.
- Chỉ ghi trạng thái blockchain tại màn hình UI thực tế có hiển thị trạng thái đó.

## BM01. Xem Danh sách mô hình AI

**Bảng 3-3: Biểu mẫu Xem Danh sách mô hình AI**

|Tên mô hình|Nền tảng|Độ tin cậy|Trạng thái|Phiên bản|Chuyên khoa khuyến nghị|Trạng thái dữ liệu|
|---|---|---|---|---|---|---|
|OpenAI GPT-5.2|ChatGPT / OpenAI|92% (12 đánh giá)|Đang hoạt động|gpt-5.2|Nội tổng quát|Đã xác thực|

## BM02. Xem chi tiết mô hình AI

**Bảng 3-4: Biểu mẫu Xem chi tiết mô hình AI**

<table>
  <tbody>
    <tr>
      <th>Tên mô hình</th>
      <th>Phiên bản</th>
      <th>Nền tảng</th>
    </tr>
    <tr>
      <td>OpenAI GPT-5.2</td>
      <td>gpt-5.2</td>
      <td>ChatGPT / OpenAI</td>
    </tr>
    <tr>
      <th>Chuyên khoa</th>
      <th>Trạng thái</th>
      <th>Độ tin cậy</th>
    </tr>
    <tr>
      <td>Nội tổng quát</td>
      <td>Đang sử dụng</td>
      <td>92% · 12 đánh giá</td>
    </tr>
    <tr>
      <th colspan="3">Mô tả</th>
    </tr>
    <tr>
      <td colspan="3">Mô hình hỗ trợ phân tích dữ liệu lâm sàng tổng quát.</td>
    </tr>
    <tr>
      <th colspan="3">Mã mô hình</th>
    </tr>
    <tr>
      <td colspan="3">2f8fd0d4-6b33-45d4-a412-56c36f37df40</td>
    </tr>
    <tr>
      <th colspan="3">Điểm cuối API</th>
    </tr>
    <tr>
      <td colspan="3">https://api.openai.com/v1/chat/completions</td>
    </tr>
    <tr>
      <th colspan="3">Cấu hình secret</th>
    </tr>
    <tr>
      <td colspan="3">Đã cấu hình</td>
    </tr>
    <tr>
      <th colspan="3">Dấu vân tay SHA-256</th>
    </tr>
    <tr>
      <td colspan="3">8f14e45fceea167a5a36dedd4bea2543…</td>
    </tr>
    <tr>
      <th>Mã hóa khóa</th>
      <th>Blockchain</th>
      <th>Trạng thái dữ liệu</th>
    </tr>
    <tr>
      <td>AES-256</td>
      <td>Đã kích hoạt</td>
      <td>Đã xác thực (VERIFIED)</td>
    </tr>
    <tr>
      <th>Ngày tạo</th>
      <th>Lần cập nhật cuối</th>
      <th>Trạng thái đối chiếu</th>
    </tr>
    <tr>
      <td>15/07/2026 09:30</td>
      <td>02/08/2026 14:20</td>
      <td>Khớp với blockchain</td>
    </tr>
    <tr>
      <th>Hash trong CSDL</th>
      <th>Hash trên chuỗi</th>
      <th>Hash tính lại</th>
    </tr>
    <tr>
      <td>8f14e45f…</td>
      <td>8f14e45f…</td>
      <td>8f14e45f…</td>
    </tr>
  </tbody>
</table>

## BM03. Đăng ký mô hình AI

**Bảng 3-5: Biểu mẫu Đăng ký mô hình AI**

<table>
  <tbody>
    <tr>
      <th>Tên mô hình</th>
      <th>Nền tảng</th>
      <th>Mô hình / ID mô hình</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th colspan="3">Chuyên khoa</th>
    </tr>
    <tr>
      <td colspan="3"><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th colspan="3">Điểm cuối API</th>
    </tr>
    <tr>
      <td colspan="3"><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th colspan="3">Khóa API / Token</th>
    </tr>
    <tr>
      <td colspan="3"><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th colspan="3">Mô tả</th>
    </tr>
    <tr>
      <td colspan="3"><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
  </tbody>
</table>

## BM04. Xem danh sách nhân sự

**Bảng 3-6: Biểu mẫu Xem danh sách nhân sự**

|Họ tên / Email|Phòng ban|Mã nhân viên|Trạng thái|Trạng thái dữ liệu|Vai trò|
|---|---|---|---|---|---|
|Trần Thị Bình · binh.tran@hospital.vn|Khoa Khám bệnh|NV-0002|Đang hoạt động|Đã xác thực|Lễ tân|

## BM05. Xem chi tiết nhân sự

**Bảng 3-7: Biểu mẫu Xem chi tiết nhân sự**

<table>
  <tbody>
    <tr>
      <th>Mã nhân viên</th>
      <th>Vai trò</th>
      <th>Phòng ban</th>
    </tr>
    <tr>
      <td>NV-0002</td>
      <td>Lễ tân</td>
      <td>KB-01 - Khoa Khám bệnh</td>
    </tr>
    <tr>
      <th>Số điện thoại</th>
      <th>CCCD/CMND</th>
      <th>Giới tính</th>
    </tr>
    <tr>
      <td>0901234567</td>
      <td>079203001234</td>
      <td>Nữ</td>
    </tr>
    <tr>
      <th>Ngày sinh</th>
      <th>Tên đăng nhập</th>
      <th>Email</th>
    </tr>
    <tr>
      <td>19/09/2003</td>
      <td>tranthibinh</td>
      <td>binh.tran@hospital.vn</td>
    </tr>
    <tr>
      <th colspan="3">Địa chỉ</th>
    </tr>
    <tr>
      <td colspan="3">12 Nguyễn Văn Bảo, Phường 1, TP. Hồ Chí Minh</td>
    </tr>
    <tr>
      <th>Trạng thái</th>
      <th>Vị trí</th>
      <th>Trạng thái dữ liệu</th>
    </tr>
    <tr>
      <td>Đang hoạt động</td>
      <td>Lễ tân</td>
      <td>Đã xác thực (VERIFIED)</td>
    </tr>
    <tr>
      <th>Ngày tạo</th>
      <th>Lần cập nhật cuối</th>
      <th>Trạng thái đối chiếu</th>
    </tr>
    <tr>
      <td>15/07/2026 09:30</td>
      <td>02/08/2026 14:20</td>
      <td>Khớp với blockchain</td>
    </tr>
    <tr>
      <th>Hash trong CSDL</th>
      <th>Hash trên chuỗi</th>
      <th>Hash tính lại</th>
    </tr>
    <tr>
      <td>d7a8fbb3…</td>
      <td>d7a8fbb3…</td>
      <td>d7a8fbb3…</td>
    </tr>
  </tbody>
</table>

## BM06. Thêm nhân sự

**Bảng 3-8: Biểu mẫu Thêm nhân sự**

<table>
  <tbody>
    <tr>
      <th>Loại nhân sự</th>
      <th>Họ tên</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Tên đăng nhập</th>
      <th>Email</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Số điện thoại</th>
      <th>CCCD/CMND</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Ngày sinh</th>
      <th>Giới tính</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Phòng ban</th>
      <th>Chức danh</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th colspan="2">Địa chỉ</th>
    </tr>
    <tr>
      <td colspan="2"><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
  </tbody>
</table>

## BM07. Xem danh sách phòng ban

**Bảng 3-9: Biểu mẫu Xem danh sách phòng ban**

|Mã / Tên phòng ban|Phụ trách|Tầng|Nhân sự|Trạng thái dữ liệu|Phân loại|
|---|---|---|---|---|---|
|NOI-01 · Khoa Nội tổng quát|BS. Nguyễn Văn An|2A|12 NV|Đã xác thực|Khám bệnh · Không nhận chỉ định · Đang hiện|

## BM08. Thêm phòng ban

**Bảng 3-10: Biểu mẫu Thêm phòng ban**

<table>
  <tbody>
    <tr>
      <th>Mã phòng ban</th>
      <th>Tên phòng ban</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Tầng</th>
      <th>Loại phòng ban</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th colspan="2">Nhận phiếu chỉ định</th>
    </tr>
    <tr>
      <td colspan="2"><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th colspan="2">Mô tả nhiệm vụ</th>
    </tr>
    <tr>
      <td colspan="2"><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
  </tbody>
</table>

## BM09. Xem chi tiết phòng ban

**Bảng 3-11: Biểu mẫu Xem chi tiết phòng ban**

<table>
  <tbody>
    <tr>
      <th>Mã phòng ban</th>
      <th>Tên phòng ban</th>
      <th>Phân loại</th>
    </tr>
    <tr>
      <td>NOI-01</td>
      <td>Khoa Nội tổng quát</td>
      <td>Khám bệnh</td>
    </tr>
    <tr>
      <th>Tầng</th>
      <th>Nhận chỉ định</th>
      <th>Trạng thái</th>
    </tr>
    <tr>
      <td>2A</td>
      <td>Không</td>
      <td>Đang hiện</td>
    </tr>
    <tr>
      <th>Phụ trách</th>
      <th>Số nhân sự</th>
      <th>Trạng thái dữ liệu</th>
    </tr>
    <tr>
      <td>BS. Nguyễn Văn An</td>
      <td>12 NV</td>
      <td>Đã xác thực (VERIFIED)</td>
    </tr>
    <tr>
      <th colspan="3">Trạng thái đối chiếu</th>
    </tr>
    <tr>
      <td colspan="3">Khớp với blockchain</td>
    </tr>
    <tr>
      <th>Hash trong CSDL</th>
      <th>Hash trên chuỗi</th>
      <th>Hash tính lại</th>
    </tr>
    <tr>
      <td>aab32389…</td>
      <td>aab32389…</td>
      <td>aab32389…</td>
    </tr>
  </tbody>
</table>

## BM10. Xem danh sách bác sĩ

**Bảng 3-12: Biểu mẫu Xem danh sách bác sĩ**

|Bác sĩ / Email|Chuyên khoa|Phòng khám|Trạng thái|Trạng thái dữ liệu|Số CCHN|
|---|---|---|---|---|---|
|BS. Nguyễn Văn An · an.nguyen@hospital.vn|Nội tổng quát|Khoa Nội tổng quát|Đang hoạt động|Đã xác thực|CCHN-123456|

## BM11. Thêm bác sĩ

**Bảng 3-13: Biểu mẫu Thêm bác sĩ**

<table>
  <tbody>
    <tr>
      <th>Họ tên</th>
      <th>Tên đăng nhập</th>
      <th>Email</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Số điện thoại</th>
      <th>CCCD/CMND</th>
      <th>Ngày sinh</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Giới tính</th>
      <th>Phòng ban</th>
      <th>Chức danh</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th colspan="3">Địa chỉ</th>
    </tr>
    <tr>
      <td colspan="3"><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Chuyên khoa</th>
      <th colspan="2">Số CCHN</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td colspan="2"><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Trình độ</th>
      <th colspan="2">Số năm kinh nghiệm</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td colspan="2"><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
  </tbody>
</table>

## BM12. Xem chi tiết bác sĩ

**Bảng 3-14: Biểu mẫu Xem chi tiết bác sĩ**

<table>
  <tbody>
    <tr>
      <th>Mã nhân viên</th>
      <th>Vai trò</th>
      <th>Phòng ban</th>
    </tr>
    <tr>
      <td>BS-0001</td>
      <td>Bác sĩ</td>
      <td>NOI-01 - Khoa Nội tổng quát</td>
    </tr>
    <tr>
      <th>Số điện thoại</th>
      <th>CCCD/CMND</th>
      <th>Giới tính</th>
    </tr>
    <tr>
      <td>0912345678</td>
      <td>079205001234</td>
      <td>Nam</td>
    </tr>
    <tr>
      <th>Ngày sinh</th>
      <th>Số CCHN</th>
      <th>Chuyên khoa</th>
    </tr>
    <tr>
      <td>19/09/1985</td>
      <td>CCHN-123456</td>
      <td>Nội tổng quát</td>
    </tr>
    <tr>
      <th colspan="3">Địa chỉ</th>
    </tr>
    <tr>
      <td colspan="3">25 Nguyễn Trãi, Quận 5, TP. Hồ Chí Minh</td>
    </tr>
    <tr>
      <th>Học hàm/Học vị</th>
      <th>Kinh nghiệm</th>
      <th>Phòng khám</th>
    </tr>
    <tr>
      <td>Bác sĩ chuyên khoa I</td>
      <td>10 năm</td>
      <td>Khoa Nội tổng quát</td>
    </tr>
    <tr>
      <th>Ngày tạo hồ sơ</th>
      <th>Lần cập nhật cuối</th>
      <th>Trạng thái dữ liệu</th>
    </tr>
    <tr>
      <td>15/07/2026 09:30</td>
      <td>02/08/2026 14:20</td>
      <td>Đã xác thực (VERIFIED)</td>
    </tr>
    <tr>
      <th colspan="3">Trạng thái đối chiếu</th>
    </tr>
    <tr>
      <td colspan="3">Khớp với blockchain</td>
    </tr>
    <tr>
      <th>Hash trong CSDL</th>
      <th>Hash trên chuỗi</th>
      <th>Hash tính lại</th>
    </tr>
    <tr>
      <td>3b5d5c37…</td>
      <td>3b5d5c37…</td>
      <td>3b5d5c37…</td>
    </tr>
  </tbody>
</table>

## BM13. Xem danh sách nhật kí hệ thống

**Bảng 3-15: Biểu mẫu Xem danh sách nhật kí hệ thống**

|SEQ|Thời điểm|Người thực hiện|Hành động|Danh mục thực thể|Đối tượng|Trạng thái neo|
|---|---|---|---|---|---|---|
|1251|02/08/2026 10:05|Quản trị viên hệ thống|Cập nhật|Bác sĩ|BS. Nguyễn Văn An|Đang chờ neo|

## BM14. Xem chi tiết nhật kí hệ thống

**Bảng 3-16: Biểu mẫu Xem chi tiết nhật kí hệ thống**

<table>
  <tbody>
    <tr>
      <th>Danh mục thực thể</th>
      <th>Người thực thi</th>
      <th>Thời gian hệ thống</th>
    </tr>
    <tr>
      <td>Bác sĩ</td>
      <td>Quản trị viên hệ thống</td>
      <td>02/08/2026 10:05</td>
    </tr>
    <tr>
      <th>Tiêu đề đối tượng</th>
      <th>Vai trò nghiệp vụ</th>
      <th>SEQ</th>
    </tr>
    <tr>
      <td>BS. Nguyễn Văn An</td>
      <td>Quản trị viên</td>
      <td>1251</td>
    </tr>
    <tr>
      <th>Mã định danh Entity ID</th>
      <th>Mã định danh Actor ID</th>
      <th>Trạng thái neo</th>
    </tr>
    <tr>
      <td>6b86b273-ff34-4fce-9d7f-13c78b41d510</td>
      <td>2f8fd0d4-6b33-45d4-a412-56c36f37df40</td>
      <td>Đang chờ neo</td>
    </tr>
    <tr>
      <th colspan="3">Chi tiết bổ sung</th>
    </tr>
    <tr>
      <td colspan="3">Cập nhật hồ sơ bác sĩ</td>
    </tr>
    <tr>
      <th>Current Entry Hash</th>
      <th>Previous Record Hash</th>
      <th>Mốc blockchain</th>
    </tr>
    <tr>
      <td>0x7e57d004…</td>
      <td>0x6b51d431…</td>
      <td>Chưa neo</td>
    </tr>
    <tr>
      <th>Trường thuộc tính</th>
      <th>Dữ liệu trước</th>
      <th>Dữ liệu sau</th>
    </tr>
    <tr>
      <td>Số năm kinh nghiệm</td>
      <td>9</td>
      <td>10</td>
    </tr>
  </tbody>
</table>

## BM15. Đặt lịch khám Online

**Bảng 3-17: Biểu mẫu Đặt lịch khám Online**

<table>
  <tbody>
    <tr>
      <th>Hồ sơ người bệnh</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Chuyên khoa</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Bác sĩ</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Ngày khám</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Khung giờ</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
  </tbody>
</table>

## BM16. Xem danh sách lịch hẹn

**Bảng 3-18: Biểu mẫu Xem danh sách lịch hẹn**

|Mã lịch hẹn|Phòng khám / Thời gian khám|Bác sĩ|Trạng thái|Mã QR check-in|
|---|---|---|---|---|
|LH-20260802-001|Khoa Nội tổng quát · 08:30 03/08/2026|BS. Nguyễn Văn An|Đã xác nhận|Đã tạo|

## BM17. Xem chi tiết lịch hẹn

**Bảng 3-19: Biểu mẫu Xem chi tiết lịch hẹn**

<table>
  <tbody>
    <tr>
      <th>Mã lịch hẹn</th>
      <th>Trạng thái</th>
    </tr>
    <tr>
      <td>LH-20260802-001</td>
      <td>Đã xác nhận</td>
    </tr>
    <tr>
      <th>Họ tên bệnh nhân</th>
      <th>Mã bệnh nhân</th>
    </tr>
    <tr>
      <td>Lê Văn Cường</td>
      <td>BN-000123</td>
    </tr>
    <tr>
      <th>Phòng khám</th>
      <th>Bác sĩ phụ trách</th>
    </tr>
    <tr>
      <td>Khoa Nội tổng quát</td>
      <td>BS. Nguyễn Văn An</td>
    </tr>
    <tr>
      <th>Ngày đăng ký khám</th>
      <th>Giờ đăng ký khám</th>
    </tr>
    <tr>
      <td>03/08/2026</td>
      <td>08:30</td>
    </tr>
    <tr>
      <th colspan="2">Mã QR check-in</th>
    </tr>
    <tr>
      <td colspan="2">Đã tạo</td>
    </tr>
  </tbody>
</table>

## BM18. Xem lịch sử khám

**Bảng 3-20: Biểu mẫu Xem lịch sử khám**

|Mã lượt khám|Ngày khám|Bác sĩ phụ trách|Phòng khám|Chẩn đoán|Trạng thái|
|---|---|---|---|---|---|
|LK-20260701-001|01/07/2026|BS. Nguyễn Văn An|Khoa Nội tổng quát|Tăng huyết áp|Hoàn tất|

## BM19. Xem chi tiết lịch sử khám

**Bảng 3-21: Biểu mẫu Xem chi tiết lịch sử khám**

|Mã lượt khám|Ngày khám|
|---|---|
|LK-20260701-001|01/07/2026|
|Bệnh nhân|Bác sĩ phụ trách|
|Lê Văn Cường · BN-000123|BS. Nguyễn Văn An|
|Triệu chứng|Chẩn đoán cuối|
|Đau đầu, chóng mặt|Tăng huyết áp|
|Chỉ định cận lâm sàng|Hướng điều trị|
|Điện tâm đồ|Điều trị ngoại trú|

## BM20. Xem Danh sách bệnh nhân

**Bảng 3-22: Biểu mẫu Xem Danh sách bệnh nhân**

|Bệnh nhân|Số CCCD|Số điện thoại|Lượt khám|Trạng thái gần nhất|
|---|---|---|---|---|
|Lê Văn Cường · BN-000123|079090001234|0901234567|3 lượt|Đang khám|

## BM21. Đăng ký lượt khám

**Bảng 3-23: Biểu mẫu Đăng ký lượt khám**

<table>
  <tbody>
    <tr>
      <th>Bệnh nhân</th>
    </tr>
    <tr>
      <td>Lê Văn Cường · BN-000123</td>
    </tr>
    <tr>
      <th>Từ khóa chuyên khoa, triệu chứng hoặc phòng khám</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Phòng khám tiếp nhận</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Bác sĩ phụ trách</th>
    </tr>
    <tr>
      <td>BS. Nguyễn Văn An</td>
    </tr>
  </tbody>
</table>

## BM22. Thêm hồ sơ bệnh nhân

**Bảng 3-24: Biểu mẫu Thêm hồ sơ bệnh nhân**

<table>
  <tbody>
    <tr>
      <th>Họ và tên</th>
      <th>Giới tính</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Ngày sinh</th>
      <th>Số CCCD (12 số)</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Số điện thoại</th>
      <th>Mã thẻ BHYT (10 số)</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th colspan="2">Địa chỉ cư trú</th>
    </tr>
    <tr>
      <td colspan="2"><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th colspan="2">SĐT người thân khẩn cấp</th>
    </tr>
    <tr>
      <td colspan="2"><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
  </tbody>
</table>

## BM23. Xem danh sách lượt khám

**Bảng 3-25: Biểu mẫu Xem danh sách lượt khám**

|Bệnh nhân|Mã lượt|Phòng khám|Giờ tiếp nhận|Trạng thái|
|---|---|---|---|---|
|Lê Văn Cường · BN-000123|LK-20260802-001|Khoa Nội tổng quát|08:15|Chờ khám|

## BM24. Xem chi tiết lượt khám

**Bảng 3-26: Biểu mẫu Xem chi tiết lượt khám**

|Mã lượt khám|Trạng thái|
|---|---|
|LK-20260802-001|Đang khám|
|Bệnh nhân|Mã bệnh nhân|
|Lê Văn Cường|BN-000123|
|Phòng khám|Bác sĩ phụ trách|
|Khoa Nội tổng quát|BS. Nguyễn Văn An|
|Thời điểm tiếp nhận|Nguồn tiếp nhận|
|02/08/2026 08:15|Lễ tân|

## BM25. Tạo chỉ định cận lâm sàng

**Bảng 3-27: Biểu mẫu Tạo chỉ định cận lâm sàng**

<table>
  <tbody>
    <tr>
      <th>Khoa / Phòng thực hiện</th>
      <th>Tên / Loại chỉ định</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th colspan="2">Ghi chú lâm sàng cho KTV</th>
    </tr>
    <tr>
      <td colspan="2"><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
  </tbody>
</table>

## BM26. Hỗ trợ chẩn đoán bằng AI

**Bảng 3-28: Biểu mẫu Hỗ trợ chẩn đoán bằng AI**

<table>
  <tbody>
    <tr>
      <th>Mô hình AI</th>
      <th>Độ tin cậy</th>
    </tr>
    <tr>
      <td>OpenAI GPT-5.2</td>
      <td>92%</td>
    </tr>
    <tr>
      <th colspan="2">Tổng quan lâm sàng</th>
    </tr>
    <tr>
      <td colspan="2">Triệu chứng và dữ liệu hiện có phù hợp với viêm đường hô hấp trên.</td>
    </tr>
    <tr>
      <th colspan="2">Phát hiện trên ảnh y khoa</th>
    </tr>
    <tr>
      <td colspan="2">X-quang ngực chưa ghi nhận tổn thương cấp tính.</td>
    </tr>
    <tr>
      <th colspan="2">Khả năng chẩn đoán</th>
    </tr>
    <tr>
      <td colspan="2">Viêm đường hô hấp trên: 72%; Viêm phế quản: 18%; Khác: 10%.</td>
    </tr>
    <tr>
      <th>Cân nhắc lâm sàng</th>
      <th>Cảnh báo rủi ro</th>
    </tr>
    <tr>
      <td>Theo dõi diễn tiến triệu chứng và kết hợp khám trực tiếp.</td>
      <td>Cần loại trừ khó thở tăng dần hoặc SpO₂ giảm.</td>
    </tr>
  </tbody>
</table>

## BM27. Đánh giá AI Model

**Bảng 3-29: Biểu mẫu Đánh giá AI Model**

<table>
  <tbody>
    <tr>
      <th>Mô hình AI</th>
      <th>Mức độ hài lòng</th>
    </tr>
    <tr>
      <td>OpenAI GPT-5.2</td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th colspan="2">Lý do mô hình đánh giá chưa chuẩn xác</th>
    </tr>
    <tr>
      <td colspan="2"><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
  </tbody>
</table>

## BM28. Kết luận cuối & đưa lên blockchain

**Bảng 3-30: Biểu mẫu Kết luận cuối & đưa lên blockchain**

<table>
  <tbody>
    <tr>
      <th colspan="2">Chẩn đoán xác định</th>
    </tr>
    <tr>
      <td colspan="2"><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Hướng điều trị</th>
      <th>Toa thuốc (Kê đơn)</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Lời dặn / Hẹn tái khám</th>
      <th>Ghi chú ẩn (Nội bộ BS)</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
  </tbody>
</table>

## BM29. Xem danh sách cần chờ xét nghiệm

**Bảng 3-31: Biểu mẫu Xem danh sách cần chờ xét nghiệm**

|Mã phiếu|Bệnh nhân|Loại chỉ định|Trạng thái|
|---|---|---|---|
|CD-20260802-001|Lê Văn Cường · BN-000123|Xét nghiệm công thức máu|Chờ thực hiện|

## BM30. Trả kết quả xét nghiệm

**Bảng 3-32: Biểu mẫu Trả kết quả xét nghiệm**

<table>
  <tbody>
    <tr>
      <th>Bệnh nhân</th>
      <th>Nhận xét / Kết luận</th>
    </tr>
    <tr>
      <td>Lê Văn Cường · Mã BN: BN-000123</td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Mã lượt khám</th>
      <th>Tệp kết quả (PDF, JPG, PNG)</th>
    </tr>
    <tr>
      <td>LK-20260802-001</td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th colspan="2">Ghi chú từ bác sĩ</th>
    </tr>
    <tr>
      <td colspan="2">Nghi ngờ thiếu máu, đề nghị kiểm tra công thức máu.</td>
    </tr>
  </tbody>
</table>

## BM31. Sửa mô hình AI

**Bảng 3-33: Biểu mẫu Sửa mô hình AI**

<table>
  <tbody>
    <tr>
      <th>Tên mô hình</th>
      <th>Nền tảng</th>
      <th>Mô hình / ID mô hình</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th colspan="3">Chuyên khoa</th>
    </tr>
    <tr>
      <td colspan="3"><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th colspan="3">Điểm cuối API</th>
    </tr>
    <tr>
      <td colspan="3"><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th colspan="3">Khóa API / Token (để trống nếu giữ secret hiện tại)</th>
    </tr>
    <tr>
      <td colspan="3"><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th colspan="3">Mô tả</th>
    </tr>
    <tr>
      <td colspan="3"><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
  </tbody>
</table>

## BM32. Xóa mô hình AI

**Bảng 3-34: Biểu mẫu Xóa mô hình AI**

|Tên mô hình|Phiên bản / Nền tảng|Thời điểm xóa|
|---|---|---|
|OpenAI GPT-5.2|gpt-5.2 · ChatGPT / OpenAI|02/08/2026 15:00|

## BM33. Khôi phục bản ghi

**Bảng 3-35: Biểu mẫu Khôi phục bản ghi**

|Tên mô hình|Phiên bản / Nền tảng|Thời điểm xóa|
|---|---|---|
|OpenAI GPT-4.1|gpt-4.1 · ChatGPT / OpenAI|02/08/2026 15:00|

## BM34. Xóa vĩnh viễn

**Bảng 3-36: Biểu mẫu Xóa vĩnh viễn**

|Tên mô hình|Phiên bản / Nền tảng|Thời điểm xóa|
|---|---|---|
|OpenAI GPT-4.1|gpt-4.1 · ChatGPT / OpenAI|02/08/2026 15:00|

## BM35. Sửa thông tin nhân sự

**Bảng 3-37: Biểu mẫu Sửa thông tin nhân sự**

<table>
  <tbody>
    <tr>
      <th>Loại nhân sự</th>
      <th>Họ tên</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Tên đăng nhập</th>
      <th>Email</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Số điện thoại</th>
      <th>CCCD/CMND</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Ngày sinh</th>
      <th>Giới tính</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Phòng ban</th>
      <th>Chức danh</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th colspan="2">Địa chỉ</th>
    </tr>
    <tr>
      <td colspan="2"><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
  </tbody>
</table>

## BM36. Xóa nhân sự

**Bảng 3-38: Biểu mẫu Xóa nhân sự**

|Họ tên|Mã nhân viên / Email|Thời điểm xóa|
|---|---|---|
|Trần Thị Bình|NV-0002 · binh.tran@hospital.vn|02/08/2026 15:05|

## BM37. Khôi phục nhân sự

**Bảng 3-39: Biểu mẫu Khôi phục nhân sự**

|Họ tên|Mã nhân viên / Email|Thời điểm xóa|
|---|---|---|
|Trần Thị Bình|NV-0002 · binh.tran@hospital.vn|02/08/2026 15:05|

## BM38. Xóa vĩnh viễn

**Bảng 3-40: Biểu mẫu Xóa vĩnh viễn**

|Họ tên|Mã nhân viên / Email|Thời điểm xóa|
|---|---|---|
|Trần Thị Bình|NV-0002 · binh.tran@hospital.vn|02/08/2026 15:05|

## BM39. Sửa phòng ban

**Bảng 3-41: Biểu mẫu Sửa phòng ban**

<table>
  <tbody>
    <tr>
      <th>Mã phòng ban</th>
      <th>Tên phòng ban</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Tầng</th>
      <th>Loại phòng ban</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th colspan="2">Nhận phiếu chỉ định</th>
    </tr>
    <tr>
      <td colspan="2"><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th colspan="2">Mô tả nhiệm vụ</th>
    </tr>
    <tr>
      <td colspan="2"><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
  </tbody>
</table>

## BM40. Xóa phòng ban

**Bảng 3-42: Biểu mẫu Xóa phòng ban**

|Tên phòng ban|Mã phòng ban / Phân loại|Thời điểm xóa|
|---|---|---|
|Khoa Nội tổng quát|NOI-01 · Khám bệnh|02/08/2026 15:15|

## BM41. Khôi phục phòng ban

**Bảng 3-43: Biểu mẫu Khôi phục phòng ban**

|Tên phòng ban|Mã phòng ban / Phân loại|Thời điểm xóa|
|---|---|---|
|Khoa Nội tổng quát|NOI-01 · Khám bệnh|02/08/2026 15:15|

## BM42. Xóa vĩnh viễn

**Bảng 3-44: Biểu mẫu Xóa vĩnh viễn**

|Tên phòng ban|Mã phòng ban / Phân loại|Thời điểm xóa|
|---|---|---|
|Khoa Nội tổng quát|NOI-01 · Khám bệnh|02/08/2026 15:15|

## BM43. Sửa thông tin bác sĩ

**Bảng 3-45: Biểu mẫu Sửa thông tin bác sĩ**

<table>
  <tbody>
    <tr>
      <th>Họ tên</th>
      <th>Tên đăng nhập</th>
      <th>Email</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Số điện thoại</th>
      <th>CCCD/CMND</th>
      <th>Ngày sinh</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Giới tính</th>
      <th>Phòng ban</th>
      <th>Chức danh</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th colspan="3">Địa chỉ</th>
    </tr>
    <tr>
      <td colspan="3"><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Chuyên khoa</th>
      <th colspan="2">Số CCHN</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td colspan="2"><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Trình độ</th>
      <th colspan="2">Số năm kinh nghiệm</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
      <td colspan="2"><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
  </tbody>
</table>

## BM44. Xóa bác sĩ

**Bảng 3-46: Biểu mẫu Xóa bác sĩ**

|Họ tên|Mã nhân viên / Số CCHN|Thời điểm xóa|
|---|---|---|
|BS. Nguyễn Văn An|BS-0001 · CCHN-123456|02/08/2026 15:10|

## BM45. Khôi phục thông tin bác sĩ

**Bảng 3-47: Biểu mẫu Khôi phục thông tin bác sĩ**

|Họ tên|Mã nhân viên / Số CCHN|Thời điểm xóa|
|---|---|---|
|BS. Nguyễn Văn An|BS-0001 · CCHN-123456|02/08/2026 15:10|

## BM46. Xóa vĩnh viễn

**Bảng 3-48: Biểu mẫu Xóa vĩnh viễn**

|Họ tên|Mã nhân viên / Số CCHN|Thời điểm xóa|
|---|---|---|
|BS. Nguyễn Văn An|BS-0001 · CCHN-123456|02/08/2026 15:10|

## BM47. Ghi nhận nhật kí hệ thống

**Bảng 3-49: Biểu mẫu Ghi nhận nhật kí hệ thống**

|Số lô|Khoảng SEQ|Số bản ghi|Merkle root|Thời gian neo|Trạng thái|
|---|---|---|---|---|---|
|#42|1201 - 1250|50|0x7e57d004…|02/08/2026 10:00|Đã neo|

## BM48. Phục hồi nhật kí hệ thống

**Bảng 3-50: Biểu mẫu Phục hồi nhật kí hệ thống**

<table>
  <tbody>
    <tr>
      <th>Đối tượng được chọn</th>
      <th>Mốc khôi phục</th>
    </tr>
    <tr>
      <td>Bác sĩ · BS-0001</td>
      <td>Lô #42 · SEQ 1248</td>
    </tr>
    <tr>
      <th colspan="2">Lý do khôi phục</th>
    </tr>
    <tr>
      <td colspan="2"><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th colspan="2">Khuôn mặt Admin xác nhận</th>
    </tr>
    <tr>
      <td colspan="2"><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
  </tbody>
</table>

## BM49. Check-in lượt khám từ lịch hẹn online

**Bảng 3-51: Biểu mẫu Check-in lượt khám từ lịch hẹn online**

<table>
  <tbody>
    <tr>
      <th>Bệnh nhân</th>
      <th>Mã bệnh nhân</th>
    </tr>
    <tr>
      <td>Lê Văn Cường</td>
      <td>BN-000123</td>
    </tr>
    <tr>
      <th>Ngày sinh</th>
      <th>Số CCCD</th>
    </tr>
    <tr>
      <td>19/09/1990</td>
      <td>079090001234</td>
    </tr>
    <tr>
      <th>Số điện thoại</th>
      <th>Mã lịch hẹn</th>
    </tr>
    <tr>
      <td>0901234567</td>
      <td>LH-20260802-001</td>
    </tr>
    <tr>
      <th>Phòng khám</th>
      <th>Bác sĩ phụ trách</th>
    </tr>
    <tr>
      <td>Khoa Nội tổng quát</td>
      <td>BS. Nguyễn Văn An</td>
    </tr>
    <tr>
      <th>Ngày đăng ký khám</th>
      <th>Giờ đăng ký khám</th>
    </tr>
    <tr>
      <td>03/08/2026</td>
      <td>08:30</td>
    </tr>
    <tr>
      <th colspan="2">Trạng thái xác minh</th>
    </tr>
    <tr>
      <td colspan="2">Mã QR hợp lệ</td>
    </tr>
  </tbody>
</table>

## BM50. Xác nhận lượt khám

**Bảng 3-52: Biểu mẫu Xác nhận lượt khám**

|Mã lượt khám|Trạng thái|
|---|---|
|LK-20260802-001|Chờ khám|
|Bệnh nhân|Mã bệnh nhân|
|Lê Văn Cường|BN-000123|
|Phòng khám|Bác sĩ phụ trách|
|Khoa Nội tổng quát|BS. Nguyễn Văn An|
|Thời điểm tiếp nhận|Nguồn tiếp nhận|
|02/08/2026 08:15|Lịch hẹn trực tuyến|

## BM51. Nhận hồ sơ xét nghiệm

**Bảng 3-53: Biểu mẫu Nhận hồ sơ xét nghiệm**

|Mã phiếu|Bệnh nhân|Loại chỉ định|Trạng thái|
|---|---|---|---|
|CD-20260802-001|Lê Văn Cường · BN-000123|Xét nghiệm công thức máu|Chờ thực hiện|

## BM52. Đăng xuất

**Bảng 3-54: Biểu mẫu Đăng xuất**

|Tài khoản|Vai trò|
|---|---|
|nguyenvanan|Bác sĩ|
|Phiên đăng nhập|Trạng thái|
|Đang hoạt động|Sẵn sàng đăng xuất|

## BM53. Quên mật khẩu

**Bảng 3-55: Biểu mẫu Quên mật khẩu**

<table>
  <tbody>
    <tr>
      <th>Tên đăng nhập hoặc email</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Khuôn mặt khôi phục mật khẩu</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Mật khẩu mới</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Xác nhận mật khẩu mới</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
  </tbody>
</table>

## BM54. Đổi mật khẩu

**Bảng 3-56: Biểu mẫu Đổi mật khẩu**

<table>
  <tbody>
    <tr>
      <th>Mật khẩu hiện tại</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Mật khẩu mới</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
    <tr>
      <th>Nhập lại mật khẩu mới</th>
    </tr>
    <tr>
      <td><span style="display:block;width:100%;border-bottom:1px solid currentColor;height:1.2em;"> </span></td>
    </tr>
  </tbody>
</table>
