# Frontend Web Application - Hospital Management Portal (React + Vite)

Cổng thông tin Web quản trị bệnh viện và bàn làm việc chuyên môn xây dựng trên nền tảng **React**, **Vite**, **Tailwind CSS** và **Lucide Icons**, hỗ trợ xác thực Web3 MetaMask, nhận diện khuôn mặt qua Webcam máy tính và giám sát chuỗi khối Blockchain trong suốt.

---

## 🖥️ Các Phân Hệ Chức Năng Chính

1. **Bàn Khám Bác Sĩ (Doctor Clinical Workspace):**
   - Tiếp nhận danh sách chờ khám theo khoa phòng.
   - Nhập triệu chứng lâm sàng, tra cứu tiền sử bệnh án và dị ứng thuốc.
   - Tham vấn chẩn đoán AI đa mô hình (Claude, GPT, Gemini).
   - Ra y lệnh chỉ định xét nghiệm/X-quang và ký kết luận bệnh án ICD-10.

2. **Phân Hệ Cận Lâm Sàng (Technician Laboratory Workspace):**
   - Tiếp nhận phiếu chỉ định xét nghiệm và chụp chiếu.
   - Nhập chỉ số kết quả sinh hóa, huyết học.
   - Tải lên ảnh y tế (X-quang, CT, MRI, PDF) trực tiếp lên AWS S3 Private.

3. **Bảng Điều Khiển Kiểm Toán Blockchain (Blockchain Audit Dashboard):**
   - Giám sát luồng Checkpoint on-chain thời gian thực.
   - Trực quan hóa cây Merkle và trích xuất Merkle Inclusion Proof.
   - Bảng điều khiển Deep Scan & Tự phục hồi dữ liệu (Self-Healing UI) yêu cầu xác thực Face Step-Up.

4. **Quản Trị Bệnh Viện (Hospital Administration):**
   - Quản lý hồ sơ nhân sự, bác sĩ và bổ nhiệm trưởng khoa.
   - Quản lý cơ cấu khoa phòng và đăng ký mô hình AI y tế.

---

## ⚙️ Cài Đặt & Khởi Chạy

### 1. Cài đặt Dependencies
```bash
cd apps/hospital-web
npm install
```

### 2. Cấu hình Môi trường
```bash
cp .env.example .env
```
Thiết lập URL kết nối API Backend:
```env
VITE_API_URL=http://localhost:3001/api
```

### 3. Khởi chạy Ứng dụng
```bash
# Chế độ phát triển (Development)
npm run dev

# Build sản xuất
npm run build
npm run preview
```
Ứng dụng sẽ chạy tại địa chỉ: `http://localhost:5173`.