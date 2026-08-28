# Detailed Controllers Documentation - Backend Hospital API

This document provides a comprehensive specification of all Controllers, Endpoints, HTTP methods, Role-Based Access Control (RBAC), Step-Up Security rules, and business purposes in `apps/hospital-api`.

---

## Table of Contents
1. [Authentication (`AuthController`)](#1-authentication-authcontroller)
2. [Account & Recovery (`AuthRecoveryController`)](#2-account--recovery-authrecoverycontroller)
3. [Audit & Integrity (`AuditController`)](#3-audit--integrity-auditcontroller)
4. [Patient Management (`PatientController`, `PatientVerifyController`)](#4-patient-management)
5. [Patient Authentication (`PatientAuthController`)](#5-patient-authentication-patientauthcontroller)
6. [Patient Portal (`PatientPortalController`)](#6-patient-portal-patientportalcontroller)
7. [Visit Management (`VisitController`)](#7-visit-management-visitcontroller)
8. [Medical Orders & Laboratory (`MedicalOrderController`)](#8-medical-orders--laboratory-medicalordercontroller)
9. [Clinical Decision & AI Consultation (`ClinicalDecisionController`)](#9-clinical-decision--ai-consultation-clinicaldecisioncontroller)
10. [Doctor Management (`DoctorController`)](#10-doctor-management-doctorcontroller)
11. [Staff Management (`StaffController`)](#11-staff-management-staffcontroller)
12. [Department Management (`DepartmentController`)](#12-department-management-departmentcontroller)
13. [AI Model Registry (`AiModelController`)](#13-ai-model-registry-aimodelcontroller)
14. [Notification (`NotificationController`)](#14-notification-notificationcontroller)
15. [System Health (`AppController`)](#15-system-health-appcontroller)

---

## 1. Authentication (`AuthController`)
- **Prefix:** `/api/auth`
- **Description:** Manages internal staff authentication, password credentials, biometric facial vector matching, Web3 wallet challenges, and session cookies.

| Endpoint | Method | RBAC Roles | Step-Up | Purpose |
|---|---|---|---|---|
| `/bootstrap` | `POST` | Public | None | Initialize the first Super Admin account with a bootstrap master secret. |
| `/invite-login` | `POST` | Public | None | Complete first-time setup using an admin-issued invite token. |
| `/staff-login` | `POST` | Public | None | Authenticate staff credentials using username and password. |
| `/change-password` | `POST` | Authenticated (JWT) | None | Change staff password (mandatory upon initial login). |
| `/register-face` | `POST` | Authenticated (JWT) | None | Enroll 128-dimensional biometric facial embedding. |
| `/wallet-bind-challenge` | `POST` | Authenticated (JWT) | None | Generate a cryptographic nonce challenge to bind a Web3 wallet address. |
| `/verify-wallet` | `POST` | Authenticated (JWT) | None | Verify EIP-191 wallet signature and bind wallet to admin profile. |
| `/wallet-challenge/:address` | `GET` | Public | None | Fetch login challenge for a registered Web3 wallet address. |
| `/wallet-login` | `POST` | Public | None | Authenticate admin session via Web3 wallet signature. |
| `/face-challenge` | `POST` | Authenticated (JWT) | None | Issue biometric face verification challenge nonce. |
| `/verify-face` | `POST` | Authenticated (JWT) | None | Match facial vector with stored embedding using Cosine distance (threshold 0.45). |
| `/face-stepup` | `POST` | Authenticated (JWT) | None | Issue a time-limited Face Step-Up Ticket for sensitive actions. |
| `/generate-secret` | `POST` | Authenticated (JWT) | None | Generate MFA/TOTP secret for the active user. |
| `/me` | `GET` | Authenticated (JWT) | None | Retrieve authenticated user identity, role, and verification status. |
| `/profile` | `GET` | Authenticated (JWT) | None | Retrieve detailed staff or doctor profile for the current user. |
| `/logout` | `POST` | Public / JWT | None | Invalidate session and clear `token` HttpOnly cookie. |
| `/face-login/challenge` | `POST` | Public | None | Request a biometric face login challenge for a given username. |
| `/face-login` | `POST` | Public | None | Passwordless login via biometric facial matching. |

---

## 2. Account & Recovery (`AuthRecoveryController`)
- **Prefix:** `/api/auth`
- **Description:** Governs biometric password reset, lost wallet restoration, and on-chain face vector re-synchronization.

| Endpoint | Method | RBAC Roles | Step-Up | Purpose |
|---|---|---|---|---|
| `/forgot-password/challenge` | `POST` | Public | None | Request a biometric password recovery challenge. |
| `/forgot-password/verify-face` | `POST` | Public | None | Verify face embedding to obtain a temporary password reset token. |
| `/forgot-password/reset` | `POST` | Public | None | Reset account password using verified reset token. |
| `/admin-face-recovery/challenge` | `POST` | `ADMIN` | None | Create a challenge to restore damaged local biometric template. |
| `/admin-face-recovery/restore` | `POST` | `ADMIN` | None | Re-sync biometric template from anchored IPFS artifact verified on-chain. |
| `/admin-account-recovery/challenge` | `POST` | Public | None | Start emergency admin account recovery workflow. |
| `/admin-account-recovery/verify-face` | `POST` | Public | None | Validate facial biometrics against on-chain `FaceRegistry`. |
| `/admin-account-recovery/wallet-challenge` | `POST` | Public | None | Issue signature challenge for the new admin wallet address. |
| `/admin-account-recovery/confirm-wallet` | `POST` | Public | None | Rebind admin account to new wallet address. |

---

## 3. Audit & Integrity (`AuditController`)
- **Prefix:** `/api/audit`
- **Description:** Centralized control panel for blockchain checkpoint anchoring, off-chain hash-chain verification, Merkle proof generation, and database self-healing.

| Endpoint | Method | RBAC Roles | Step-Up | Purpose |
|---|---|---|---|---|
| `/logs` | `GET` | `ADMIN` | None | Query paginated hash-chained audit logs with entity, actor, and date filters. |
| `/logs/:seq` | `GET` | `ADMIN` | None | Retrieve single audit log with V2 hashes, diffJson, and RBAC data masking. |
| `/logs/:seq/proof` | `GET` | `ADMIN` | None | Generate independent Merkle Inclusion Proof (sibling hashes). |
| `/verify-chain` | `GET` | `ADMIN` | None | Traverse and verify the complete off-chain monotonic hash-chain. |
| `/batches` | `GET` | `ADMIN` | None | List on-chain Merkle checkpoints committed to `AuditAnchor.sol`. |
| `/batches/:batchId` | `GET` | `ADMIN` | None | Retrieve batch details, audit leaves, and cryptographic integrity summary. |
| `/anchor-now` | `POST` | `ADMIN` | None | Force-seal pending logs into a Merkle batch and anchor on-chain immediately. |
| `/recovery/:batchId` | `POST` | `ADMIN` | `RECOVER_AUDIT_BATCH` | Restore a tampered/missing local batch from verified IPFS artifact. |
| `/recovery/deep-scan/status` | `GET` | `ADMIN` | None | Check progress and diagnostic logs of running deep-scan self-healing. |
| `/recovery/watchdog/status` | `GET` | `ADMIN` | None | View status and schedule of the 20-minute background auto-heal watchdog. |
| `/recovery/deep-scan` | `POST` | `ADMIN` | `DEEP_SCAN_SELF_HEAL` | Trigger full multi-pass database integrity scan against blockchain. |
| `/recovery/entities/warnings` | `GET` | `ADMIN` | None | List clinical entities whose live database values differ from anchored audit logs. |
| `/recovery/entities` | `POST` | `ADMIN` | `RECOVER_AUDIT_ENTITIES` | Overwrite tampered business records with verified audit snapshots. |
| `/recovery/entities/preview` | `POST` | `ADMIN` | None | Dry-run entity recovery to inspect blockers and dependency chains. |

---

## 4. Patient Management
### `PatientController` (`/api/patients`)
| Endpoint | Method | RBAC Roles | Purpose |
|---|---|---|---|
| `/` | `GET` | `ADMIN`, `STAFF`, `DOCTOR` | Search and paginate patient records (by name, code, citizenId, phone). |
| `/` | `POST` | `ADMIN`, `STAFF` | Register a new patient profile at the reception desk. |
| `/:id` | `GET` | `ADMIN`, `STAFF`, `DOCTOR` | View comprehensive patient medical record and visit history. |
| `/:id` | `PATCH` | `ADMIN`, `STAFF` | Update patient demographic and contact details. |
| `/:id` | `DELETE` | `ADMIN` | Archive / soft-delete patient profile. |

### `PatientVerifyController` (`/api/patients/public`)
| Endpoint | Method | RBAC Roles | Purpose |
|---|---|---|---|
| `/verify/:patientCode` | `GET` | Public | Publicly verify existence and integrity hash of a patient record. |

---

## 5. Patient Authentication (`PatientAuthController`)
- **Prefix:** `/api/patient-auth`
| Endpoint | Method | RBAC Roles | Purpose |
|---|---|---|---|
| `/request-otp` | `POST` | Public | Send 6-digit SMS OTP via eSMS gateway to patient phone number. |
| `/resend-otp` | `POST` | Public | Resend OTP after 60-second cooldown period. |
| `/verify-otp` | `POST` | Public | Verify OTP, link existing patient records, and mint patient JWT. |
| `/password-login` | `POST` | Public | Authenticate patient using phone number and set password. |
| `/change-password` | `POST` | `PATIENT` | Update patient account password. |

---

## 6. Patient Portal (`PatientPortalController`)
- **Prefix:** `/api/patient-portal`
| Endpoint | Method | RBAC Roles | Purpose |
|---|---|---|---|
| `/profiles` | `GET` | `PATIENT` | List all patient profiles accessible by the authenticated user. |
| `/profiles` | `POST` | `PATIENT` | Link a family member (child, parent) profile to the user account. |
| `/profiles/:patientId` | `GET` | `PATIENT` | View details of a specific linked profile. |
| `/profiles/:patientId/visits` | `GET` | `PATIENT` | View medical visit history for a linked profile. |
| `/profiles/:patientId/visits/:visitId` | `GET` | `PATIENT` | View detailed consultation summary, prescriptions, and lab orders. |
| `/profiles/:patientId/results/files/:fileId/download` | `GET` | `PATIENT` | Obtain temporary Pre-signed S3 URL to download medical report/X-ray. |
| `/booking/specialties` | `GET` | `PATIENT` | List available medical specialties for appointment booking. |
| `/booking/specialties/:specialty/doctors` | `GET` | `PATIENT` | List active doctors under the chosen specialty. |
| `/booking/doctors/:doctorId/slots` | `GET` | `PATIENT` | Fetch available booking time slots for a doctor on a given date. |
| `/appointments` | `POST` | `PATIENT` | Schedule a new medical consultation appointment. |
| `/appointments` | `GET` | `PATIENT` | View upcoming and past appointments. |
| `/appointments/:id/qr` | `GET` | `PATIENT` | Generate secure HMAC-SHA256 appointment check-in QR code. |
| `/appointments/:id/cancel` | `POST` | `PATIENT` | Cancel an existing appointment. |
| `/checkin/verify-qr` | `POST` | `STAFF`, `ADMIN` | Scan and validate patient appointment QR payload at reception. |
| `/checkin/confirm` | `POST` | `STAFF`, `ADMIN` | Confirm check-in and automatically instantiate a medical `Visit`. |

---

## 7. Visit Management (`VisitController`)
- **Prefix:** `/api/visits`
| Endpoint | Method | RBAC Roles | Purpose |
|---|---|---|---|
| `/` | `GET` | `ADMIN`, `STAFF`, `DOCTOR` | Filter visits by code, clinical status, department, and date. |
| `/` | `POST` | `ADMIN`, `STAFF` | Create an active clinical visit upon patient admission. |
| `/:id` | `GET` | `ADMIN`, `STAFF`, `DOCTOR` | View visit details, triage vital signs, and chief complaint. |
| `/:id/status` | `PATCH` | `ADMIN`, `STAFF`, `DOCTOR` | Transition visit status (`WAITING_DOCTOR`, `IN_CONSULTATION`, `COMPLETED`, `CANCELLED`). |
| `/:id/transfer` | `POST` | `ADMIN`, `DOCTOR` | Transfer visit to another medical department or specialist. |

---

## 8. Medical Orders & Laboratory (`MedicalOrderController`)
- **Prefix:** `/api/medical-orders`
| Endpoint | Method | RBAC Roles | Purpose |
|---|---|---|---|
| `/` | `GET` | `ADMIN`, `STAFF`, `DOCTOR` | List lab/radiology orders filtered by order type and processing state. |
| `/` | `POST` | `DOCTOR`, `ADMIN` | Doctor creates a laboratory/imaging order for a visit. |
| `/:id` | `GET` | `ADMIN`, `STAFF`, `DOCTOR` | Inspect order details and assigned technician. |
| `/:id/status` | `PATCH` | `STAFF`, `DOCTOR`, `ADMIN` | Update order processing lifecycle status. |
| `/:id/results` | `POST` | `STAFF`, `DOCTOR`, `ADMIN` | Enter numerical results, lab findings, and technician notes. |
| `/results/:resultId/files` | `POST` | `STAFF`, `ADMIN` | Upload medical images (DICOM, JPG, PDF) to private AWS S3 bucket. |
| `/results/files/:fileId/download` | `GET` | `DOCTOR`, `STAFF`, `ADMIN` | Generate secure Pre-signed S3 download URL. |

---

## 9. Clinical Decision & AI Consultation (`ClinicalDecisionController`)
- **Prefix:** `/api/clinical-decisions`
| Endpoint | Method | RBAC Roles | Purpose |
|---|---|---|---|
| `/visits/:visitId/results` | `GET` | `DOCTOR`, `ADMIN` | Gather all completed laboratory results for clinical decision making. |
| `/visits/:visitId/history` | `GET` | `DOCTOR`, `ADMIN` | Retrieve longitudinal patient history and allergy warnings. |
| `/visits/:visitId/ai-analysis` | `POST` | `DOCTOR`, `ADMIN` | Request multi-AI diagnostic assistance (Claude, GPT-4o, Gemini). |
| `/ai-diagnoses/:id/review` | `POST` | `DOCTOR`, `ADMIN` | Record doctor review (Accept, Reject, Modify) of AI recommendations. |
| `/visits/:visitId/conclusion` | `POST` | `DOCTOR`, `ADMIN` | **Sign final medical conclusion** (ICD-10 code, treatment plan, prescription). |

---

## 10. Doctor Management (`DoctorController`)
- **Prefix:** `/api/doctors`
| Endpoint | Method | RBAC Roles | Purpose |
|---|---|---|---|
| `/` | `GET` | `ADMIN`, `STAFF` | List doctors with specialties, academic degrees, and departments. |
| `/` | `POST` | `ADMIN` | Create doctor profile with medical license and user credentials. |
| `/:id` | `GET` | `ADMIN`, `STAFF`, `DOCTOR` | Retrieve doctor details and work schedule. |
| `/:id` | `PATCH` | `ADMIN` | Update specialty, experience, and academic title. |
| `/:id/status` | `PATCH` | `ADMIN` | Enable or suspend doctor practicing status. |

---

## 11. Staff Management (`StaffController`)
- **Prefix:** `/api/staffs`
| Endpoint | Method | RBAC Roles | Purpose |
|---|---|---|---|
| `/` | `GET` | `ADMIN` | Paginate hospital staff directory. |
| `/` | `POST` | `ADMIN` | Onboard new staff member and provision system access. |
| `/:id` | `GET` | `ADMIN` | View staff profile, employee code, and department assignment. |
| `/:id` | `PATCH` | `ADMIN` | Modify staff details or reassign department. |
| `/:id/status` | `PATCH` | `ADMIN` | Update active employment status (`ACTIVE`, `INACTIVE`). |

---

## 12. Department Management (`DepartmentController`)
- **Prefix:** `/api/departments`
| Endpoint | Method | RBAC Roles | Purpose |
|---|---|---|---|
| `/` | `GET` | `ADMIN`, `STAFF`, `DOCTOR` | List all functional clinical and administrative departments. |
| `/` | `POST` | `ADMIN` | Create a new department (Cardiology, Radiology, Internal Medicine,...). |
| `/:id` | `GET` | `ADMIN`, `STAFF`, `DOCTOR` | View department roster and appointed manager. |
| `/:id` | `PATCH` | `ADMIN` | Update department name, code, or description. |
| `/:id/manager` | `POST` | `ADMIN` | Appoint or transfer Department Head. |
| `/:id` | `DELETE` | `ADMIN` | Decommission / deactivate department. |

---

## 13. AI Model Registry (`AiModelController`)
- **Prefix:** `/api/ai-models`
| Endpoint | Method | RBAC Roles | Purpose |
|---|---|---|---|
| `/` | `GET` | `ADMIN`, `DOCTOR` | List registered AI models with accuracy ratings and versions. |
| `/` | `POST` | `ADMIN` | Register a new LLM provider model (OpenAI, Claude, Gemini). |
| `/:id` | `GET` | `ADMIN`, `DOCTOR` | Inspect model configuration, temperature, and token parameters. |
| `/:id` | `PATCH` | `ADMIN` | Update API parameters or provider endpoints. |
| `/:id/status` | `PATCH` | `ADMIN` | Toggle model operational availability. |
| `/:id/stats` | `GET` | `ADMIN` | Track consultation count, doctor acceptance rate, and latency. |
| `/:id/test` | `POST` | `ADMIN` | Run diagnostic connectivity test against the AI provider. |

---

## 14. Notification (`NotificationController`)
- **Prefix:** `/api/notifications`
| Endpoint | Method | RBAC Roles | Purpose |
|---|---|---|---|
| `/` | `GET` | Authenticated | Fetch active user notifications. |
| `/:id/read` | `PATCH` | Authenticated | Mark notification as read. |
| `/read-all` | `POST` | Authenticated | Mark all notifications as read. |

---

## 15. System Health (`AppController`)
- **Prefix:** `/api`
| Endpoint | Method | RBAC Roles | Purpose |
|---|---|---|---|
| `/health` | `GET` | Public | Liveness probe verifying PostgreSQL, Blockchain RPC, and IPFS status. |
| `/version` | `GET` | Public | Retrieve active API version and runtime environment. |