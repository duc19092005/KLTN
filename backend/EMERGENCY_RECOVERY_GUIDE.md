# Hướng dẫn Khôi phục Dữ liệu Khẩn cấp (A-Z)

Tài liệu này hướng dẫn chi tiết từ A-Z cách khôi phục lại dữ liệu hệ thống (Database Restore) bằng công cụ Command Line (CLI) qua SSH kết hợp với trang ký số ngoại băng `recovery-signer.html`.

## Khi nào cần sử dụng phương pháp này?
Phương pháp này (Out-of-Band Recovery) được thiết kế cho các kịch bản tồi tệ nhất (Worst-case scenarios):
- **Database bị hacker xóa hoặc mã hóa**: Dữ liệu bảng `User` bị mất, Admin không thể đăng nhập vào Web Dashboard.
- **Dữ liệu sinh trắc học bị sai lệch**: Không thể sử dụng Face Scan để xác thực khôi phục dữ liệu như bình thường.
- **Hệ thống Web/API bị sập**: Bạn chỉ có quyền truy cập vào server thông qua màn hình Terminal (SSH).

Trong hoàn cảnh này, vì không thể tin tưởng database hiện tại, hệ thống sử dụng **Ví Web3 (MetaMask)** của Admin (đã được đăng ký quyền lực trên Blockchain thông qua contract `IdentityRegistry`) làm "Chìa khóa gốc" (Root of Trust) thay thế cho xác thực mật khẩu/khuôn mặt.

---

## Các bước thực hiện (A-Z)

### Bước 1: SSH vào Server
Sử dụng SSH key hoặc mật khẩu của Server để đăng nhập vào máy chủ đang chạy hệ thống Backend.
```bash
ssh username@your-server-ip
```

### Bước 2: Di chuyển vào thư mục Backend & Chuẩn bị file Backup
Tìm và chuẩn bị đường dẫn tới file Database Backup hợp lệ (ví dụ: file dump `.sql` hoặc thư mục backup).
```bash
cd /path/to/Hospital-Management-System/backend
```

### Bước 3: Khởi chạy lệnh Khôi phục khẩn cấp
Chạy lệnh phục hồi khẩn cấp kèm theo đường dẫn file backup:
```bash
npm run db:emergency-restore /path/to/your-backup-file.sql
```

### Bước 4: Lấy mã Thử thách (Challenge)
Lúc này, script trên Terminal sẽ dừng lại và in ra màn hình một chuỗi Thử thách động (Dynamic Cryptographic Challenge) ngẫu nhiên để chống tấn công phát lại (Replay attack).
- Màn hình sẽ hiển thị dạng:
  ```text
  [!] YÊU CẦU XÁC THỰC QUYỀN ADMIN.
  [!] Vui lòng ký chuỗi thử thách sau bằng ví Web3 của bạn:
  
  EMERGENCY_DATABASE_RESTORE_CHALLENGE:1738592301:0xAbC...
  ```
- **Hành động:** Bôi đen và copy (sao chép) toàn bộ chuỗi bắt đầu bằng `EMERGENCY_...` này.

### Bước 5: Mở công cụ Ký số Ngoại băng (`recovery-signer.html`)
Công cụ ký số này nằm hoàn toàn ở Frontend/Local, là file HTML tĩnh không cần mạng backend.
1. Tìm file `recovery-signer.html` nằm trong thư mục `backend/` của source code máy cá nhân của bạn (hoặc truy cập URL tĩnh nếu bạn đã host nó trên Github Pages/S3).
2. Click đúp để mở file này trên **trình duyệt Web (Chrome/Edge/Brave) máy cá nhân** (máy phải có cài sẵn Extension MetaMask).

### Bước 6: Kết nối Ví MetaMask
Tại giao diện trang `Hospital OS Emergency Signer`:
1. Bấm vào nút **"Kết nối ví MetaMask"**.
2. Một popup MetaMask sẽ hiện ra yêu cầu xác nhận, hãy chọn đúng tài khoản ví Web3 của Admin.

### Bước 7: Dán Challenge và Ký số
1. Dán (Paste) chuỗi Challenge bạn vừa copy ở Bước 4 vào ô nhập liệu **"1. Dán chuỗi Challenge cứu hộ từ Terminal"**.
2. Bấm nút **"Ký thông điệp cứu hộ"**.
3. MetaMask sẽ bật lên một lần nữa hiển thị nội dung thông điệp. Đọc kỹ và bấm **Sign (Ký)**.

### Bước 8: Sao chép Chữ ký và Trả về Server
1. Sau khi ký xong trên MetaMask, ô **"2. Sao chép Chữ ký số tạo được"** trên web sẽ tự động điền một chuỗi Hash (bắt đầu bằng `0x...`).
2. Bấm nút **"Sao chép chữ ký"**.
3. Quay lại cửa sổ Terminal (SSH) trên Server đang chờ, dán (Paste) chuỗi chữ ký này vào dấu nhắc lệnh và nhấn `Enter`.

### Bước 9: Chờ Hệ thống Kiểm định và Phục hồi
Hệ thống Backend (script) sẽ tự động:
1. Giải mã chữ ký bằng `ethers.js` để tìm ra địa chỉ ví Public Key của người vừa ký.
2. Kết nối trực tiếp xuống **Blockchain (Smart Contract)** đọc `IdentityRegistry` để kiểm tra xem Public Key này có quyền Superadmin hay không.
3. Nếu hợp lệ, hệ thống sẽ thực thi quy trình Drop Database cũ và Restore file SQL backup để làm sạch hoàn toàn hệ thống.
4. Màn hình SSH báo "RESTORE SUCCESS".

Lúc này, bạn đã khôi phục lại dữ liệu an toàn và có thể khởi động lại server bình thường.
