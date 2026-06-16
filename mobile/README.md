# KLTN NFC Mobile

React Native / Expo mobile codebase for two NFC surfaces:

- Receptionist scanner: pairs with the web receptionist flow, scans a blank NFC CCCD card, and sends the card data to backend SSE.
- Patient portal: scans the same NFC CCCD card, then asks the backend to return patient history with DB and blockchain verification.

The app uses `react-native-nfc-manager`, so real NFC scans require a native Android build on a real NFC-capable phone. Expo Go is not enough.

## 1. Requirements

Install these first:

- Node.js 20+
- npm
- Git
- Android phone with NFC enabled
- Android Studio, only needed for local builds
- Expo/EAS account, only needed for cloud APK builds

Check Node:

```bash
node -v
npm -v
```

## 2. Configure Environment

Install dependencies:

```bash
cd "D:\Personal Datas\KLTN\mobile"
npm install
copy .env.example .env
```

Edit `mobile/.env`:

```env
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.10:3001/api
EXPO_PUBLIC_SCANNER_DEVICE_LABEL=Reception Desk NFC Phone
```

Use your laptop LAN IP instead of `localhost` when testing on a physical phone over WiFi.

Examples:

```env
# Android phone and laptop on the same WiFi
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.10:3001/api

# Public tunnel for demo
EXPO_PUBLIC_BACKEND_URL=https://your-ngrok-domain.ngrok-free.app/api
```

Do not commit `.env`. It is ignored by git.

## 3. Run Backend First

From the repository root:

```bash
cd "D:\Personal Datas\KLTN"
docker compose up -d
```

Or run only the backend manually:

```bash
cd "D:\Personal Datas\KLTN\backend"
npm install
npm run start:dev
```

The mobile app expects:

```text
http://YOUR_BACKEND_HOST:3001/api
```

## 4. Run Mobile For Development

Because NFC needs native code, use a native Android run:

```bash
cd "D:\Personal Datas\KLTN\mobile"
npx expo run:android
```

This creates an Android native build and installs it on the connected device or emulator.

For NFC testing, use a real phone. Android emulators normally cannot scan physical NFC cards.

## 5. NFC Card Payload

Write the blank NFC card as an NDEF Text record:

```json
{
  "type": "KLTN_CCCD",
  "version": 1,
  "citizenId": "079203000001",
  "fullName": "Nguyen Van An",
  "dateOfBirth": "2003-04-12",
  "gender": "MALE",
  "address": "Ho Chi Minh City",
  "issuedAt": "2024-01-15"
}
```

The app rejects cards that are not `KLTN_CCCD` version `1`.

## 6. Export APK With EAS Cloud Build

This is the easiest way to get a downloadable `.apk`.

Login to Expo:

```bash
npx eas-cli@latest login
```

Configure the project once:

```bash
cd "D:\Personal Datas\KLTN\mobile"
npx eas-cli@latest build:configure
```

Build APK:

```bash
npx eas-cli@latest build -p android --profile preview
```

When the build finishes, EAS prints a download URL. Open that URL, download the `.apk`, and install it on the Android phone.

The `preview` profile is defined in `mobile/eas.json`:

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

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
cd "D:\Personal Datas\KLTN\mobile"
npx expo prebuild --platform android
```

Build debug APK:

```bash
cd android
.\gradlew assembleDebug
```

The APK will be here:

```text
mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Build release APK:

```bash
cd "D:\Personal Datas\KLTN\mobile\android"
.\gradlew assembleRelease
```

The unsigned release APK will be here:

```text
mobile/android/app/build/outputs/apk/release/app-release-unsigned.apk
```

For a signed production APK, configure an Android keystore first. For demo/internal testing, EAS cloud build is usually simpler because it can manage credentials.

## 8. Install APK On Phone

Option A: copy APK to phone and tap the file.

Option B: install with adb:

```bash
adb install -r "path\to\app.apk"
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

### NFC button says device does not support NFC

Use a real Android phone with NFC hardware. Turn NFC on in Android settings.

### Expo Go cannot scan NFC

Correct. This app needs native code through `react-native-nfc-manager`. Use `npx expo run:android` or build an APK.

### EAS build uses the wrong backend URL

Update the `env` block in `eas.json`, or set EAS environment variables before building. Rebuild the APK after changing the URL.

## 10. Validation

```bash
npm run typecheck
```
