# NFC Mobile Flow

This document is the canonical handoff for the demo NFC feature.

## Card Format

Blank NFC cards must be written as an NDEF Text record containing this JSON:

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

Rules:

- `type` must be `KLTN_CCCD`.
- `version` must be `1`.
- `gender` must be `MALE`, `FEMALE`, or `OTHER`.
- The NFC card is a demo data carrier, not a cryptographic proof of identity.
- Do not store this raw card payload on-chain.

## Receptionist Scanner Flow

```text
Receptionist web
  POST /api/nfc-sessions
  receives sessionId, mobileToken, pairingPayload
  opens GET /api/nfc-sessions/:sessionId/events as SSE

Receptionist mobile app
  reads pairingPayload or manual sessionId/mobileToken
  scans KLTN_CCCD card
  POST /api/mobile/receptionist/nfc-sessions/:sessionId/result

Backend
  validates DTO
  marks the one-time session as SCANNED
  streams NFC_SCAN_COMPLETED to the web SSE client
```

The web must still let the receptionist use manual CCCD entry for demo fallback.

## Patient Portal Flow

```text
Patient mobile app
  taps login
  scans KLTN_CCCD card
  POST /api/mobile/patient/nfc-login

Backend
  finds Patient by citizenId
  calls the existing VerifyPatientPublicUseCase
  returns the same DB + blockchain verification payload used by Home

Mobile app
  renders patient profile, visits, conclusion hashes, and verification status
```

This keeps the old Home verification semantics but replaces the public search input with a physical NFC action.

## Backend Endpoints

```text
POST /api/nfc-sessions
GET  /api/nfc-sessions/:sessionId/events
POST /api/mobile/receptionist/nfc-sessions/:sessionId/result
POST /api/mobile/patient/nfc-login
```

`POST /api/nfc-sessions` and the SSE endpoint are protected with `JwtAuthGuard`, `RolesGuard`, and `ADMIN`/`RECEPTIONIST` roles.

The mobile receptionist result endpoint is protected by the one-time `sessionId` + `mobileToken` pair. It does not create or mutate Patient/Visit records.

The patient NFC login endpoint is a demo identification flow. For production, add a second factor such as OTP, face verification, or a signed card payload.

## Mobile Project

Directory: `mobile/`

```text
mobile/
  App.tsx
  .env.example
  src/
    apps/
      receptionist-scanner/
      patient-portal/
    shared/
      api/
      components/
      env.ts
      nfc/
      theme/
      types/
```

Environment:

```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:3001/api
EXPO_PUBLIC_SCANNER_DEVICE_LABEL=Reception Desk NFC Phone
```

NFC uses `react-native-nfc-manager`, so use an Expo dev build/prebuild for real devices. Expo Go is not enough for this native module.
