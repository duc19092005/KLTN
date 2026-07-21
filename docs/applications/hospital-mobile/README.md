# KLTN Patient Mobile

React Native / Expo mobile codebase for the patient-facing portal.

The app lets patients sign in with their phone number and OTP or first-login password, choose linked patient profiles, and view their linked medical visit history transparently.

## 1. Requirements

Install these first:

- Node.js 20+
- npm
- Git
- Android Studio, only needed for local native builds
- Expo/EAS account, only needed for cloud APK builds

Check Node:

```bash
node -v
npm -v
```

## 2. Configure Environment

Install dependencies:

```bash
cd "D:\\Personal Datas\\KLTN\\mobile"
npm install
copy .env.example .env
```

Edit `apps/hospital-mobile/.env`:

```env
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.13:3001/api
```

Use your laptop LAN IP instead of `localhost` when testing on a physical phone over WiFi.

Examples:

```env
# Android phone and laptop on the same WiFi
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.13:3001/api

# Public tunnel for demo
EXPO_PUBLIC_BACKEND_URL=https://your-ngrok-domain.ngrok-free.app/api
```

Do not commit `.env`. It is ignored by git.

## 3. Run Backend First

From the repository root:

```bash
cd "D:\\Personal Datas\\KLTN"
docker compose up -d
```

Or run only the backend manually:

```bash
cd "D:\\Personal Datas\\KLTN\\backend"
npm install
npm run start:dev
```

The mobile app expects:

```text
http://YOUR_BACKEND_HOST:3001/api
```

## 4. Run Mobile For Development

For normal Expo development:

```bash
cd "D:\\Personal Datas\\KLTN\\mobile"
npm start
```

For a native Android run:

```bash
npx expo run:android
```

## 5. Patient OTP Login

The patient portal uses these backend endpoints:

```text
POST /api/patient/auth/request-otp
POST /api/patient/auth/resend-otp
POST /api/patient/auth/verify-otp
```

OTP behavior:

- OTP length: 6 digits
- OTP validity: 5 minutes
- Resend cooldown: 60 seconds
- The app shows a countdown before another OTP can be requested

## 6. Export APK With EAS Cloud Build

Login to Expo:

```bash
npx eas-cli@latest login
```

Configure the project once:

```bash
cd "D:\\Personal Datas\\KLTN\\mobile"
npx eas-cli@latest build:configure
```

Build APK:

```bash
npx eas-cli@latest build -p android --profile preview
```

When the build finishes, EAS prints a download URL. Open that URL, download the `.apk`, and install it on the Android phone.

Important: before building, set `EXPO_PUBLIC_BACKEND_URL` in `eas.json` or through EAS environment variables. Do not use `localhost` in an APK that will run on a phone.

## 7. Export APK Locally Without EAS Cloud

Use this when you want to build on your machine.

Install Android Studio and make sure these are configured:

- Android SDK
- Android SDK Platform Tools
- JDK supported by the installed Android Gradle Plugin
- `ANDROID_HOME` environment variable
- `adb` available in terminal

Generate native Android project:

```bash
cd "D:\\Personal Datas\\KLTN\\mobile"
npx expo prebuild --platform android
```

Build debug APK:

```bash
cd android
.\\gradlew assembleDebug
```

The APK will be here:

```text
apps/hospital-mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Debug APKs are for development only. They expect Metro to be running and can show `Unable to load script` if installed as a standalone app.

Build release APK:

```bash
cd "D:\\Personal Datas\\KLTN\\mobile\\android"
.\\gradlew assembleRelease
```

The unsigned release APK will be here:

```text
apps/hospital-mobile/android/app/build/outputs/apk/release/app-release-unsigned.apk
```

For demo installs without Metro, use the release APK because it packages `index.android.bundle` inside the app.

For a signed production APK, configure an Android keystore first. For demo/internal testing, EAS cloud build is usually simpler because it can manage credentials.

## 8. Install APK On Phone

Option A: copy APK to phone and tap the file.

Option B: install with adb:

```bash
adb install -r "path\\to\\app.apk"
```

If Android blocks the install, enable:

```text
Settings -> Security -> Install unknown apps
```

## 9. Common Issues

### Phone cannot call backend

Do not use `localhost` in `.env` for a physical phone. Use laptop LAN IP or a public tunnel.

Test from phone browser:

```text
http://YOUR_BACKEND_HOST:3001/api/docs
```

### EAS build uses the wrong backend URL

Update the `env` block in `eas.json`, or set EAS environment variables before building. Rebuild the APK after changing the URL.

### OTP does not arrive

In development, the backend may log OTPs to the console if SMS sending is not configured or eSMS balance is insufficient.

## 10. Validation

```bash
npm run typecheck
```
