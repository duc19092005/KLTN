# CHƯƠNG 5. KẾT QUẢ ĐẠT ĐƯỢC

## 5.1. Giao diện và sản phẩm thực tế

Sau quá trình phân tích, thiết kế và xây dựng, đề tài đã hoàn thiện một hệ thống quản lý bệnh viện theo mô hình web, kết hợp thêm ứng dụng di động dành cho bệnh nhân. Hệ thống được chia theo đúng nhóm người dùng trong thực tế gồm Quản trị viên, Lễ tân, Bác sĩ, Kỹ thuật viên cận lâm sàng và Bệnh nhân. Mỗi nhóm chỉ nhìn thấy các chức năng phù hợp với nhiệm vụ của mình, giúp thao tác rõ ràng hơn và hạn chế truy cập nhầm vào dữ liệu nhạy cảm.

Giao diện web được xây dựng bằng React, Vite và Tailwind CSS. Màu sắc, bố cục và các thành phần dùng chung được thống nhất trên toàn hệ thống. Màn hình có các trạng thái tải dữ liệu, thông báo lỗi, phân trang, biểu mẫu nhập liệu và hộp xác nhận để người dùng dễ theo dõi trong quá trình làm việc. Các trang chính đã được triển khai gồm:

- Trang chủ giới thiệu bệnh viện, chuyên khoa, bác sĩ và điểm vào chức năng đặt lịch/tra cứu cho bệnh nhân.
- Khu vực quản trị để quản lý phòng ban, nhân sự, bác sĩ, mô hình AI, dữ liệu đã xóa mềm và nhật ký hệ thống.
- Khu vực lễ tân để tiếp nhận bệnh nhân, tạo hồ sơ, đăng ký lượt khám, quản lý hàng chờ, tra cứu lịch sử khám và check-in lịch hẹn trực tuyến.
- Khu vực bác sĩ để theo dõi danh sách bệnh nhân chờ khám, xem thông tin lượt khám, tạo chỉ định cận lâm sàng, xem kết quả, sử dụng gợi ý AI và lập kết luận cuối cùng.
- Khu vực kỹ thuật viên cận lâm sàng để nhận chỉ định, cập nhật trạng thái thực hiện và trả kết quả xét nghiệm/chẩn đoán.
- Trang hồ sơ cá nhân, đổi mật khẩu và các luồng xác thực khuôn mặt cho nhân sự, quản trị viên.

Về mặt nghiệp vụ, sản phẩm đã đáp ứng các nhóm chức năng chính được mô tả trong biểu mẫu và quy định nghiệp vụ. Quản trị viên có thể quản lý phòng ban, nhân sự, bác sĩ và danh sách mô hình AI; các bản ghi có quan hệ nghiệp vụ được xử lý theo cơ chế ngừng hoạt động hoặc xóa mềm để tránh làm mất lịch sử. Lễ tân có thể tạo và tìm kiếm hồ sơ bệnh nhân, tạo lượt khám, đưa bệnh nhân vào hàng chờ và tiếp nhận lịch hẹn. Bác sĩ có thể theo dõi quá trình khám, chỉ định xét nghiệm, tham khảo gợi ý từ AI và tự mình xác nhận kết luận điều trị. Kỹ thuật viên có thể tiếp nhận chỉ định và trả kết quả kèm tệp đính kèm.

Luồng khám bệnh được kiểm soát theo các trạng thái chờ khám, đang khám, chờ kết quả cận lâm sàng, chờ kết luận, hoàn thành hoặc hủy. Việc chuyển trạng thái không được thực hiện tùy ý mà phải đi qua các bước nghiệp vụ tương ứng. Nhờ đó, hệ thống hạn chế được trường hợp kết thúc lượt khám khi chưa có bác sĩ phụ trách hoặc chưa có kết luận cuối cùng.

Hệ thống cũng đã tích hợp các phần hỗ trợ bảo mật và kiểm chứng dữ liệu. Nhân sự và quản trị viên đăng nhập qua xác thực khuôn mặt; bệnh nhân sử dụng xác thực OTP qua số điện thoại trên cổng bệnh nhân di động. Hồ sơ bệnh án, kết quả xét nghiệm và tệp y tế mới được lưu ở kho riêng tư AWS S3; ảnh đại diện bác sĩ và nhân sự được tách riêng. Khi người dùng thực hiện các thao tác quan trọng, hệ thống tạo nhật ký để theo dõi thay đổi. Dữ liệu kiểm chứng như mã băm, Merkle root, mã băm tệp audit và thời điểm ghi nhận được neo lên blockchain; thông tin bệnh án, dữ liệu định danh và tệp y tế không được đưa lên blockchain.

