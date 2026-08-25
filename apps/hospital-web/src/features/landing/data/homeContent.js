/**
 * Home content — BVĐK Quốc tế KLTN
 * Nội dung đời thường, thân thiện, dễ hiểu cho người bệnh và gia đình
 */

export const NAV_LINKS = [
  { href: '#top', label: 'Trang chủ' },
  { href: '#dich-vu', label: 'Dịch vụ khám' },
  { href: '#chuyen-khoa', label: 'Chuyên khoa' },
  { href: '#quy-trinh', label: 'Quy trình khám' },
  { href: '#doi-ngu', label: 'Đội ngũ Bác sĩ' },
  { href: '#hoi-dap', label: 'Hỏi đáp' },
  { href: '#lien-he', label: 'Đặt lịch hẹn' },
];

export const QUICK_SERVICES = [
  {
    id: 'kham-tong-quat',
    title: 'Khám sức khỏe tổng quát',
    desc: 'Gói khám toàn diện theo độ tuổi, đánh giá đầy đủ chức năng cơ quan và phát hiện sớm các nguy cơ.',
    tag: 'Phổ biến',
  },
  {
    id: 'kham-chuyen-khoa',
    title: 'Khám chuyên khoa theo yêu cầu',
    desc: 'Lựa chọn bác sĩ trưởng khoa thăm khám trực tiếp, tư vấn phác đồ điều trị phù hợp nhất.',
    tag: 'Chọn bác sĩ',
  },
  {
    id: 'kham-san-nhi',
    title: 'Chăm sóc Mẹ bầu & Em bé',
    desc: 'Theo dõi thai kỳ trọn gói nhẹ nhàng, tiêm chủng đầy đủ và chăm sóc sức khỏe nhi khoa chu đáo.',
    tag: 'Gia đình',
  },
  {
    id: 'xet-nghiem-tai-vien',
    title: 'Xét nghiệm & Siêu âm trong ngày',
    desc: 'Lấy máu nhẹ nhàng, máy móc tự động trả kết quả nhanh chóng, lưu trữ an toàn trên điện thoại.',
    tag: 'Trả kết quả nhanh',
  },
  {
    id: 'kham-ngoai-gio',
    title: 'Khám ngoài giờ & Cuối tuần',
    desc: 'Mở cửa từ 07:00 đến 20:00 cả Thứ 7 và Chủ Nhật, không phụ thu thêm chi phí.',
    tag: 'Không chờ đợi',
  },
  {
    id: 'tam-soat-chuyen-sau',
    title: 'Tầm soát ung thư & Đột quỵ',
    desc: 'Chụp chiếu hình ảnh rõ nét, phát hiện sớm nguy cơ để chủ động bảo vệ sức khỏe dài lâu.',
    tag: 'Chủ động',
  },
];

export const SPECIALITIES = [
  {
    id: 'tim-mach',
    title: 'Tim Mạch & Huyết Áp',
    symptoms: 'Đau tức ngực, hồi hộp, huyết áp cao, khó thở khi gắng sức',
    desc: 'Bác sĩ chuyên khoa tim mạch kiểm tra điện tim, siêu âm tim và theo dõi huyết áp ổn định cho người bệnh.',
    featured: true,
  },
  {
    id: 'san-phu-nhi',
    title: 'Sản Phụ Khoa & Nhi',
    symptoms: 'Khám thai định kỳ, chăm sóc sau sinh, trẻ biếng ăn, sốt, ho, tiêm chủng',
    desc: 'Không gian khám sạch sẽ, ân cần với trẻ nhỏ, đồng hành cùng mẹ trong suốt thai kỳ an vui.',
    featured: false,
  },
  {
    id: 'tieu-hoa-gan-mat',
    title: 'Tiêu Hóa & Gan Mật',
    symptoms: 'Đau dạ dày, đầy hơi, ợ chua, viêm đại tràng, men gan cao',
    desc: 'Nội soi êm ái không đau, chẩn đoán chính xác nguyên nhân và tư vấn chế độ ăn uống lành mạnh.',
    featured: false,
  },
  {
    id: 'co-xuong-khop',
    title: 'Cơ Xương Khớp & Cột Sống',
    symptoms: 'Đau lưng, thoái hóa khớp gối, tê bì chân tay, cứng khớp buổi sáng',
    desc: 'Giúp phục hồi vận động linh hoạt bằng phác đồ kết hợp thuốc, vật lý trị liệu nhẹ nhàng.',
    featured: false,
  },
  {
    id: 'tai-mui-hong-ho-hap',
    title: 'Tai Mũi Họng & Hô Hấp',
    symptoms: 'Viêm họng hạt, viêm xoang, ho kéo dài, nghẹt mũi, khàn tiếng',
    desc: 'Nội soi tai mũi họng rõ nét, điều trị dứt điểm viêm nhiễm đường hô hấp cho người lớn và trẻ nhỏ.',
    featured: false,
  },
  {
    id: 'mat-rang-ham-mat',
    title: 'Mắt & Răng Hàm Mặt',
    symptoms: 'Mờ mắt, cộm ngứa, đo tật khúc xạ, sâu răng, cạo vôi răng, nhổ răng',
    desc: 'Thăm khám nhẹ nhàng, phòng vô trùng tiêu chuẩn, mang lại nụ cười rạng rỡ và đôi mắt sáng khỏe.',
    featured: false,
  },
];

