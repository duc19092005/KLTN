**🌐 Ngôn ngữ / Language:** [🇻🇳 Tiếng Việt](README.md) · [🇬🇧 English](README.en.md) · [🇷🇺 Русский](README.ru.md)

# Máy Chủ API Quản Lý Bệnh Viện KLTN (Hospital API Backend)

Hệ thống Backend enterprise dành cho ngành Y tế phát triển trên NestJS, cung cấp RESTful APIs quản lý bệnh nhân, xác thực sinh trắc học, giao tiếp database PostgreSQL và neo vết kiểm toán (Audit Trail) trên Blockchain.

---

## Hướng Dẫn Cài Đặt & Khởi Chạy

```bash
# 1. Cài đặt các thư viện phụ thuộc
npm install

# 2. Cấu hình biến môi trường
# Sao chép .env.example thành .env và điền đầy đủ các thông số (Database URL, Blockchain RPC, Cloudinary, AWS S3, v.v.)
cp .env.example .env

# 3. Khởi tạo Prisma Client
npm run prisma:generate

# 4. Thực thi Database Migration
npx prisma migrate deploy
# Hoặc dùng `npx prisma db push` cho môi trường phát triển local

# 5. Khởi chạy máy chủ phát triển Backend
npm run start:dev
```

---

## Tài Liệu Hướng Dẫn Chi Tiết

- **Quy trình Phân quyền:** [Roles & Permissions](roles-and-permissions.md)
- **Quy trình Kiểm toán & Blockchain:** Để tìm hiểu chi tiết về thuật toán mã hóa Merkle tree và cơ chế neo dữ liệu lên Smart Contract, xem thêm tại [AUDIT_LOGGING.md](../../security/audit-logging.md).