Ngoài phiên bản web, đề tài đã có ứng dụng di động Expo React Native cho bệnh nhân. Ứng dụng hỗ trợ đăng nhập bằng OTP hoặc mật khẩu ở lần đầu, chọn hồ sơ bệnh nhân đã liên kết và xem lịch sử lượt khám. Đây là cơ sở để mở rộng các chức năng phục vụ bệnh nhân trong các giai đoạn tiếp theo.

## 5.2. Đánh giá kết quả thực nghiệm

Việc đánh giá được thực hiện dựa trên đối chiếu yêu cầu nghiệp vụ, kiểm tra các luồng chức năng chính trên giao diện và chạy kiểm thử tự động cho phần backend. Các nội dung được xem xét gồm tính đúng đắn của luồng khám bệnh, phân quyền người dùng, xử lý dữ liệu y tế, ghi nhận nhật ký và khả năng kiểm chứng nhật ký.

Kết quả cho thấy các chức năng cốt lõi đã bám sát biểu mẫu và quy định nghiệp vụ của đề tài. Các nhóm nghiệp vụ như quản lý nhân sự, bác sĩ, phòng ban, mô hình AI, bệnh nhân, lượt khám, chỉ định cận lâm sàng, trả kết quả và kết luận cuối cùng đều đã có màn hình và API tương ứng. Một số quy định quan trọng cũng được thể hiện rõ trong hệ thống, chẳng hạn chỉ bác sĩ mới lập kết luận cuối cùng; AI chỉ đưa gợi ý; dữ liệu có lịch sử phát sinh không bị xóa cứng tùy tiện; và chỉ người dùng có quyền mới được truy cập dữ liệu y tế.

Ở thời điểm kiểm tra, bộ kiểm thử đơn vị của backend chạy thành công với **37 bộ kiểm thử và 186 kiểm thử đạt**. Các kiểm thử tập trung vào những phần có rủi ro cao như:

- Tạo lượt khám, chỉ định cận lâm sàng, trả kết quả và lập kết luận cuối cùng.
- Quy tắc cập nhật phòng ban, nhân sự, mật khẩu và mô hình AI.
- Lưu tệp kết quả y tế trên S3 và kiểm tra loại tệp đính kèm.
- Mã hóa, tạo mã băm, tạo Merkle root, che dữ liệu nhạy cảm trong nhật ký và xác minh tính toàn vẹn.
- Khôi phục dữ liệu audit có kiểm tra điều kiện tin cậy.
- Xác thực khuôn mặt trong các luồng quản trị nhạy cảm và khôi phục ví quản trị.
- Các hợp đồng blockchain về quản lý danh tính, mã băm khuôn mặt và neo nhật ký audit.

Kết quả này cho thấy các quy tắc nghiệp vụ và cơ chế bảo vệ dữ liệu quan trọng đã được kiểm tra ở mức mã nguồn. Hệ thống cũng có phân tách rõ giữa dữ liệu vận hành và dữ liệu kiểm chứng: PostgreSQL lưu dữ liệu nghiệp vụ, S3 lưu tệp y tế riêng tư, còn blockchain chỉ dùng để xác nhận tính toàn vẹn của nhật ký. Cách tổ chức này phù hợp với mục tiêu ứng dụng blockchain trong bệnh viện mà không làm lộ dữ liệu bệnh nhân.

Tuy vậy, kết quả thực nghiệm hiện chủ yếu phản ánh môi trường phát triển và kiểm thử. Đề tài chưa đưa ra số liệu chính thức về số lượng người dùng đồng thời, thời gian phản hồi khi tải lớn, độ chính xác lâm sàng của từng mô hình AI hoặc mức độ ổn định khi triển khai dài ngày. Vì vậy, các nội dung này cần được tiếp tục đo đạc nếu hệ thống được đưa vào môi trường sử dụng thực tế.

