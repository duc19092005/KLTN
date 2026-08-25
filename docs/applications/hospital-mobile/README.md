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

## 6. Build APK Bằng EAS Cloud (Khuyến Nghị)

Profile `preview` đã được cấu hình để tạo file `.apk` và dùng remote Android credentials trên Expo.

### 6.1. Kiểm tra trước khi build

Chạy các lệnh từ thư mục gốc repository:

```bash
cd apps/hospital-mobile
npm install
npm run typecheck
```

Đăng nhập EAS nếu máy chưa đăng nhập:

```bash
npx -y eas-cli@22.4.0 login
```

Kiểm tra tài khoản hiện tại (không bắt buộc):

```bash
npx -y eas-cli@22.4.0 whoami
```

### 6.2. Build file APK

```bash
npx -y eas-cli@22.4.0 build --platform android --profile preview
```

Cấu hình hiện tại của profile `preview`:

| Thuộc tính | Giá trị |
|---|---|
| Phân phối | `internal` |
| Android output | `.apk` |
| Backend EAS preview | `https://api.abc.vn/api` |
| Android credentials | Remote credentials trên Expo |

Khi EAS hỏi có cài APK vào Android Emulator hay không:

```text
Install and run the Android build on an emulator? (Y/n)
```

chọn `n` nếu máy không cài Android Studio/Emulator. Việc này chỉ bỏ qua bước cài tự động, không hủy APK đã build.

Sau khi build hoàn tất, EAS hiển thị một đường dẫn dạng:

```text
https://expo.dev/accounts/<account>/projects/<project>/builds/<build-id>
```

Mở đường dẫn trên điện thoại Android để tải và cài file APK.

> [!IMPORTANT]
> APK EAS là bản cài trực tiếp trên Android. Khi cài lần đầu, điện thoại có thể yêu cầu cho phép cài ứng dụng từ nguồn không xác định.

### 6.3. Khác nhau giữa các profile

- `preview`: tạo APK để demo và cài nội bộ.
- `production`: hiện được cấu hình tạo Android App Bundle (`.aab`) để phát hành lên Google Play, không dùng để tải APK trực tiếp.

### 6.4. Các cảnh báo/lỗi thường gặp

#### Build đã xong nhưng báo `spawn emulator ENOENT`

Nếu log đã có dòng `Build finished` và đã cung cấp link Expo thì APK đã build thành công. Lỗi này chỉ cho biết máy local không tìm thấy Android Emulator. Tải APK từ link Expo hoặc build lại rồi chọn `n` ở câu hỏi cài Emulator.

#### Cảnh báo `cli.appVersionSource`

Thông báo `The field "cli.appVersionSource" is not set` chỉ là cảnh báo chuyển tiếp của EAS, không làm hỏng APK hiện tại.

#### APK không kết nối được Backend

Không cấu hình `localhost` cho APK cài trên điện thoại thật. Hãy dùng URL HTTPS public cho build EAS hoặc IP LAN của máy Backend nếu điện thoại và máy tính cùng Wi-Fi.

Biến `EXPO_PUBLIC_BACKEND_URL` trong `.env` dùng cho chạy local; biến trong profile `preview` của `eas.json` được dùng khi build trên EAS.

---

## 7. Build APK Local Trên Linux/Fedora (Tùy Chọn)

Cách này cần Android Studio, Android SDK, JDK tương thích và `adb`. Đảm bảo `ANDROID_HOME` hoặc `ANDROID_SDK_ROOT` đã được cấu hình.

Khởi tạo dự án Android native:

```bash
cd apps/hospital-mobile
npx expo prebuild --platform android
```

Build Debug APK trên Linux/macOS:

```bash
cd android
./gradlew assembleDebug
```

Trên Windows dùng:

```powershell
cd android
gradlew.bat assembleDebug
```

Tệp APK sau khi tạo nằm tại đường dẫn:

```text
apps/hospital-mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Build Release APK local:

```bash
cd apps/hospital-mobile/android
./gradlew assembleRelease
```

> [!WARNING]
> Release APK local cần cấu hình signing để dùng trong môi trường production. Để demo/cài nhanh, dùng APK từ EAS profile `preview` là đơn giản và ổn định hơn.

---

## 8. Cài Đặt Tệp APK Lên Điện Thoại Android

**Cách 1:** Chép tệp APK vào bộ nhớ điện thoại và nhấn cài đặt trực tiếp.

**Cách 2:** Cài đặt nhanh bằng câu lệnh ADB:

```bash
adb install -r "/đường/dẫn/tới/app.apk"
```

Nếu điện thoại chưa được nhận diện, bật **Developer options** và **USB debugging**, sau đó kiểm tra:

```bash
adb devices
```
