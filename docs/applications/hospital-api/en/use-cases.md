# Detailed Use Cases Documentation - Backend Hospital API

This document details all business Use Cases implemented across `apps/hospital-api`, covering execution workflows, transactional invariants, business constraints, and audit trail events.

---

## Table of Contents
1. [Authentication & Security Use Cases](#1-authentication--security-use-cases)
2. [Clinical Decision & Multi-AI Consultation](#2-clinical-decision--multi-ai-consultation)
3. [Medical Orders & Laboratory](#3-medical-orders--laboratory)
4. [Patient Portal Use Cases](#4-patient-portal-use-cases)
5. [Patient Management](#5-patient-management)
6. [Visit Management](#6-visit-management)
7. [Doctor & Staff Management](#7-doctor--staff-management)
8. [Department Management](#8-department-management)
9. [AI Model Registry](#9-ai-model-registry)

---

## 1. Authentication & Security Use Cases

### 1.1. `BootstrapAdminUseCase`
- **Purpose:** Onboard the first hospital Super Admin upon system provisioning.
- **Inputs:** `username`, `email`, `secret`.
- **Invariants:**
  - Validates that no existing Super Admin exists to prevent unauthorized overwrite.
  - Matches the input secret against the `BOOTSTRAP_ADMIN_SECRET` environment variable.
  - Creates the Admin user, sets temporary password hash, initializes `AdminProfile`, and emits `CREATE` audit log.

### 1.2. `PasswordLoginUseCase` & `StaffLoginUseCase`
- **Purpose:** Staff credential authentication.
- **Rules:** Enforces rate limiting (maximum 5 failed attempts in 15 minutes), checks `tokenVersion`, and validates `ACTIVE` status.

### 1.3. `VerifyFaceUseCase` & `VerifyFaceForStepUpUseCase`
- **Purpose:** Biometric facial verification for login and Step-Up ticket issuance.
- **Algorithm:** Computes Cosine similarity distance between the 128-d input vector and enrolled biometric embedding (acceptance threshold $\le 0.45$).
- **Integrity:** Validates single-use cryptographic challenge nonces to prevent replay attacks.

### 1.4. `VerifyWalletUseCase` & `WalletLoginUseCase`
- **Purpose:** Web3 cryptographic signature authentication for administrative operations.
- **Rules:** Recovers public address from EIP-191 signature (`ecrecover`) and verifies authority via on-chain `IdentityRegistry.isAuthorized(wallet)`.

### 1.5. `AdminWalletRecovery*` & `AdminFaceRecovery*`
- **Purpose:** Emergency restoration of lost admin credentials or damaged biometric vectors.
- **Rules:** Performs cross-validation against the on-chain `FaceRegistry` contract and decentralized IPFS bundle.

---

## 2. Clinical Decision & Multi-AI Consultation

### 2.1. `GenerateAiAnalysisUseCase`
- **Purpose:** Dispatches anonymized clinical symptoms, vital signs, and lab reports to the Multi-AI Gateway.
- **Workflow:**
  - Aggregates visit clinical data and completed `MedicalResult` records.
  - Anonymizes Personally Identifiable Information (PII).
  - Routes payload to the designated AI provider (Claude 3.5 Sonnet, GPT-4o, Gemini 1.5 Pro).
  - Records response in `AiDiagnosis` with token usage metrics, latency, and model config hash.

### 2.2. `ReviewAiDiagnosisUseCase`
- **Purpose:** Logs attending doctor review and clinical agreement on AI recommendations.
- **Rules:** Records physician verdict (`ACCEPTED`, `REJECTED`, `MODIFIED`) with clinical justification to populate ethical AI audit data (`AiQuality`).

### 2.3. `CreateMedicalConclusionUseCase`
- **Purpose:** Signs the definitive medical diagnosis and treatment conclusion.
- **Invariants:**
  - Verifies visit state validity.
  - Captures ICD-10 diagnostic codes, prescriptions, and physician instructions.
  - Atomic transaction: Transitions visit status to `COMPLETED`, persists `MedicalConclusion`, and computes cryptographic `hashSnapshot`.
  - Emits immutable `CREATE` audit log to `BlockchainLogger`.

---

## 3. Medical Orders & Laboratory

### 3.1. `CreateMedicalOrderUseCase`
- **Purpose:** Physician creates laboratory or diagnostic imaging orders.
- **Rules:** Generates standardized order code (`ORD-YYYYMMDD-XXXXX`) and targets the appropriate lab department (Radiology, Hematology,...).

### 3.2. `CreateMedicalResultUseCase`
- **Purpose:** Lab technician enters numeric results, observations, and findings.
- **Rules:** Transitions order state to `COMPLETED` and computes SHA-256 integrity hash of results.

### 3.3. `MapUploadedResultFilesUseCase`
- **Purpose:** Links uploaded medical imaging files (DICOM, JPG, PDF) from AWS S3 to the result.
- **Rules:** Records `storageProvider = S3`, `bucket`, `objectKey`, and SHA-256 checksum to detect cloud tampering.

---

## 4. Patient Portal Use Cases

### 4.1. `CreatePatientProfileUseCase`
- **Purpose:** Allows patients to create self or dependent healthcare profiles.
- **Rules:** Generates unique patient code (`PAT-YYYYMMDD-XXXXX`) and binds access rights with `SELF`, `CHILD`, or `PARENT` relationship.

### 4.2. `CreateAppointmentUseCase`
- **Purpose:** Online appointment scheduling.
- **Rules:**
  - Validates 30-minute doctor consultation slots (8:00 - 16:30).
  - Prevents booking overlaps for the same physician and time window.
  - Automatically issues an HMAC-SHA256 encrypted QR check-in payload valid for 60 days.

### 4.3. `CheckInAppointmentUseCase`
- **Purpose:** Automated reception check-in via appointment QR scanning.
- **Workflow & Invariants:**
  - Decrypts and validates QR HMAC-SHA256 signature.
  - Updates `Appointment` status to `CONFIRMED`.
  - Automatically instantiates an active `Visit` record in the clinical database and queues the patient.

---

## 5. Patient Management

### 5.1. `CreatePatientUseCase`
- **Purpose:** Direct on-site patient registration by hospital staff.
- **Rules:** Enforces unique Citizen ID (`citizenId`) and national medical code; computes initial `dataSalt` and `hash256`.

### 5.2. `VerifyPatientPublicUseCase`
- **Purpose:** Public endpoint for third parties (insurers, patients) to verify record validity and cryptographic integrity hash.

---

## 6. Visit Management

### 6.1. `CreateVisitUseCase`
- **Purpose:** Opens a new clinical visit episode for an admitted patient.
- **Rules:** Generates unique `visitCode`, captures initial triage vital signs, and assigns to doctor queue.

### 6.2. `ListVisitsUseCase`
- **Purpose:** Flexible multi-criteria query service for clinical consultations.

---

## 7. Doctor & Staff Management

### 7.1. `CreateDoctorWithStaffUseCase`
- **Purpose:** Doctor onboarding workflow.
- **Workflow:** Executes atomic transaction creating `User` account, `StaffProfile`, and `DoctorProfile` with practicing license number.

### 7.2. `CreateStaffUseCase` & `UpdateStaffUseCase`
- **Purpose:** Manages staff employment lifecycle, department transfers, and access roles.

---

## 8. Department Management

### 8.1. `CreateDepartmentUseCase` & `AssignManagerUseCase`
- **Purpose:** Establishes clinical/administrative departments and appoints department heads.
- **Rules:** Enforces unique `departmentCode` and validates manager staff membership.

---

## 9. AI Model Registry

### 9.1. `CreateAiModelUseCase` & `TestAiModelApiUseCase`
- **Purpose:** Registers and tests LLM providers (Claude 3.5, GPT-4o, Gemini) before clinical deployment.
- **Integrity:** Securely encrypts provider API keys and versions system prompts and parameter configurations.