## 5.3. Các hạn chế của đề tài

Mặc dù hệ thống đã hoàn thành các chức năng chính, đề tài vẫn còn một số hạn chế.

Thứ nhất, hệ thống mới phù hợp ở mức mô hình thử nghiệm và hỗ trợ quản lý quy trình khám bệnh. Để sử dụng trong bệnh viện thực tế, cần kiểm thử kỹ hơn về tải cao, sao lưu, khôi phục sau sự cố, giám sát hệ thống và quy trình vận hành liên tục.

Thứ hai, phần AI đang đóng vai trò hỗ trợ gợi ý. Chất lượng gợi ý phụ thuộc vào mô hình được cấu hình và dữ liệu đầu vào. Hệ thống chưa thể thay thế việc đánh giá chuyên môn của bác sĩ, đồng thời chưa có bộ dữ liệu lâm sàng chuẩn hóa đủ lớn để công bố chỉ số chính xác cho từng chuyên khoa.

Thứ ba, xác thực khuôn mặt và OTP cần được triển khai với thiết bị, điều kiện ánh sáng, dịch vụ SMS và chính sách bảo mật phù hợp khi dùng thật. Trong môi trường thực tế, cần bổ sung cơ chế chống giả mạo nâng cao, theo dõi các lần xác thực thất bại và quy trình hỗ trợ khi người dùng không thể xác thực sinh trắc học.

Thứ tư, cơ chế blockchain và IPFS đã được thiết kế để kiểm chứng và hỗ trợ khôi phục nhật ký audit, nhưng vẫn phụ thuộc vào hạ tầng blockchain, khóa quản trị, khóa relayer và dịch vụ lưu trữ. Việc quản lý khóa, sao lưu khóa và phân quyền quản trị phải được thực hiện chặt chẽ. Blockchain không phải bản sao thay thế cho cơ sở dữ liệu nghiệp vụ; khi xảy ra sự cố nghiêm trọng vẫn cần kế hoạch sao lưu và phục hồi PostgreSQL riêng.

Thứ năm, phiên bản di động hiện tập trung vào đăng nhập và xem lịch sử khám của bệnh nhân. Các tiện ích như đặt lịch đầy đủ, nhận thông báo, thanh toán, tư vấn từ xa hoặc quét NFC mới là hướng có thể mở rộng, chưa phải phần hoàn thiện của phiên bản hiện tại.

# CHƯƠNG 6. PHƯƠNG HƯỚNG PHÁT TRIỂN

## 6.1. Kết luận toàn văn

Đề tài đã xây dựng được một hệ thống quản lý bệnh viện có các luồng nghiệp vụ cơ bản từ tiếp nhận bệnh nhân, quản lý lượt khám, chỉ định cận lâm sàng, trả kết quả đến lập kết luận điều trị. Hệ thống có sự phân chia theo vai trò để mỗi người dùng làm đúng phần việc của mình. Điều này giúp quy trình rõ ràng hơn, giảm thao tác thủ công và hỗ trợ tra cứu thông tin thuận tiện hơn.

Điểm nổi bật của đề tài là kết hợp AI, xác thực khuôn mặt và blockchain theo đúng vai trò của từng công nghệ. AI được dùng để hỗ trợ bác sĩ tham khảo, không tự đưa ra kết luận. Xác thực khuôn mặt giúp tăng thêm một lớp kiểm tra danh tính ở các luồng phù hợp. Blockchain được dùng để kiểm chứng nhật ký thay đổi, thay vì lưu trực tiếp bệnh án hay dữ liệu cá nhân. Cách tiếp cận này vừa tận dụng được công nghệ mới, vừa giữ được nguyên tắc bảo vệ thông tin y tế.

Qua việc đối chiếu biểu mẫu, quy định nghiệp vụ và chạy kiểm thử, có thể thấy hệ thống đã đáp ứng phần lớn mục tiêu đã đặt ra ở mức sản phẩm thử nghiệm. Đây là nền tảng để tiếp tục hoàn thiện thành một hệ thống có khả năng áp dụng rộng hơn sau khi được kiểm thử thực tế, bổ sung hạ tầng vận hành và rà soát các yêu cầu pháp lý liên quan đến dữ liệu y tế.

## 6.2. Hướng phát triển về mặt Tính năng & Công nghệ

