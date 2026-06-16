---
name: hospital-management-system
description: Domain expert for the KLTN Hospital Management System project. Focuses strictly on business rules, workflows, invariants, and code review checklists.
category: project
risk: safe
source: local
---

# Hospital Management System Rules (KLTN)

You are the domain expert for the KLTN Hospital Management System. This skill defines the strict business rules, workflows, domain invariants, and anti-patterns you must enforce. 

For the canonical Domain Model and Architectural constraints, always refer to the project root's `AGENTS.md`.

## 1. Domain Invariants

These are strict, unbreakable rules. If your code violates these, it is incorrect.

- **A Visit must belong to exactly one Patient.**
- **A Visit cannot be COMPLETED without an assigned Doctor and a final MedicalConclusion.**
- **Only a DOCTOR can finalize a Diagnosis (MedicalConclusion).**
- **AI Diagnosis CANNOT finalize a diagnosis; it only suggests.**
- **A MedicalResult must belong to a valid MedicalOrder, which in turn belongs to a Visit.**
- **BlockchainAudit (`BlockchainLogger`) records are completely immutable once created.**

## 2. Core Workflows

### Patient Intake & Queue (Receptionist)
1. **Registration**: Capture patient data. If biometric authentication is used, capture face via InsightFace, generate `faceEmbedding`, and anchor the `faceHash` on-chain for tamper evidence.
2. **Assignment**: Assign the Patient to a `ClinicalRoom` (which maps to a `DoctorProfile`).
3. **State Management**: Initialize the `Visit` state to `WAITING`.

### NFC CCCD Demo Workflow
1. **Card format**: Blank NFC cards are NDEF Text records containing `KLTN_CCCD` version `1` JSON with `citizenId`, `fullName`, `dateOfBirth`, `gender`, `address`, and optional `issuedAt`.
2. **Receptionist scanner**: The web creates a one-time NFC session; the mobile app scans the card and submits the payload with `sessionId` + `mobileToken`; backend streams the result to the web over SSE.
3. **Patient portal**: The patient mobile app scans the card; backend finds `Patient` by `citizenId` and reuses the existing public patient verification use case so blockchain integrity checks remain identical to the Home flow.
4. **Security boundary**: The blank NFC card is a demo data carrier, not a trusted identity proof. Production must add a second factor or signed card payload.
5. **Blockchain boundary**: Never store CCCD, patient PII, or raw NFC JSON on-chain. Only hashes/timestamps/audit metadata may be anchored.

### Clinical Diagnostic Workflow (Doctor)
1. **Review**: The Doctor reviews the Patient's history, current `Visit` details, and any `MedicalResult`s from `MedicalOrder`s.
2. **AI Assistance**: The Doctor reviews `AiDiagnosis` suggestions based on the clinical data.
3. **Conclusion**: The Doctor writes the `MedicalConclusion` (final diagnosis, treatment plan, prescription).
4. **Finalization**: The Visit state transitions to `COMPLETED`. The `MedicalConclusion` is hashed, and the hash is anchored on-chain via `BlockchainLogger`.

## 3. State Machine: Visit Status

You must rigorously enforce these state transitions. Do not invent new states. Do not jump states illegitimately.

```text
WAITING (Patient checked in, waiting in room)
  ↓
IN_PROGRESS (Doctor is examining the patient)
  ↓
WAITING_TEST_RESULT (Doctor ordered tests, waiting for lab/imaging)
  ↓
WAITING_CONCLUSION (Tests returned, waiting for doctor to finalize)
  ↓
COMPLETED (Doctor issued MedicalConclusion)
```
*Note: `CANCELLED` is an alternate terminal state that can occur before completion.*

## 4. Blockchain Rules

The blockchain layer exists strictly for audit and tamper detection. 

**Store On-Chain:**
- Hashes (`hash256` of canonical JSON snapshots)
- Timestamps
- Audit Metadata (Action type, Actor ID, Entity Type)

**NEVER Store On-Chain:**
- Patient PII (Names, Citizen IDs, Contact Info)
- Diagnosis Content (Free text notes, treatment plans)
- Files (PDFs, X-Ray images, MRI images - these go to Cloudinary)

**Blockchain Purpose:**
- Integrity verification.
- Tamper detection.
- Unbreakable audit trails.

## 5. AI Diagnosis Rules

AI is an assistant, not a replacement.

**AI Can:**
- Suggest potential diagnoses.
- Analyze uploaded results (e.g., imagery, text).
- Generate confidence scores.

**AI Cannot:**
- Finalize a diagnosis (create a `MedicalConclusion` without doctor action).
- Prescribe medication.
- Override a Doctor's decision.
- **Doctor approval is explicitly required for all AI outputs.**

## 6. Anti-Patterns

If you are doing any of the following, you are violating the project guidelines:

- **Never** use `any` in TypeScript.
- **Never** bypass RBAC (`@Roles()` guards must be used).
- **Never** skip the blockchain audit trigger when a critical entity (Patient, Visit, Department, Conclusion) is modified.
- **Never** attempt to store medical files, PII, or large strings directly on the blockchain.
- **Never** directly modify a Visit state in the database without going through the designated state-transition methods (which enforce business logic).
- **Never** hardcode role checks inside controllers; rely on the NestJS Auth Guards.

## 7. Review Checklist

When asked to review code, you MUST mentally check off these items before approving or suggesting changes:

- [ ] **RBAC Checked**: Are the correct `@Roles()` applied to the controller/endpoint?
- [ ] **State Transitions**: Does the code respect the 6-state Visit state machine?
- [ ] **Transaction Boundaries**: Are multi-table mutations wrapped in a Prisma transaction?
- [ ] **Prisma Relations**: Are foreign keys and relation objects correctly managed (e.g., creating a MedicalConclusion updates the Visit)?
- [ ] **Audit Triggers**: Are modifications generating the appropriate `BlockchainLogger` entry?
- [ ] **AI Approval**: Is there a hard boundary preventing AI from automatically fulfilling a Doctor's role?
- [ ] **Integrity**: Are files securely uploaded to Cloudinary with their URLs/metadata properly referenced in the DB?
