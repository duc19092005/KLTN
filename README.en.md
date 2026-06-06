**🌐 Language:** [🇻🇳 Tiếng Việt](./README.md) · [🇬🇧 English](./README.en.md) · [🇷🇺 Русский](./README.ru.md)

# KLTN Hospital Management System

> A modern, full-stack healthcare platform pursuing the **Triple Aim**: better patient experience, sharper clinical outcomes, and unassailable data integrity.

## Overview

A hospital management system that combines **biometric authentication**, **AI-assisted diagnosis**, and a **blockchain audit trail** so every medical record can be proven intact — even if the server is compromised.

### Core features

| Workflow | Description |
|---|---|
| **Reception** | Patient intake, queue management, ID verification |
| **Doctor** | Medical records + AI diagnostic suggestions + on-chain anchored conclusions |
| **Laboratory** | Process medical orders, upload results to Cloudinary |
| **Admin** | Manage departments, staff, AI models, audit logs, backups |

### Distinctive security mechanisms

- **Biometric authentication:** face verification for both staff and patients
- **Step-up sessions ("sudo mode"):** one face scan opens a privileged window so users don't have to scan repeatedly
- **Auto-lock screen:** iPhone-style, user-configurable 1–15 minutes
- **Blockchain anchoring:** only hashes + Merkle roots are anchored, **never medical data**
- **Out-of-band recovery:** Web3 signing off-server when the DB is compromised

---

## Architecture

A monorepo with three independent components:

```text
KLTN/
├── backend/      NestJS + Prisma + PostgreSQL
├── frontend/     React + Vite + Tailwind
├── blockchain/   Solidity + Hardhat
├── docs/         Topic-organized technical docs
└── tools/        Emergency HTML tools (offline)
```

| Layer | Stack | Role |
|---|---|---|
| **[Backend](./backend/README.en.md)** | NestJS, TypeScript, Prisma, PostgreSQL | Business logic, AI integration (Python child process), biometric processing |
| **[Frontend](./frontend/README.en.md)** | React (Vite), Tailwind, React Router v6 | SPA for 4 roles: Admin, Receptionist, Doctor, Lab Manager |
| **[Blockchain](./blockchain/README.en.md)** | Solidity, Hardhat, Ethers.js v6 | Audit trails + integrity verification (hashes + Merkle only, no PII) |
| **AI/ML** | Python 3.12, TensorFlow, InsightFace | Diagnostic suggestions, 128-D face embeddings |

---

## Quick start

### Requirements

- Docker + Docker Compose
- Node.js 20+
- (Optional) MetaMask to test the wallet flow

### Run everything via Docker

```bash
docker compose up -d
# Backend:  http://localhost:3001/api
# Frontend: http://localhost:5173
# Postgres: localhost:5432
# Hardhat:  http://localhost:8545
```

### Or run each part separately

```bash
# Backend
cd backend && npm install && npm run start:dev

# Frontend
cd frontend && npm install && npm run dev

# Blockchain (local node + deploy)
cd blockchain && npm install
npx hardhat node                          # terminal 1
npx hardhat run scripts/deploy.js --network localhost  # terminal 2
```

---

## Documentation

Full table of contents in [`docs/README.en.md`](./docs/README.en.md).

### By topic

| Topic | Documents |
|---|---|
| **Architecture** | [Backend Clean Architecture](./docs/architecture/backend.md) · [File Structure](./docs/architecture/backend-file-structure.md) · [Frontend UI](./docs/architecture/frontend-ui-guidelines.md) |
| **Security** | [Tiers & Anchoring Policy](./docs/security/tiers-and-anchoring.md) · [Audit Logging](./docs/security/audit-logging.md) |
| **Backup & DR** | [Overview](./docs/backup-recovery/overview.md) · [Backup CLI](./docs/backup-recovery/backup-restore-cli.md) · [Emergency Restore](./docs/backup-recovery/emergency-restore.md) |
| **Standalone tools** | [Break-Glass Viewer](./tools/break-glass-viewer/README.en.md) · [Recovery Signer](./tools/recovery-signer/README.en.md) |
| **For AI/Agents** | [AGENTS.md](./AGENTS.md) |

> [!NOTE]
> The deep technical docs under `docs/architecture/`, `docs/security/`, and `docs/backup-recovery/` are kept in Vietnamese only. Multi-language coverage is limited to the README set above.

### FAQ

| Question | Answer |
|---|---|
| What are Tier A vs Tier B step-up? | [docs/security/tiers-and-anchoring.md](./docs/security/tiers-and-anchoring.md) |
| When does anchoring happen immediately vs in 5-min batches? | [docs/security/tiers-and-anchoring.md](./docs/security/tiers-and-anchoring.md) |
| When do automatic backups run? How does Admin trigger one? | [docs/backup-recovery/overview.md](./docs/backup-recovery/overview.md) |
| How do the two HTML tools differ? | [tools/README.en.md](./tools/README.en.md) |
| The DB was wiped completely. How do I restore? | [docs/backup-recovery/emergency-restore.md](./docs/backup-recovery/emergency-restore.md) |

---

## Development conventions

- **Backend:** Feature-based modules (`modules/visit`, `modules/department`, etc.). Validation via `class-validator`. Multi-step workflows use `prisma.$transaction`.
- **Frontend:** Feature-based folders (`features/admin`, `features/receptionist`). Tailwind cyan-600 palette. Soft delete for business entities.
- **Blockchain:** Only hash + Merkle root + metadata are anchored. **Never** PII, medical files, or X-rays.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, ...).

More details in [AGENTS.md](./AGENTS.md).