Trong thời gian tới, hệ thống có thể được phát triển thêm theo các hướng sau:

- Hoàn thiện cổng bệnh nhân trên web và ứng dụng di động: đặt lịch, đổi hoặc hủy lịch, nhận thông báo kết quả, theo dõi đơn thuốc và lịch tái khám.
- Bổ sung quản lý thuốc, kho vật tư, viện phí, thanh toán và các báo cáo vận hành để quy trình quản lý được liên thông hơn.
- Mở rộng tính năng NFC/CCCD cho bước nhận diện nhanh tại quầy. Dữ liệu trên thẻ chỉ nên là dữ liệu phục vụ thử nghiệm hoặc dữ liệu đã ký số; không xem thẻ NFC là bằng chứng định danh duy nhất.
- Phát triển hệ thống thông báo qua ứng dụng, SMS hoặc email khi có lịch hẹn, kết quả xét nghiệm hoặc yêu cầu tái khám.
- Tăng cường AI theo từng chuyên khoa, xây dựng quy trình đánh giá bởi bác sĩ, lưu nhận xét về độ hữu ích của gợi ý và theo dõi chất lượng mô hình theo thời gian.
- Bổ sung dashboard báo cáo: số lượt khám, thời gian chờ, khối lượng xét nghiệm, tỷ lệ hoàn thành lượt khám và thống kê sử dụng AI. Các báo cáo phải được phân quyền và không hiển thị dữ liệu nhạy cảm không cần thiết.
- Mở rộng kiểm thử tích hợp, kiểm thử giao diện đầu-cuối, kiểm thử tải và kiểm thử bảo mật trước khi triển khai thật.
- Triển khai cơ chế giám sát tập trung, cảnh báo lỗi, sao lưu định kỳ, phục hồi PostgreSQL theo thời điểm và quy trình xử lý sự cố rõ ràng.
- Quản lý khóa blockchain bằng ví đa chữ ký hoặc kho bí mật chuyên dụng; hỗ trợ luân chuyển khóa relayer và kiểm tra định kỳ các batch audit chưa được neo.
- Chuẩn hóa khả năng tích hợp với các hệ thống khác bằng API, hướng tới trao đổi dữ liệu có kiểm soát với hệ thống xét nghiệm, thiết bị y tế hoặc phần mềm quản lý bệnh viện hiện hữu.

## 6.3. Hướng phát triển về mặt Quy mô & Đối tượng sử dụng

Ở giai đoạn đầu, hệ thống có thể triển khai thử nghiệm cho một phòng khám hoặc một số khoa có quy trình rõ ràng, chẳng hạn khu khám ngoại trú và xét nghiệm. Việc triển khai theo phạm vi nhỏ giúp dễ thu thập phản hồi từ lễ tân, bác sĩ, kỹ thuật viên và bệnh nhân; đồng thời điều chỉnh giao diện cũng như quy trình cho phù hợp với thực tế.

Khi hệ thống ổn định hơn, có thể mở rộng theo từng khoa, từng cơ sở hoặc theo mô hình chuỗi phòng khám. Lúc đó cần chú trọng đến phân tách dữ liệu giữa các đơn vị, cấu hình quyền truy cập theo cơ sở, đồng bộ danh mục dùng chung và cơ chế báo cáo tổng hợp cho cấp quản lý.

Đối tượng sử dụng cũng có thể được mở rộng. Ngoài nhân sự nội bộ và bệnh nhân, hệ thống có thể hỗ trợ người thân được bệnh nhân ủy quyền, bộ phận chăm sóc khách hàng, bộ phận tài chính và quản lý bệnh viện. Mỗi nhóm cần có phạm vi xem và thao tác riêng, đặc biệt đối với bệnh án và thông tin định danh.

Về lâu dài, nếu kết nối với nhiều đơn vị y tế, hệ thống cần có chuẩn trao đổi dữ liệu, quy trình xác thực liên tổ chức, cơ chế đồng ý chia sẻ dữ liệu của bệnh nhân và hạ tầng đủ khả năng xử lý nhiều người dùng đồng thời. Việc mở rộng quy mô phải đi cùng với kiểm soát bảo mật, tuân thủ quy định về hồ sơ y tế và duy trì quyền quyết định chuyên môn của bác sĩ.
