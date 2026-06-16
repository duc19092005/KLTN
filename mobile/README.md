# KLTN NFC Mobile

React Native / Expo mobile codebase for two NFC surfaces:

- Receptionist scanner: pairs with the web receptionist flow, scans a blank NFC CCCD card, and sends the card data to backend SSE.
- Patient portal: scans the same NFC CCCD card, then asks the backend to return patient history with DB and blockchain verification.

## Setup

```bash
cd mobile
npm install
cp .env.example .env
npm run android
```

Set the backend URL in `.env`:

```env
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.10:3001/api
EXPO_PUBLIC_SCANNER_DEVICE_LABEL=Reception Desk NFC Phone
```

Use the laptop LAN IP instead of `localhost` when testing on a physical phone over WiFi.

## NFC Card Payload

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

## Native NFC Note

`react-native-nfc-manager` requires native code. Use a dev build/prebuild on a real NFC-capable phone. Expo Go will not be enough for real NFC scans.

## Validation

```bash
npm run typecheck
```
