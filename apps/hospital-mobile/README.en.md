# Mobile Application - Patient Portal (Expo React Native)

The mobile patient portal application built with **Expo React Native** and **TypeScript**, delivering a modern, paperless, and transparent healthcare experience for patients.

---

## 📱 Key Features

1. **Seamless SMS OTP Authentication:**
   - Instant phone number verification via 6-digit SMS OTP.
   - Automatic discovery and synchronization of historical hospital records.

2. **Online Appointment Booking & QR Check-in:**
   - Search specialties, select attending doctors, and reserve consultation slots.
   - Automated generation of secure HMAC-SHA256 encrypted QR codes for self-service reception check-in.

3. **Medical Records & Test Results:**
   - Real-time access to laboratory findings and radiology reports.
   - Secure download of PDF reports and imaging assets directly from AWS S3.
   - Clear digital prescriptions and physician consultation conclusions.

---

## ⚙️ Setup & Execution

### 1. Install Dependencies
```bash
cd apps/hospital-mobile
npm install
```

### 2. Configure Environment Variables
```bash
cp .env.example .env
```
Set the Backend API endpoint:
```env
EXPO_PUBLIC_API_URL=http://<YOUR_LOCAL_IP>:3001/api
```

### 3. Start Expo Application
```bash
# Start Expo Metro Bundler
npx expo start

# Run on Android Emulator
npx expo start --android

# Run on iOS Simulator (macOS)
npx expo start --ios
```
Use the **Expo Go** mobile app to scan the generated terminal QR code.