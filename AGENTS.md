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
- **File Storage**: AWS S3 private bucket for medical files/PDFs/images; Cloudinary for non-sensitive staff/doctor avatars.

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

**Patient Mobile:**
- **Framework**: Expo React Native in `mobile/`.
- **Purpose**: Patient portal for OTP/password login, linked profile selection, and transparent linked medical history access.
- **Authentication**: Phone OTP through `patient-auth`; OTP is valid for 5 minutes and can be resent after a 60-second cooldown.
- **Environment**: `EXPO_PUBLIC_BACKEND_URL` in `mobile/.env`; never commit `.env`.

## 3. Project Conventions & Coding Standards

When writing code for this project, adhere to the following standards:

- **Validation**: Strict DTO validation using `class-validator` and `class-transformer` is required for all inputs.
- **Transactions**: Use database transactions (`prisma.$transaction`) for multi-step workflows to ensure atomic operations (e.g., creating a visit + generating a code + assigning a room).
- **Controllers**: No business logic in controllers. Controllers handle HTTP routing and DTOs; Services handle business logic.
- **Folder Structure**: Strictly feature-based folder structure on both frontend (`features/admin`, `features/receptionist`) and backend (`modules/visit`, `modules/department`).
- **Soft Deletes**: Use soft deletes (status flags) for business entities where possible, rather than hard deleting records.
- **Terminology Boundary**: Never translate or model `Department` as doctor `specialty`. In this system, `Department` means an operational hospital unit/clinic/lab/imaging area that owns staff, rooms, orders, and workflow capacity. Doctor `specialty` is a clinical expertise label such as `Nội tổng quát`, `Tim mạch`, or `Hô hấp`, currently used as a profile/form classification and AI model recommendation tag.

## 4. Core Domain Model

This is the canonical representation of the system's entities based on the Prisma schema.

### User & Authentication
- **User**: The root identity (`username`, `email`, `passwordHash`, `role`, `status`). Handles biometrics (`faceEmbedding`, `faceHash`, `failedFaceAttempts`).
- **UserRoles**: `ADMIN`, `RECEPTIONIST`, `DOCTOR`, `LAB_MANAGER`.
- **Profiles**: `AdminProfile`, `StaffProfile`, `DoctorProfile` (DoctorProfile belongs to StaffProfile).

### Hospital Structure
- **Department**: An operational hospital unit or service area (`type`: CLINICAL, LABORATORY, IMAGING, etc.). It can contain `StaffProfile`s, receive orders if `canReceiveOrders` is true, and represent places/workflows where patients are routed. **Do NOT treat Department as a doctor's medical specialty.** A clinical department/clinic may have doctors working inside it, but it is not the canonical list of specialties.
- **Doctor Specialty**: A doctor-facing clinical expertise/category label stored on `DoctorProfile` and reused by AI model recommendation fields. Examples: `Nội tổng quát`, `Ngoại tổng quát`, `Nhi khoa`, `Sản phụ khoa`, `Tim mạch`, `Tai Mũi Họng`, `Răng Hàm Mặt`, `Mắt`, `Da liễu`, `Thần kinh`, `Chấn thương chỉnh hình`, `Tiêu hóa`, `Nội tiết`, `Ung bướu`, `Hô hấp`. Use this specialty list for doctor forms and AI recommended specialty selectors; do not fetch Departments for this purpose.
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
      │         └─ MedicalResultFile (S3 metadata; legacy Cloudinary URLs remain readable)
      ├─ AiDiagnosis (AI suggestions based on data)
      ├─ MedicalConclusion (The final, doctor-approved outcome)
      └─ BlockchainLogger (Integrity anchors for the Visit and its children)
```

### Patient Mobile Access Flow

The mobile app does not use NFC. Patients authenticate by phone OTP and then access only patient profiles linked to that phone number.

```text
Patient phone number
 └─ Backend patient-auth
      ├─ Request OTP
      ├─ Resend OTP after 60-second cooldown
      └─ Verify OTP
           └─ JWT with PATIENT role and linked patient IDs
                └─ Patient portal fetches linked visit history
```

OTP payloads and patient access tokens are never stored on-chain. Blockchain remains an audit/integrity layer only.

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
  - `storageProvider`, `bucket`, `objectKey`, `sha256`, `etag`
  - `url` (legacy provider URL only; S3 uploads do not use public URLs).

*Note: Verification by a doctor occurs when the Doctor finalizes the overall `MedicalConclusion` for the Visit.*
