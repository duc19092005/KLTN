# Mobile Application - Patient Portal (Expo React Native)

Ứng dụng di động Cổng thông tin Bệnh nhân (Patient Portal) xây dựng bằng **Expo React Native** và **TypeScript**, cung cấp trải nghiệm khám chữa bệnh thông minh, minh bạch và không giấy tờ cho người bệnh.

---

## 📱 Các Tính Năng Nổi Bật

1. **Đăng Nhập Nhanh Qua SMS OTP:**
   - Xác thực số điện thoại tức thì qua tin nhắn OTP SMS.
   - Tự động liên kết và đồng bộ toàn bộ hồ sơ khám bệnh lịch sử tại bệnh viện.

2. **Đặt Lịch Khám Trực Tuyến & Mã QR Check-in:**
   - Chọn chuyên khoa, chọn bác sĩ và đặt khung giờ khám mong muốn.
   - Tự động sinh **Mã QR Check-in mã hóa** để quét tự động tại quầy tiếp đón bệnh viện.

3. **Tra Cứu Bệnh Án & Kết Quả Y Tế:**
   - Xem kết quả xét nghiệm sinh hóa, huyết học và báo cáo chẩn đoán hình ảnh.
   - Tải tệp PDF kết quả và ảnh X-Quang chất lượng cao từ đám mây AWS S3.
   - Tra cứu đơn thuốc và hướng dẫn điều trị của bác sĩ.

---

## ⚙️ Cài Đặt & Khởi Chạy

### 1. Cài đặt Dependencies
```bash
cd apps/hospital-mobile
npm install
```

### 2. Cấu hình Biến Môi trường
```bash
cp .env.example .env
```
Cấu hình địa chỉ IP máy chủ Backend API:
```env
EXPO_PUBLIC_API_URL=http://<IP_MAY_TINH_CUA_BAN>:3001/api
```

### 3. Khởi chạy Ứng dụng Expo
```bash
# Khởi chạy Expo Metro Bundler
npx expo start

# Chạy trên máy ảo Android
npx expo start --android

# Chạy trên máy ảo iOS (macOS)
npx expo start --ios
```
Sử dụng ứng dụng **Expo Go** trên điện thoại để quét mã QR và trải nghiệm trực tiếp.