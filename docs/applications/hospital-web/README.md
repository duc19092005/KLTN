**🌐 Ngôn ngữ / Language:** [🇻🇳 Tiếng Việt](README.md) · [🇬🇧 English](README.en.md) · [🇷🇺 Русский](README.ru.md)

# Ứng Dụng Web Quản Lý Bệnh Viện KLTN (Hospital Web Frontend)

Giao diện Web Quản trị & Nghiệp vụ Y tế dành cho Bệnh viện KLTN, xây dựng trên nền tảng React 18, TypeScript, Tailwind CSS và Vite.

---

## Các Chức Năng Chính

- **Phân Quyền Theo Vai Trò (RBAC)**: Giao diện và quy trình làm việc riêng biệt dành cho Quản trị viên (Admin), Bác sĩ (Doctor), và Lễ tân / Kỹ thuật viên (Receptionist / Lab Manager).
- **Xác Thực Sinh Trắc Học**: Tích hợp quét nhận diện khuôn mặt AI trực tiếp trên trình duyệt phục vụ đăng nhập an toàn và xác thực nâng cao cho các thao tác nhạy cảm (Face Step-Up).
- **Giao Diện Hiện Đại (Modern UI)**: Thiết kế chuẩn hệ thống giao diện "Hospital OS" với thiết kế cao cấp, chuyển động mượt mà và tối ưu trải nghiệm người dùng.

---

## Hướng Dẫn Cài Đặt & Chạy Ứng Dụng

```bash
# 1. Cài đặt các thư viện phụ thuộc
npm install

# 2. Cấu hình biến môi trường
# Tạo file .env và cấu hình URL API Backend tương ứng
cp .env.example .env

# 3. Khởi chạy máy chủ phát triển (Development Server)
npm run dev

# 4. Biên dịch sản phẩm (Production Build)
npm run build
```

---

## Tài Liệu Hướng Dẫn Liên Quan

- [Quy tắc thiết kế giao diện UI Guidelines](../../architecture/frontend-ui-guidelines.md)
- [Quy tắc phát triển Frontend cho AI Agents](../../architecture/frontend-ai-rules.md)