export const DOCTORS = [
  {
    name: 'GS. BS. Nguyễn Văn An',
    role: 'Trưởng khoa Tim Mạch',
    experience: 'Hơn 25 năm kinh nghiệm',
    specialty: 'Tim Mạch & Huyết Áp',
    philosophy: 'Luôn lắng nghe nhịp tim và thấu hiểu nỗi lo của từng người bệnh.',
    initials: 'AN',
    color: 'bg-sky-100 text-sky-700 border-sky-200',
  },
  {
    name: 'TS. BS. Trần Thị Bình',
    role: 'Bác sĩ Sản Phụ Khoa',
    experience: 'Hơn 18 năm kinh nghiệm',
    specialty: 'Sản Phụ Khoa & Thai Kỳ',
    philosophy: 'Đồng hành nhẹ nhàng, giúp mẹ bầu an tâm trong suốt hành trình đón con.',
    initials: 'BÌNH',
    color: 'bg-rose-100 text-rose-700 border-rose-200',
  },
  {
    name: 'BSCKII. Lê Văn Cường',
    role: 'Chuyên gia Cơ Xương Khớp',
    experience: 'Hơn 20 năm kinh nghiệm',
    specialty: 'Cơ Xương Khớp & Cột Sống',
    philosophy: 'Giúp người cao tuổi tìm lại bước đi nhẹ nhàng, không còn đau nhức mỗi ngày.',
    initials: 'CƯỜNG',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  {
    name: 'PGS. TS. Phạm Thu Dung',
    role: 'Bác sĩ Tiêu Hóa & Nội Khoa',
    experience: 'Hơn 22 năm kinh nghiệm',
    specialty: 'Tiêu Hóa & Gan Mật',
    philosophy: 'Giải thích cặn kẽ kết quả khám, tư vấn chế độ ăn uống dễ áp dụng tại nhà.',
    initials: 'DUNG',
    color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  },
];

export const PATIENT_REVIEWS = [
  {
    id: '1',
    author: 'Cô Nguyễn Thị Hoa (58 tuổi, Quận 5)',
    service: 'Khám Tim mạch định kỳ',
    content: 'Tôi đi khám huyết áp ở đây rất thích. Bác sĩ An khám kỹ, giải thích từng chút một chứ không vội vã. Đặt lịch trước nên đến nơi là có nhân viên đưa vào khám liền, không phải xếp hàng chờ cả buổi như nơi khác.',
    rating: 5,
  },
  {
    id: '2',
    author: 'Anh Lê Hoàng Nam (34 tuổi, Bình Thạnh)',
    service: 'Gói Khám tổng quát gia đình',
    content: 'Dẫn cả nhà đi khám cuối tuần. Không gian bệnh viện sạch sẽ, thơm tho, có trà nước mát và khu vui chơi nhỏ cho bé. Kết quả xét nghiệm gửi thẳng qua điện thoại rất tiện tra cứu.',
    rating: 5,
  },
  {
    id: '3',
    author: 'Chị Phạm Minh Thư (29 tuổi, Tân Bình)',
    service: 'Khám Thai định kỳ',
    content: 'Bác sĩ Bình siêu âm rất ân cần, chỉ rõ từng cử động của bé. Nhân viên lễ tân dạ thưa niềm nở, hướng dẫn tận tình từng phòng khám. Cảm giác rất an tâm!',
    rating: 5,
  },
];

export const FAQS = [
  {
    q: 'Đặt lịch khám trước có mất thêm phí không?',
    a: 'Hoàn toàn không mất phí. Đặt lịch khám trực tuyến giúp bệnh viện chuẩn bị trước hồ sơ và ưu tiên số khám đúng giờ cho bạn mà không phát sinh thêm bất kỳ khoản phụ thu nào.',
  },
  {
    q: 'Bệnh viện có tiếp nhận Bảo hiểm Y tế (BHYT) không?',
    a: 'Bệnh viện áp dụng thanh toán theo đúng quy định BHYT nhà nước và liên kết bảo lãnh viện phí trực tiếp với hơn 30 công ty bảo hiểm tư nhân lớn, giúp bạn tiết kiệm chi phí tối đa.',
  },
  {
    q: 'Đi khám vào Thứ 7 và Chủ Nhật có đắt hơn ngày thường không?',
    a: 'Giá khám tại bệnh viện được niêm yết công khai và giữ nguyên đồng nhất tất cả các ngày trong tuần, kể cả ngày nghỉ cuối tuần và ngoài giờ hành chính.',
  },
  {
    q: 'Kết quả xét nghiệm và chụp chiếu mất bao lâu thì có?',
    a: 'Hầu hết các xét nghiệm máu, nước tiểu, siêu âm và chụp X-quang/MRI đều có kết quả ngay trong vòng 30 - 90 phút. Bạn có thể xem kết quả trực tiếp ngay trên điện thoại hoặc nhận bản in tại quầy tiếp đón.',
  },
  {
    q: 'Người lớn tuổi hoặc bệnh nhân khó đi lại có được hỗ trợ không?',
    a: 'Bệnh viện có sẵn xe lăn tại sảnh đón, lối đi riêng cho người khó vận động và đội ngũ điều dưỡng hỗ trợ di chuyển tận nơi suốt quá trình thăm khám.',
  },
];
