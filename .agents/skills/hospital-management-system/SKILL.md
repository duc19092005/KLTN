---
name: hospital-management-system
description: Domain expert for the KLTN Hospital Management System project. Understands the complete clinical workflow, biometric authentication, blockchain audit trails, and system architecture.
category: project
risk: safe
source: local
---

# Hospital Management System Expert (KLTN)

You are the domain expert for the KLTN Hospital Management System, a full-stack healthcare platform integrating AI diagnostics, biometric authentication, and blockchain-based audit trails.

## When to Use

- When working on features specific to hospital operations, patient management, or clinical workflows.
- When implementing or modifying business logic related to patient intake, doctor examination, or administrative tasks.
- When dealing with biometric authentication flows or blockchain auditing within the hospital context.
- When ensuring data integrity and strict state transitions across the patient lifecycle.

## Project Architecture Overview

The system relies on a modern, distributed architecture:
- **Backend**: NestJS (TypeScript) with TypeORM and PostgreSQL.
- **Frontend**: React (Vite) with Tailwind CSS, utilizing a custom cyan-600 Design System ("Hospital OS").
- **Blockchain**: Solidity smart contracts (Hardhat, Ethers.js) deployed locally to maintain immutable audit trails.
- **AI/ML**: Python (TensorFlow, InsightFace) integrated as child processes for facial recognition and diagnostic assistance.

## Key Roles (RBAC)

1. **ADMIN**: Manages system configurations, departments, staff accounts, and oversees blockchain audit integrity.
2. **RECEPTIONIST**: Handles high-speed patient intake, registration (including facial biometrics), and manages the examination queue.
3. **DOCTOR**: Reviews patient records, utilizes AI diagnostic assistance, and finalizes clinical examination records.

## Core Workflows

### 1. Patient Intake & Queue Management (Receptionist)
- **Registration**: New patients are registered. If biometric, face templates are captured via InsightFace and their hashes are anchored on-chain (`FaceRegistry`) for tamper evidence.
- **Queueing**: Patients are assigned to specific clinical rooms based on specialist assignments.
- **State Machine Enforcement**: Visits follow strict state transitions (`WAITING` -> `IN_PROGRESS` -> `COMPLETED`).

### 2. Clinical Diagnostic Workflow (Doctor)
- **Review**: Doctors review pending AI-generated diagnostic suggestions based on clinical data.
- **Finalization**: Doctors finalize the diagnosis and generate medical orders/prescriptions.
- **Integrity**: Finalized clinical records are hashed, and hashes are anchored to the blockchain (`AuditAnchor`) to ensure immutability and ZKP verification readiness.

### 3. Biometric Authentication Pipeline
- Uses **InsightFace** for generating highly accurate facial embeddings.
- Face matching relies on a strict **Euclidean distance threshold** (e.g., <= 0.6) for reliable verification without unauthorized bypasses.
- Face template hashes are stored on-chain. Before matching, the backend performs automated tamper-detection checks against the blockchain.

### 4. Blockchain Audit Trail Integrity
- **Unified Ownership**: Contracts (`DepartmentRegistry`, `FaceRegistry`, `AuditAnchor`) inherit from a core `IdentityRegistry` for administrative control.
- **Verification Service**: A backend service can recompute database record hashes and compare them against immutable on-chain values, flagging any tampering for admin review.

## Best Practices & Business Rules

1. **Strict State Transitions**: Never bypass the visit state machine. A visit must be `WAITING` before it can be `IN_PROGRESS`.
2. **Atomic Operations**: Use database transactions for multi-step clinical record updates to prevent race conditions (especially with unique code generation).
3. **Security First**: Clinical data is highly sensitive. Ensure RBAC guards are strictly enforced on all API endpoints. Cloud storage access must be authenticated.
4. **Audit Integrity**: Any critical change to a patient record, department, or biometric data MUST trigger a blockchain audit anchor.
5. **UI/UX Consistency**: Maintain the minimalist, high-speed "Hospital OS" design system. Prioritize concise, action-oriented data representations and master-detail workspaces to reduce cognitive load for front-line staff.

## Important Files & References

- Backend Entities & Services: `/backend/src/modules/*/` and `/backend/src/infrastructure/audit/`
- Smart Contracts: `/blockchain/contracts/`
- Frontend Features: `/frontend/src/features/` (admin, receptionist, doctor)

Follow these domain rules meticulously to ensure a secure, robust, and highly efficient clinical management system.
