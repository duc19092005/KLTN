Bạn là Senior Frontend Engineer + UI/UX Designer + Design System Specialist.

Nhiệm vụ của bạn là phân tích TOÀN BỘ frontend hiện tại của hệ thống, sau đó đề xuất và thực hiện chỉnh sửa để đưa toàn bộ giao diện về một thể thống nhất, đồng bộ, dễ nhìn, dễ dùng, thân thiện với người dùng và chuyên nghiệp.

YÊU CẦU QUAN TRỌNG:

* Phải kiểm tra toàn bộ source frontend.
* Không được bỏ sót bất kỳ file, component, layout, page, modal, form, button, icon, table, card, sidebar, navbar, footer, popup, alert, toast, dropdown, tab, pagination, empty state, loading state, error state nào.
* Không chỉ sửa một vài page chính, mà phải rà soát toàn bộ hệ thống.
* Mọi thay đổi phải giữ nguyên logic nghiệp vụ hiện tại, không làm hỏng chức năng.
* Không được xóa chức năng nếu chưa chắc chắn.
* Nếu phát hiện code trùng lặp, style rời rạc, màu sắc không thống nhất, component bị viết nhiều kiểu khác nhau thì phải gom lại thành component/style dùng chung.

MỤC TIÊU CHÍNH:
Đưa toàn bộ frontend về chung một phong cách thiết kế thống nhất, bao gồm:

1. Một tông màu chủ đạo duy nhất.
2. Button cùng kiểu, cùng kích thước, cùng trạng thái hover/focus/disabled.
3. Icon đồng bộ, hạn chế màu mè.
4. Các page có bố cục tương đồng.
5. Form, input, table, card, modal, sidebar, navbar nhìn cùng một hệ thiết kế.
6. Giao diện thân thiện, dễ dùng, dễ nhìn, phù hợp mắt người dùng.
7. Không còn tình trạng mỗi page một kiểu khác nhau.

YÊU CẦU VỀ MÀU SẮC:

* Chọn một tông màu chủ đạo phù hợp với hệ thống.
* Không dùng quá nhiều màu lòe loẹt.
* Không để mỗi page tự chọn màu riêng.
* Tạo hoặc chuẩn hóa bảng màu dùng chung:

  * Primary color
  * Secondary color
  * Background color
  * Surface/card color
  * Text primary
  * Text secondary
  * Border color
  * Success color
  * Warning color
  * Error color
  * Disabled color
* Các màu success/warning/error chỉ dùng đúng mục đích, không lạm dụng.
* Nền giao diện phải dễ nhìn, không gây mỏi mắt.
* Màu chữ phải đủ tương phản, dễ đọc.

YÊU CẦU VỀ BUTTON:

* Chuẩn hóa toàn bộ button trong hệ thống.
* Tất cả button phải dùng chung một hệ quy chuẩn.
* Phân loại rõ:

  * Primary button: dùng cho hành động chính.
  * Secondary button: dùng cho hành động phụ.
  * Danger button: dùng cho hành động xóa/hủy nguy hiểm.
  * Outline button: dùng khi cần nhấn nhẹ.
  * Icon button: dùng cho nút chỉ có icon.
* Không để mỗi page tự thiết kế button riêng.
* Button phải có:

  * Cùng border-radius.
  * Cùng padding.
  * Cùng font-size.
  * Cùng font-weight.
  * Cùng hover effect.
  * Cùng active state.
  * Cùng disabled state.
  * Cùng loading state nếu có.
* Các nút như Thêm, Sửa, Xóa, Lưu, Hủy, Xem chi tiết, Tìm kiếm, Quay lại phải thống nhất toàn hệ thống.

YÊU CẦU VỀ ICON:

* Không dùng icon quá nhiều màu.
* Icon phải đồng bộ style.
* Ưu tiên icon một màu hoặc theo màu text hiện tại.
* Icon trong button phải cùng kích thước.
* Icon trong sidebar/navbar/menu phải thống nhất.
* Không dùng nhiều bộ icon khác nhau nếu không cần thiết.
* Nếu hệ thống đang dùng nhiều kiểu icon khác nhau, hãy chuẩn hóa về một bộ icon chính.
* Icon không được làm giao diện rối mắt.

YÊU CẦU VỀ LAYOUT:

* Chuẩn hóa layout chung cho toàn bộ page.
* Các page nên có cấu trúc tương đồng:

  * Header/title rõ ràng.
  * Khu vực filter/search nếu có.
  * Khu vực nội dung chính.
  * Khu vực action button.
  * Khu vực table/card/list.
  * Pagination nếu có.
