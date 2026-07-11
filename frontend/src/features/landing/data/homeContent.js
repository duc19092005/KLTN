/**
 * Content for Hospital Home — non-technical, trust-first.
 * Spacing scale used across landing: 4, 8, 12, 16, 24, 32, 48, 64
 */

export const NAV_LINKS = [
  { href: '#chuyen-khoa', label: 'Chuyên khoa' },
  { href: '#doi-ngu', label: 'Đội ngũ bác sĩ' },
  { href: '#bang-gia', label: 'Bảng giá' },
  { href: '#lien-he', label: 'Liên hệ' },
];

export const QUICK_ACTIONS = [
  {
    id: 'find-doctor',
    title: 'Tìm bác sĩ',
    description: 'Xem chuyên khoa và lịch làm việc phù hợp.',
    href: '#doi-ngu',
    icon: 'stethoscope',
  },
  {
    id: 'lab-results',
    title: 'Tra cứu kết quả',
    description: 'Nhận hướng dẫn lấy kết quả tại quầy hoặc ứng dụng.',
    href: '#lien-he',
    icon: 'clipboard',
  },
  {
    id: 'booking',
    title: 'Đặt lịch hẹn',
    description: 'Đặt lịch khám nhanh, giảm thời gian chờ tại viện.',
    href: '#dat-lich',
    icon: 'calendar',
  },
  {
    id: 'consult',
    title: 'Tư vấn trực tuyến',
    description: 'Kênh hỗ trợ ban đầu trước khi đến khám.',
    href: '#lien-he',
    icon: 'message',
  },
];

export const SPECIALITIES = [
  {
    id: 'san-nhi',
    title: 'Sản – Nhi',
    description: 'Chăm sóc mẹ và bé xuyên suốt thai kỳ, sinh nở và nhi khoa.',
    focus: 'Thai sản · Nhi tổng quát',
  },
  {
    id: 'tim-mach',
    title: 'Tim mạch',
    description: 'Khám, tầm soát và theo dõi các vấn đề tim mạch thường gặp.',
    focus: 'Tầm soát · Theo dõi lâu dài',
  },
  {
    id: 'co-xuong-khop',
    title: 'Cơ xương khớp',
    description: 'Điều trị đau cột sống, khớp và phục hồi vận động.',
    focus: 'Nội · Phục hồi chức năng',
  },
  {
    id: 'ung-buou',
    title: 'Ung bướu',
    description: 'Tầm soát, tư vấn và phối hợp điều trị đa chuyên khoa.',
    focus: 'Tầm soát · Hội chẩn',
  },
];

export const DOCTORS_PREVIEW = [
  { name: 'BS.CKII Nguyễn Minh An', specialty: 'Tim mạch', years: '15 năm kinh nghiệm' },
  { name: 'BS.CKI Trần Thu Hà', specialty: 'Sản phụ khoa', years: '12 năm kinh nghiệm' },
  { name: 'BS.CKII Lê Quang Huy', specialty: 'Cơ xương khớp', years: '18 năm kinh nghiệm' },
];

export const PRICING_PREVIEW = [
  { item: 'Khám nội tổng quát', price: 'từ 150.000đ' },
  { item: 'Khám chuyên khoa', price: 'từ 200.000đ' },
  { item: 'Gói tầm soát cơ bản', price: 'liên hệ tư vấn' },
];

export const CAMPUSES = [
  {
    name: 'Cơ sở 1 – Trung tâm',
    address: '123 Nguyễn Trãi, Quận 1, TP. Hồ Chí Minh',
    phone: '028 3822 0000',
    hours: '07:00 – 17:00 (T2–T7)',
  },
  {
    name: 'Cơ sở 2 – Phía Đông',
    address: '45 xa lộ Hà Nội, TP. Thủ Đức, TP. Hồ Chí Minh',
    phone: '028 3899 1111',
    hours: '07:00 – 17:00 (T2–T7)',
  },
];
