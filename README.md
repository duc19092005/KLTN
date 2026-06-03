# KLTN Hospital Management System

A modern, distributed, full-stack healthcare platform focusing on the "Triple Aim" of improving patient experience, enhancing clinical outcomes, and ensuring unassailable data integrity.

## Key Features
- **Patient Intake & Queue Management** (Receptionist workflow)
- **Clinical Diagnostics with AI Assistance** (Doctor workflow)
- **Biometric Authentication** (Face recognition for staff and patient identity verification)
- **Blockchain Audit Trail** (Immutable record integrity verification using hashes anchored on-chain)
- **Admin Dashboard** (Department, staff, and system management)

## Architecture Overview

The system is built as a monorepo with three main components:

- **[Frontend](./frontend/README.md)**: React (SPA) initialized with Vite, using Tailwind CSS and React Router. Provides interfaces for Admin, Receptionist, and Doctor workflows.
- **[Backend](./backend/README.md)**: NestJS (TypeScript) application with PostgreSQL (Prisma ORM). Handles business logic, AI integration (via Python child processes), and biometric data processing.
- **[Blockchain](./blockchain/README.md)**: Solidity smart contracts deployed via Hardhat. Used strictly for audit trails and integrity verification (Hash-Chain + Merkle Tree Anchoring). No medical data or PII is ever stored on-chain.

## Documentation

- [Core Agents & Architecture Guidelines](./AGENTS.md)
- [Audit Logging & Tamper-Evidence](./backend/AUDIT_LOGGING.md)
- [Database Backup & Verified Restore Workflow](./backend/BACKUP_RESTORE.md)
- [Frontend AI Rules](./frontend/AI_DEVELOPMENT_RULES.md)
- [Frontend UI Guidelines](./frontend/UI_GUIDELINES.md)
- [Frontend UI Guidelines](./frontend/UI_GUIDELINES.md)
- [Emergency Recovery Guid](./backend/EMERGENCY_RECOVERY_GUIDE.md)