# Ứng Dụng Mobile Dành Cho Bệnh Nhân KLTN (Hospital Mobile App)

Mã nguồn ứng dụng di động Cổng thông tin Bệnh nhân (Patient Portal) phát triển bằng React Native / Expo.

Ứng dụng cho phép bệnh nhân đăng nhập bằng số điện thoại OTP hoặc mật khẩu đăng nhập lần đầu, chọn hồ sơ bệnh nhân liên kết và tra cứu lịch sử khám chữa bệnh minh bạch.

---

## 1. Yêu Cầu Tiền Đề (Requirements)

Cần cài đặt trước các công cụ sau:

- **Node.js**: Phiên bản 20+
- **npm**
- **Git**
- **Android Studio**: Chỉ cần thiết nếu xây dựng bản build native trên máy cá nhân
- **Tài khoản Expo / EAS**: Chỉ cần thiết nếu xuất bản APK qua dịch vụ đám mây EAS Cloud Build

Kiểm tra phiên bản Node:

```bash
node -v
npm -v
```

---

## 2. Cấu Hình Môi Trường Phát Triển

Cài đặt các thư viện phụ thuộc:

```bash
cd apps/hospital-mobile
npm install
cp .env.example .env
```

Chỉnh sửa tệp `apps/hospital-mobile/.env`:

```env
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.13:3001/api
```

> [!TIP]
> Khi chạy ứng dụng trên thiết bị di động thật thông qua mạng Wi-Fi, hãy dùng địa chỉ IP LAN của máy tính thay vì dùng `localhost`.

Ví dụ cấu hình:

```env
# Điện thoại Android và máy tính kết nối chung mạng Wi-Fi
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.13:3001/api

# Sử dụng tên miền ngrok công khai cho bản Demo
EXPO_PUBLIC_BACKEND_URL=https://your-ngrok-domain.ngrok-free.app/api
```

Không commit tệp `.env` lên hệ thống quản lý phiên bản Git.

---

## 3. Khởi Chạy Máy Chủ Backend

Khởi chạy từ thư mục gốc của repository:

```bash
docker compose up -d
```

Hoặc khởi chạy máy chủ Backend thủ công:

```bash
cd apps/hospital-api
npm install
npm run start:dev
```

Ứng dụng di động mong đợi kết nối API theo định dạng:

```text
http://ĐỊA_CHỈ_IP_BACKEND:3001/api
```

---

## 4. Khởi Chạy Ứng Dụng Mobile

Chạy môi trường phát triển Expo tiêu chuẩn:

```bash
cd apps/hospital-mobile
npm start
```

Khởi chạy trực tiếp trên thiết bị/giả lập Android native:

```bash
npx expo run:android
```

---

## 5. Quy Trình Đăng Nhập OTP Bệnh Nhân

Cổng thông tin bệnh nhân sử dụng các API Backend sau:

```text
POST /api/patient/auth/request-otp     # Yêu cầu gửi mã OTP
POST /api/patient/auth/resend-otp      # Gửi lại mã OTP
POST /api/patient/auth/verify-otp      # Xác thực mã OTP
```

Quy định mã OTP:
- Độ dài mã OTP: 6 chữ số
- Thời hạn hiệu lực: 5 phút
- Thời gian đếm ngược gửi lại (Cooldown): 60 giây
- Ứng dụng hiển thị bộ đếm ngược trước khi bệnh nhân có thể yêu cầu gửi lại OTP mới.

---

## 6. Xuất File APK Bằng Dịch Vụ EAS Cloud Build

Đăng nhập tài khoản Expo:

```bash
npx eas-cli@latest login
```

Khởi tạo cấu hình dự án (chỉ thực hiện 1 lần):

```bash
cd apps/hospital-mobile
npx eas-cli@latest build:configure
```

Thực hiện đóng gói file APK trên Cloud:

```bash
npx eas-cli@latest build -p android --profile preview
```

Sau khi quá trình build hoàn tất, hệ thống EAS sẽ cung cấp đường dẫn tải về. Mở liên kết đó trên điện thoại Android để tải và cài đặt tệp `.apk`.

---

## 7. Xuất File APK Thủ Công Trên Máy Local

Cài đặt Android Studio và đảm bảo cấu hình đầy đủ các biến môi trường:
- Android SDK & Android SDK Platform Tools
- Java Development Kit (JDK) tương thích
- Biến môi trường `ANDROID_HOME`
- Công cụ `adb` có sẵn trong đường dẫn hệ thống

Khởi tạo dự án Android native:

```bash
cd apps/hospital-mobile
npx expo prebuild --platform android
```

Đóng gói file Debug APK:

```bash
cd android
.\gradlew assembleDebug
```

Tệp APK sau khi tạo nằm tại đường dẫn:

```text
apps/hospital-mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Đóng gói file Release APK (Dùng cho Demo/Cài đặt trực tiếp không cần Metro):

```bash
cd apps/hospital-mobile/android
.\gradlew assembleRelease
```

Tệp Release APK nằm tại:

```text
apps/hospital-mobile/android/app/build/outputs/apk/release/app-release-unsigned.apk
```

---

## 8. Cài Đặt Tệp APK Lên Điện Thoại Android

**Cách 1:** Chép tệp APK vào bộ nhớ điện thoại và nhấn cài đặt trực tiếp.

**Cách 2:** Cài đặt nhanh bằng câu lệnh ADB:

```bash
adb install -r "duong\\dan\\toi\\app.apk"
```
