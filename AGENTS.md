# KLTN Hospital Management System - Core Agents Guidelines

This document provides the high-level project overview, architectural decisions, and the definitive canonical Domain Model based on the Prisma schema. All AI agents working on this project MUST read this file to understand the system structure before proceeding to specific tasks. 

For strict business rules, domain invariants, and code review checklists, refer to the `hospital-management-system` skill.

## 1. Project Overview

The KLTN Hospital Management System is a modern, distributed, full-stack healthcare platform. It focuses on the "Triple Aim" of improving patient experience, enhancing clinical outcomes, and ensuring unassailable data integrity.

**Key Features:**
- **Patient intake & queue management** (Receptionist workflow)
- **Clinical diagnostics with AI assistance** (Doctor workflow)
- **Biometric authentication** (Face recognition for staff and patient identity verification)
- **Blockchain audit trail** (Immutable record integrity verification using hashes anchored on-chain)
- **Admin dashboard** (Department, staff, and system management)

## 2. Architecture Decisions

The system is built on a strictly defined technology stack. **Do not propose deviations from these choices unless explicitly requested.**

**Backend:**
- **Framework**: NestJS (TypeScript).
- **Architecture**: Feature-based modules (e.g., `patient`, `visit`, `clinical-decision`).
- **Database**: PostgreSQL.
- **ORM**: Prisma ORM (Canonical schema is at `backend/prisma/schema.prisma`).
- **File Storage**: Cloudinary (Medical files, avatars, etc.).

**Frontend:**
- **Framework**: React (SPA) initialized with Vite.
- **Routing**: React Router v6.
- **Styling**: Tailwind CSS (custom cyan-600 palette, "Hospital OS" design system).

**Blockchain:**
- **Purpose**: Audit trails and integrity verification ONLY.
- **Data Policy**: **NO** medical data, PII, PDFs, or X-Rays are ever stored on-chain. Only hashes, timestamps, and metadata (via `BlockchainLogger` and Solidity registries).
- **Stack**: Solidity, Hardhat, Ethers.js v6.

**AI/ML:**
- **Purpose**: Diagnostic suggestions, biometric facial embedding.
- **Stack**: Python, TensorFlow, InsightFace.
- **Integration**: Python scripts integrated as child processes via the backend.

**Mobile NFC:**
- **Framework**: Expo React Native in `mobile/`.
- **Purpose**: NFC demo surfaces for receptionist intake and patient portal access.
- **NFC Library**: `react-native-nfc-manager`.
- **Environment**: `EXPO_PUBLIC_BACKEND_URL` in `mobile/.env`; never commit `.env`.
- **Card Format**: Blank NFC cards are NDEF Text records containing `KLTN_CCCD` version `1` JSON.

## 3. Project Conventions & Coding Standards

When writing code for this project, adhere to the following standards:

- **Validation**: Strict DTO validation using `class-validator` and `class-transformer` is required for all inputs.
- **Transactions**: Use database transactions (`prisma.$transaction`) for multi-step workflows to ensure atomic operations (e.g., creating a visit + generating a code + assigning a room).
- **Controllers**: No business logic in controllers. Controllers handle HTTP routing and DTOs; Services handle business logic.
- **Folder Structure**: Strictly feature-based folder structure on both frontend (`features/admin`, `features/receptionist`) and backend (`modules/visit`, `modules/department`).
- **Soft Deletes**: Use soft deletes (status flags) for business entities where possible, rather than hard deleting records.

## 4. Core Domain Model

This is the canonical representation of the system's entities based on the Prisma schema.

### User & Authentication
- **User**: The root identity (`username`, `email`, `passwordHash`, `role`, `status`). Handles biometrics (`faceEmbedding`, `faceHash`, `failedFaceAttempts`).
- **UserRoles**: `ADMIN`, `RECEPTIONIST`, `DOCTOR`, `LAB_MANAGER`.
- **Profiles**: `AdminProfile`, `StaffProfile`, `DoctorProfile` (DoctorProfile belongs to StaffProfile).

### Hospital Structure
- **Department**: Logical groupings (`type`: CLINICAL, LABORATORY, IMAGING, etc.). Can receive orders if `canReceiveOrders` is true. Contains `StaffProfile`s.
- **ClinicalRoom**: Physical rooms where visits happen. Belongs to a specific `DoctorProfile`.

### Core Clinical Flow (The Visit Tree)
The `Visit` is the central aggregate root for clinical interactions.
```text
Patient
 └─ Visit
      ├─ ClinicalRoom (Where it happens)
      ├─ Doctor (Who is responsible)
      ├─ MedicalOrder (Tests ordered during visit)
      │    └─ MedicalResult (Results of the tests)
      │         └─ MedicalResultFile (Cloudinary URLs)
      ├─ AiDiagnosis (AI suggestions based on data)
      ├─ MedicalConclusion (The final, doctor-approved outcome)
      └─ BlockchainLogger (Integrity anchors for the Visit and its children)
```

### NFC Identification Flow

The NFC feature does not replace the Patient or Visit aggregate. It only changes how CCCD data enters the system.

```text
Blank NFC card
 └─ KLTN_CCCD v1 JSON
      ├─ Receptionist scanner app
      │    └─ Backend NFC session
      │         └─ SSE result to receptionist web intake form
      └─ Patient portal app
           └─ Backend finds Patient by citizenId
                └─ Existing patient verification use case checks DB + blockchain
```

The canonical demo payload is:

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

The NFC card is a demo data carrier, not a cryptographic proof. Never store CCCD, patient PII, or raw NFC payloads on-chain.

### 5. Medical Result Definitions

The `MedicalResult` entity represents the outcome of a `MedicalOrder`. Because `orderType` is a flexible string, here are the standardized intended types and structure.

**MedicalResult Types (Intended values for `MedicalOrder.orderType`):**
- `LAB_TEST`
- `XRAY`
- `MRI`
- `CT_SCAN`
- `ULTRASOUND`
- `ECG`
- `PDF_REPORT`

**MedicalResult Fields (Schema Mapping):**
- `resultCode`: Unique identifier.
- `orderId`: Link back to `MedicalOrder`.
- `performedById`: Link to the `User` (e.g., LAB_MANAGER) who performed the test.
- `note`: Textual conclusion or observation.
- `files`: Array of `MedicalResultFile` relations containing:
  - `fileName`, `originalName`, `mimeType`, `size`
  - `url` (Cloudinary URL).

*Note: Verification by a doctor occurs when the Doctor finalizes the overall `MedicalConclusion` for the Visit.*
