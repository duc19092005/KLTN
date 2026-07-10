Exit code: 0
Wall time: 0.9 seconds
Output:
# Quy định nghiệp vụ

| Mã Quy định | Quy định |
|---|---|
| QĐ01 | Khi đăng ký mô hình AI, Admin bắt buộc khai báo tên, phiên bản, chuyên khoa áp dụng, loại mô hình và trạng thái sử dụng. Loại mô hình gồm mô hình tích hợp từ nền tảng ngoài và mô hình nội bộ. |
| QĐ02 | Chuyên khoa áp dụng của AI Model là chuyên môn y khoa, không phải phòng ban vận hành của bệnh viện. |
| QĐ03 | AI Model chưa từng được sử dụng trong chẩn đoán, đánh giá hoặc kết luận có thể được sửa toàn bộ thông tin. |
| QĐ04 | AI Model đã được sử dụng chỉ được cập nhật thông tin cấu hình cần thiết; không được thay đổi tên, phiên bản, loại mô hình hoặc chuyên khoa áp dụng làm sai lệch lịch sử sử dụng. |
| QĐ05 | AI Model đã có dữ liệu liên quan không được xóa cứng. Khi không còn sử dụng, Admin chuyển mô hình sang ngừng hoạt động hoặc xóa mềm. |
| QĐ06 | Đánh giá không tốt về AI Model là căn cứ để ngừng hoạt động hoặc rà soát mô hình, không phải điều kiện để xóa dữ liệu lịch sử. |
| QĐ07 | AI Model xóa mềm được khôi phục trong 30 ngày. Chỉ được xóa vĩnh viễn khi không có dữ liệu liên quan. |
| QĐ08 | Khi thêm nhân sự, Admin bắt buộc xác định nhóm nhân sự: Lễ tân hoặc Kỹ thuật viên cận lâm sàng. |
| QĐ09 | Tên đăng nhập là định danh tài khoản và không được sửa khi cập nhật thông tin nhân sự hoặc bác sĩ. |
| QĐ10 | Mật khẩu không được sửa trong chức năng cập nhật hồ sơ. Nhân sự đổi mật khẩu qua chức năng đổi mật khẩu riêng. |
| QĐ11 | Nhân sự có dữ liệu liên quan chỉ được xóa mềm hoặc chuyển ngừng hoạt động; không được xóa cứng nếu đã phát sinh lịch sử nghiệp vụ hoặc nhật ký. |
| QĐ12 | Nhân sự được khôi phục trong 30 ngày khi tài khoản, phòng ban và vai trò còn hợp lệ; trạng thái sau khôi phục là ngừng hoạt động cho đến khi được kích hoạt riêng. |
| QĐ13 | Khi tạo phòng ban, Admin bắt buộc xác định loại phòng ban và khả năng tiếp nhận chỉ định cận lâm sàng. |
| QĐ14 | Phòng ban đã có nhân sự, lịch khám, chỉ định hoặc dữ liệu liên quan không được thay đổi loại phòng ban; chỉ được cập nhật thông tin vận hành phù hợp. |
| QĐ15 | Phòng ban tạo sai nhưng đã có dữ liệu được chuyển sang ngừng hoạt động, sau đó có thể xóa mềm; phòng ban ngừng hoạt động không được tiếp nhận dữ liệu mới. |
| QĐ16 | Phòng ban đã có dữ liệu được khôi phục trong 30 ngày ở trạng thái ngừng hoạt động; Admin phải kích hoạt lại riêng khi đủ điều kiện vận hành. |
| QĐ17 | Phòng ban chỉ được xóa vĩnh viễn khi không có bất kỳ dữ liệu liên quan nào. |
| QĐ18 | Khi thêm bác sĩ, bắt buộc có chuyên khoa, trình độ học vấn, số chứng chỉ hành nghề, kinh nghiệm và ảnh đại diện. |
| QĐ19 | Bác sĩ đã phát sinh lịch sử khám, chỉ định, chẩn đoán hoặc kết luận chỉ được ngừng hoạt động hoặc xóa mềm; không được xóa vĩnh viễn. |
| QĐ20 | Bác sĩ được khôi phục trong 30 ngày khi hồ sơ chuyên môn, tài khoản và điều kiện công tác còn hợp lệ; trạng thái sau khôi phục là ngừng hoạt động. |
| QĐ21 | Bệnh nhân hoặc người thân chỉ được đặt lịch trực tuyến cho hồ sơ bệnh nhân đã tồn tại và được liên kết hợp lệ; phải chọn chuyên khoa, bác sĩ và khung giờ khám. |
| QĐ22 | Check-in lịch hẹn trực tuyến sử dụng mã QR hợp lệ, chưa được sử dụng và thuộc đúng lịch hẹn của bệnh nhân. |
| QĐ23 | Đăng ký lượt khám, xác nhận khám, tạo chỉ định, nhận xét nghiệm và trả kết quả chỉ được thực hiện khi lượt khám, bệnh nhân, người thực hiện và phòng ban đang ở trạng thái hợp lệ. |
| QĐ24 | AI chỉ hỗ trợ bác sĩ trong chẩn đoán. Kết luận cuối cùng phải do bác sĩ chịu trách nhiệm lập và xác nhận. |
| QĐ25 | Bác sĩ chỉ được đánh giá AI Model sau khi đã sử dụng mô hình đó trong một ca chẩn đoán hợp lệ của mình. |
| QĐ26 | Khi bác sĩ xác nhận kết luận cuối cùng, hệ thống phải ghi nhận nhật ký để bảo đảm khả năng truy vết thay đổi dữ liệu y tế. |
| QĐ27 | Hệ thống tự động ghi nhận nhật ký đối với thao tác tạo, sửa, xóa, khôi phục, xác nhận và thao tác quan trọng. Admin chỉ được yêu cầu đối soát/neo nhật ký, không được tự sửa nội dung lịch sử. |
| QĐ28 | Nhật ký hệ thống chỉ phục hồi khi đã xác thực tính toàn vẹn. Chỉ Admin được thực hiện và phải xác thực bổ sung bằng khuôn mặt. |
| QĐ29 | Admin chỉ xem nhật ký phục vụ quản trị: metadata, thay đổi đã che và trạng thái kiểm chứng; không xem bệnh án, chẩn đoán, đơn thuốc hoặc dữ liệu định danh nhạy cảm. |
| QĐ30 | Nhân sự và Admin phải xác thực khuôn mặt khi đăng nhập. Quên mật khẩu và phục hồi nhật ký hệ thống phải xác thực khuôn mặt. Xóa vĩnh viễn, khôi phục dữ liệu xóa mềm, kích hoạt lại dữ liệu và neo nhật ký thủ công không yêu cầu quét khuôn mặt lại sau khi Admin đã đăng nhập hợp lệ. |
| QĐ31 | Nhân sự bắt buộc đổi mật khẩu khi đăng nhập lần đầu. Admin dùng cơ chế xác thực quản trị riêng; bệnh nhân xác thực OTP qua số điện thoại. |
| QĐ32 | Hồ sơ bệnh án, kết quả xét nghiệm, hình ảnh chẩn đoán và tài liệu y tế phải được lưu trữ riêng tư, chỉ người có thẩm quyền được truy cập. |
| QĐ33 | Ảnh đại diện bác sĩ và nhân sự là dữ liệu không nhạy cảm. Hồ sơ bệnh án, hình ảnh chẩn đoán và tài liệu y tế không được lưu cùng khu vực ảnh đại diện. |
| QĐ34 | Dữ liệu bệnh án và lịch sử điều trị không áp dụng quy tắc xóa sau 30 ngày; thời hạn lưu giữ tuân theo chính sách hồ sơ y tế và pháp luật. |
| QĐ35 | Dữ liệu quản trị không có quan hệ nghiệp vụ hoặc tệp lưu trữ có thể xóa vĩnh viễn. Dữ liệu đã có quan hệ hoặc lịch sử sử dụng phải xóa mềm. Nhật ký hệ thống vẫn được bảo toàn khi bản ghi rác bị xóa vĩnh viễn và không được dùng làm lý do duy nhất để chặn xóa. |
| QĐ36 | Khi sửa bác sĩ chỉ được cập nhật thông tin hồ sơ được phép: chuyên khoa, chứng chỉ, trình độ, kinh nghiệm, ảnh đại diện, thông tin liên hệ và phòng ban công tác hợp lệ. |
| QĐ37 | Admin có thể yêu cầu đối soát hoặc neo nhật ký đang chờ xử lý; hệ thống chỉ xử lý nhật ký do hệ thống tạo và không cho phép sửa nội dung nhật ký. |
| QĐ38 | Khi thêm hồ sơ bệnh nhân phải có họ tên, giới tính, ngày sinh và tối thiểu một phương thức liên hệ; dữ liệu định danh phải được kiểm tra trùng theo chính sách bệnh viện. |
| QĐ39 | Admin lần đầu phải hoàn tất xác thực quản trị bằng thông tin bí mật/ví quản trị do Developer cấp; thông tin bí mật không được lưu dạng rõ. |
| QĐ40 | Khi đăng xuất, hệ thống hủy phiên truy cập hiện tại và ghi nhận thời điểm, lý do đăng xuất trong nhật ký hệ thống. |
| QĐ41 | Quên mật khẩu chỉ áp dụng cho nhân sự theo luồng xác thực bổ sung. Admin và bệnh nhân sử dụng cơ chế xác thực riêng. |
| QĐ42 | Chức năng đổi mật khẩu chỉ áp dụng cho nhân sự; phải xác nhận mật khẩu hiện tại và mật khẩu mới theo chính sách mật khẩu. |
| QĐ43 | Tệp bệnh án, kết quả xét nghiệm, ảnh chẩn đoán và tài liệu y tế lưu trong kho riêng tư AWS S3, có kiểm soát truy cập, kiểm tra loại tệp và liên kết với bản ghi y tế. |
| QĐ44 | Cloudinary chỉ lưu ảnh đại diện bác sĩ/nhân sự; không lưu bệnh án, PII, kết quả xét nghiệm hoặc hình ảnh chẩn đoán. |
| QĐ45 | Bundle nhật ký phục hồi được mã hóa trước khi lưu IPFS; blockchain chỉ lưu thông tin kiểm chứng, không lưu PII hoặc nội dung bệnh án. |