* Khoảng cách margin, padding phải thống nhất.
* Không để page quá chật hoặc quá rời rạc.
* Sidebar/navbar phải đồng bộ trên toàn hệ thống.
* Footer nếu có phải thống nhất.
* Các trang quản lý danh sách nên có bố cục giống nhau.
* Các trang form thêm/sửa nên có bố cục giống nhau.
* Các trang chi tiết nên có bố cục giống nhau.

YÊU CẦU VỀ COMPONENT:
Hãy rà soát và chuẩn hóa các component dùng chung, bao gồm nhưng không giới hạn:

* Button
* Input
* Select
* Textarea
* Checkbox
* Radio
* Date picker
* Search box
* Form group
* Form validation message
* Table
* Pagination
* Card
* Badge/Status
* Modal
* Toast/Notification
* Alert
* Dropdown
* Navbar
* Sidebar
* Breadcrumb
* Avatar
* Loading spinner/skeleton
* Empty state
* Error state
* Confirm dialog

Nếu chưa có component dùng chung, hãy đề xuất hoặc tạo component dùng chung để thay thế các đoạn code bị lặp.

YÊU CẦU VỀ FORM:

* Tất cả form phải có style đồng bộ.
* Label, input, placeholder, validation message phải thống nhất.
* Khoảng cách giữa các field phải đều.
* Các form thêm/sửa/xem chi tiết phải dễ nhìn.
* Nút submit/cancel phải đặt vị trí hợp lý.
* Lỗi validation phải dễ hiểu, không gây rối.
* Không dùng quá nhiều màu trong form.
* Input focus phải rõ nhưng không quá chói.

YÊU CẦU VỀ TABLE:

* Toàn bộ bảng dữ liệu phải đồng bộ.
* Header table rõ ràng.
* Row spacing dễ đọc.
* Hover row nhẹ nhàng.
* Cột action như Xem/Sửa/Xóa phải thống nhất.
* Status trong table phải dùng badge thống nhất.
* Không dùng màu tùy tiện cho từng bảng.
* Nếu bảng trống phải có empty state thân thiện.
* Nếu đang tải dữ liệu phải có loading state.

YÊU CẦU VỀ CARD:

* Card phải dùng chung border-radius, shadow, border, padding.
* Không để mỗi page một kiểu card.
* Card phải nhẹ nhàng, dễ nhìn.
* Không dùng shadow quá mạnh.
* Nội dung trong card phải có phân cấp rõ ràng.

YÊU CẦU VỀ STATUS/BADGE:

* Các trạng thái như Đang xử lý, Thành công, Đã hủy, Chờ xác nhận, Đã giao, Đang giao, Đã thanh toán, Chưa thanh toán... phải dùng chung hệ badge.
* Không để mỗi page hiển thị trạng thái một kiểu.
* Màu badge phải nhất quán:

  * Success: xanh nhẹ
  * Warning: vàng/cam nhẹ
  * Error/Danger: đỏ nhẹ
  * Info: xanh dương nhẹ
  * Neutral: xám nhẹ
* Text trong badge phải dễ đọc.

YÊU CẦU VỀ TYPOGRAPHY:

* Chuẩn hóa font chữ toàn hệ thống.
* Không dùng quá nhiều font-size tùy tiện.
* Tạo quy chuẩn:

  * Page title
  * Section title
  * Card title
  * Body text
  * Small text
  * Caption
  * Error text
* Font-weight phải hợp lý.
* Không để text quá nhỏ hoặc quá đậm gây khó đọc.
* Dòng chữ phải dễ nhìn trên màn hình laptop và mobile.

YÊU CẦU VỀ RESPONSIVE:

* Kiểm tra giao diện trên nhiều kích thước:

  * Desktop
  * Laptop
  * Tablet
  * Mobile
* Không để vỡ layout.
* Sidebar/navbar phải hoạt động hợp lý trên màn hình nhỏ.
* Table nếu quá rộng phải có giải pháp responsive.
* Form trên mobile phải dễ nhập.
* Button trên mobile phải dễ bấm.
* Không để chữ/icon/nút bị chồng lên nhau.

YÊU CẦU VỀ UI/UX:

* Giao diện phải thân thiện với người dùng phổ thông.
* Các hành động chính phải dễ thấy.
* Không làm người dùng bị rối bởi quá nhiều màu, icon hoặc button.
* Luồng thao tác phải rõ ràng.
* Page nào cũng phải có tiêu đề rõ.
* Các nút nguy hiểm như Xóa phải có cảnh báo/confirm.
* Thông báo thành công/lỗi phải dễ hiểu.
* Không dùng hiệu ứng quá nhiều.
* Hover/focus/transition chỉ nên nhẹ nhàng.
* Ưu tiên sự rõ ràng, nhất quán và dễ dùng.

YÊU CẦU VỀ ACCESSIBILITY:

* Màu chữ và nền phải đủ tương phản.
* Button/input phải có trạng thái focus rõ.
* Không chỉ dùng màu để biểu thị trạng thái, nên có text đi kèm.
* Icon nếu quan trọng phải có label hoặc aria-label.
* Form input nên có label đầy đủ.
* Click area của button/icon phải đủ lớn.
* Không để text quá nhỏ gây khó đọc.

YÊU CẦU VỀ CODE:

* Không hard-code màu trực tiếp rải rác trong nhiều file nếu có thể tránh.
* Nên gom màu, spacing, radius, shadow, font-size vào biến dùng chung.
* Nếu dùng CSS/SCSS/Tailwind/Bootstrap/Material UI/Ant Design hoặc framework khác, hãy chuẩn hóa theo đúng hệ thống đó.
* Xóa hoặc thay thế các class/style dư thừa, trùng lặp, không còn dùng.
* Không phá vỡ cấu trúc project hiện tại.
* Không làm ảnh hưởng API call, routing, authentication, state management, validation, business logic.
* Nếu sửa component dùng chung, phải kiểm tra các nơi đang dùng component đó.
* Nếu có inline style không cần thiết, hãy chuyển về class hoặc style dùng chung.
* Nếu có nhiều button/form/table/card tự viết lặp lại, hãy gom lại.

QUY TRÌNH BẮT BUỘC:

1. Quét toàn bộ cấu trúc frontend.
2. Liệt kê tất cả page chính, layout chính và component chính.
3. Phân tích những điểm chưa đồng bộ:

   * Màu sắc
   * Button
   * Icon
   * Layout
   * Form
   * Table
   * Card
   * Modal
   * Typography
   * Spacing
   * Responsive
4. Đề xuất design system chung.
5. Tạo hoặc cập nhật file style/theme dùng chung.
6. Refactor từng page/component theo design system.
7. Kiểm tra lại toàn bộ page sau khi sửa.
8. Đảm bảo không còn page nào bị lệch phong cách.
9. Đảm bảo không còn button/icon/màu sắc bị dùng tùy tiện.
10. Đưa ra báo cáo cuối cùng: đã sửa file nào, sửa gì, còn rủi ro gì nếu có.

YÊU CẦU KHI PHÂN TÍCH SOURCE:

* Phải đọc kỹ từng file liên quan đến frontend.
* Không được bỏ sót page chỉ vì page đó ít dùng.
* Không được chỉ sửa trang đầu tiên.
* Không được chỉ sửa CSS mà không kiểm tra component.
* Không được sửa màu tùy tiện theo cảm tính.
* Không được tạo thêm nhiều style riêng lẻ làm hệ thống rối hơn.
* Không được làm mất responsive.
* Không được làm mất chức năng đang chạy.

YÊU CẦU OUTPUT TRƯỚC KHI SỬA:
Trước khi chỉnh sửa code, hãy trình bày:

1. Danh sách page/component đã tìm thấy.
2. Các lỗi giao diện không thống nhất hiện tại.
3. Kế hoạch chuẩn hóa frontend.
4. Design system đề xuất:

   * Bảng màu
   * Typography
   * Spacing
   * Border radius
   * Shadow
   * Button variants
   * Form style
   * Table style
   * Card style
   * Badge/status style
5. Danh sách file dự kiến sẽ chỉnh sửa.

YÊU CẦU OUTPUT SAU KHI SỬA:
Sau khi chỉnh sửa code, hãy báo cáo:

1. Đã sửa những file nào.
2. Mỗi file đã sửa gì.
3. Những component nào đã được chuẩn hóa.
4. Những page nào đã được đồng bộ giao diện.
5. Những màu/style cũ nào đã được thay thế.
6. Những vấn đề còn tồn tại nếu có.
7. Hướng dẫn kiểm tra lại giao diện.
8. Các bước chạy/test project.

TIÊU CHUẨN HOÀN THÀNH:

* Toàn bộ hệ thống nhìn như cùng một sản phẩm, không còn cảm giác mỗi page một kiểu.
* Màu sắc đồng nhất, dễ nhìn, không lòe loẹt.
* Button đồng bộ.
* Icon đồng bộ.
* Form đồng bộ.
* Table đồng bộ.
* Card đồng bộ.
* Modal/alert/toast đồng bộ.
* Các page có bố cục tương đồng.
* Người dùng dễ thao tác, dễ đọc, dễ hiểu.
* Code frontend sạch hơn, dễ bảo trì hơn.
* Không làm hỏng chức năng cũ.

HÃY LÀM CẨN THẬN, CHI TIẾT, KHÔNG BỎ SÓT DÒNG NÀO, FILE NÀO, PAGE NÀO, COMPONENT NÀO.
