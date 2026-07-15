# Y TẾ IDENTITY OS - UI/UX & DEVELOPMENT GUIDELINES

Tài liệu này định nghĩa các quy tắc thiết kế và code cho dự án "Med Identity - Hospital OS". AI khi tạo mới hoặc chỉnh sửa component **BẮT BUỘC** phải tuân thủ nghiêm ngặt các quy tắc dưới đây để đảm bảo tính đồng nhất.

## 1. Triết lý thiết kế (Design Philosophy)
- **Concept:** Clinical Blue (Xanh Y Khoa).
- **Cảm giác mang lại:** Sạch sẽ, an tâm, tin cậy, bảo mật cao và hiện đại.
- **Phong cách:** Tối giản (Minimalist), khoảng cách thoáng (Breathing room), bo góc mềm mại, hiệu ứng chuyển động mượt mà.

## 2. Bảng màu chủ đạo (Color Palette - Tailwind CSS)
Hệ thống KHÔNG dùng các màu sặc sỡ, chỉ giới hạn trong dải màu sau:

### 2.1. Nền (Backgrounds)
- **Nền ứng dụng (App Root):** `bg-[#F4F7FA]`
- **Nền nội dung chính (Main Content):** `bg-[#F8FAFC]`
- **Nền Sidebar/Header/Card:** `bg-white`

### 2.2. Màu nhấn (Primary/Accent) - Dải Blue (Xanh Y Khoa)
- **Màu chủ đạo (Logo, Nút bấm chính, Icon Active):** `blue-600`
- **Màu chữ Active/Nhấn mạnh:** `blue-700`
- **Nền Active Tab/Item:** `bg-blue-50/80` hoặc `bg-blue-50`
- **Viền/Focus Ring:** `blue-100`, `blue-200`, `blue-400`

### 2.3. Chữ & Icon (Typography & Icons) - Dải Slate
- **Tiêu đề chính/Text nổi bật:** `text-slate-900`
- **Text nội dung thường:** `text-slate-800`
- **Text phụ/Label vô hiệu hóa:** `text-slate-500`
- **Icon/Placeholder:** `text-slate-400`
- **Đường viền/Divider:** `border-slate-200` (nhạt thì dùng `border-slate-100`)

### 2.4. Trạng thái (Status Colors)
- **Thành công/An toàn (Success/Secure):** Dải `emerald` (`emerald-500` cho chấm dot, `emerald-50/60` cho nền, `emerald-700/950` cho text).
- **Nguy hiểm/Hành động xóa (Danger/Logout):** Dải `red` (`red-50` cho nền hover, `red-600` cho text hover).

## 3. Typography (Kiểu chữ)
- Mặc định sử dụng: `font-sans antialiased`.
- **Text bôi đen (Selection):** `selection:bg-blue-100 selection:text-blue-700`.
- **Label Hệ thống (Ví dụ: "Hệ thống định danh bệnh viện"):** `text-[10px] font-bold uppercase tracking-widest`.
- **Tiêu đề Trang (Page Title):** `text-lg sm:text-xl font-bold tracking-tight`.
- **Text Menu/Nút bấm:** `text-[14px] font-medium`.

## 4. Cấu trúc Layout & Responsive
Phải luôn thiết kế theo chuẩn Mobile-First nhưng tối ưu hiển thị cho Desktop.

- **Sidebar (Left Menu):** Chiều rộng cố định `w-[260px]`.
- **Topbar (Header):** Chiều cao cố định `h-20`.
- **Spacing Padding nội dung chính:** `p-4 sm:p-6 lg:p-8`.
- **Responsive Breakpoints:**
  - **Dưới `lg` (Mobile & Tablet):** Sidebar ẩn (`-translate-x-full`). Cần có nút Hamburger ở Topbar để mở.
  - **Overlay Mobile:** Khi mở Sidebar trên mobile, LUÔN LUÔN hiển thị lớp overlay mờ: `bg-slate-900/30 backdrop-blur-sm z-40`.
  - **Dưới `md` (Mobile nhỏ):** Ẩn thanh tìm kiếm dài (`hidden md:flex`), các text thông tin User có thể ẩn bớt để tiết kiệm không gian.

## 5. Tương tác & Hiệu ứng (States & Transitions)
- **Tốc độ chung:** `transition-all duration-200 ease-out` hoặc `duration-300`.
- **Hover Item/Button:** `hover:bg-slate-50 hover:text-slate-900`.
- **Hover Icon:** Thu phóng nhẹ `group-hover:scale-105`.
- **Focus Accessibilty (BẮT BUỘC):** Mọi nút bấm hoặc input phải có outline khi focus bằng phím tab: `outline-none focus-visible:ring-2 focus-visible:ring-blue-400`.
- **Bo góc (Border Radius):** 
  - Khối lớn (Card, Modal): `rounded-2xl` hoặc `rounded-xl`.
  - Nút bấm, Input, Avatar: `rounded-lg` hoặc `rounded-xl` hoặc `rounded-full`.

## 6. Tiêu chuẩn Component Cụ thể (Component Specifications)

### 6.1. Icons (SVG)
- **Inactive:** `strokeWidth={1.75}`, màu `text-slate-400`.
- **Active:** `strokeWidth={2.25}`, màu `text-blue-600`.
- Không dùng icon thư viện (như FontAwesome), ưu tiên dùng SVG dạng nét (Stroke - Lucide/Heroicons) vẽ trực tiếp hoặc import dạng SVG components.

### 6.2. Nút bấm (Buttons)
- Hạn chế dùng nút có màu nền solid (trừ nút Primary quan trọng nhất).
- **Secondary/Icon Button:** `bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-blue-600 transition-colors rounded-xl`.

### 6.3. Inputs & Search
- Nền `bg-slate-50`, viền `border-slate-200`.
- Khi focus: `focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none`.

### 6.4. Loading Indicator / Spinner dùng chung
- Toàn bộ frontend **BẮT BUỘC** dùng component chung: `src/components/LoadingIndicator.jsx`.
- Không được tự viết spinner riêng bằng `animate-spin`, SVG loading inline, hoặc CSS spinner trong từng file.
- Khi cần loading trong button: dùng `<LoadingIndicator size="sm" tone="white" />` nếu button nền xanh, hoặc `tone="blue"` nếu nền sáng.
- Khi cần loading toàn màn hình/router: dùng `<LoadingIndicator fullScreen size="lg" label="Đang tải..." />`.
- Khi cần overlay loading trong card/modal/camera: dùng `<LoadingIndicator size="md" tone="blue" />` hoặc `size="lg"` nếu overlay lớn.
- Nếu cần biến thể mới, mở rộng props của `LoadingIndicator.jsx`; không tạo component loading thứ hai.

## 7. React Code Convention
- **Thư viện Styling:** SỬ DỤNG 100% Tailwind CSS. Tuyệt đối không viết custom CSS ra file riêng nếu không thực sự cần thiết.
- Tận dụng `shrink-0` cho các elements không được phép co gãy (như Icon, Avatar).
- Tận dụng `truncate` cho các text dài có nguy cơ làm vỡ layout (đặc biệt trên mobile).
- Sử dụng semantic HTML tags (`<header>`, `<main>`, `<aside>`, `<nav>`).
