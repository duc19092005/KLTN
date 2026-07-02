**🌐 Language:** [🇻🇳 Tiếng Việt](./README.md) · [🇬🇧 English](./README.en.md) · [🇷🇺 Русский](./README.ru.md)

# KLTN Hospital Management System

> A modern, full-stack healthcare platform pursuing the **Triple Aim**: better patient experience, sharper clinical outcomes, and unassailable data integrity.

> [!TIP]

## Overview

A hospital management system that combines **biometric authentication**, **AI-assisted diagnosis**, and a **blockchain audit trail** so every medical record can be proven intact — even if the server is compromised.

### Core features

| Workflow | Description |
|---|---|
| **Reception** | Patient intake, queue management, ID verification |
| **Doctor** | Medical records + AI diagnostic suggestions + on-chain anchored conclusions |
| **Laboratory** | Process medical orders, upload results to private AWS S3 |

### Distinctive security mechanisms

- **Biometric authentication:** face verification for both staff and patients
- **Step-up sessions ("sudo mode"):** one face scan opens a privileged window so users don't have to scan repeatedly
- **Auto-lock screen:** iPhone-style, user-configurable 1–15 minutes
- **Blockchain anchoring:** only hashes + Merkle roots are anchored, **never medical data**
- **Out-of-band recovery:** Web3 signing off-server when the DB is compromised

### Blockchain signer model

The blockchain layer now separates three roles:

| Role | Configuration | Responsibility |
|---|---|---|
| **Owner / root governance** | `BLOCKCHAIN_OWNER_PRIVATE_KEY` for local/dev; cold wallet or multisig for production | Authorize/revoke Admin wallets, add/remove relayers, transfer ownership |
| **Relayer / backend writer** | `BLOCKCHAIN_RELAYER_PRIVATE_KEY` | Sign routine backend transactions such as `AuditAnchor.commitRoot()` and `FaceRegistry.setFaceHash()` |

Admin wallets prove human authority. The backend relayer pays gas and writes routine audit/hash transactions. The owner governs who is allowed to act as admin or relayer.

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

### Run app services via Docker

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cd blockchain && cp .env.example .env
npm install
npm run node                              # terminal 1
npm run deploy:local                      # terminal 2, then copy output to each folder env

cd ..
docker compose up -d
# Backend:  http://localhost:3001/api
# Frontend: http://localhost:5173
# Postgres: localhost:5432
# Hardhat:  http://localhost:8545
```

Docker Compose no longer starts a blockchain container. It reads `backend/.env`
for backend runtime config and `frontend/.env` for frontend public config. It
does not load `blockchain/.env`.

### Or run each part separately

```bash
# Backend
cd backend && npm install && npm run start:dev

# Frontend
cd frontend && npm install && npm run dev

# Blockchain (local node + deploy)
cd blockchain && npm install
cp .env.example .env
npm run node                              # terminal 1
npm run deploy:local                      # terminal 2
```

---

## Documentation

Full table of contents in [`docs/README.en.md`](./docs/README.en.md).

### By topic

| Topic | Documents |
|---|---|
| **Architecture** | [Backend Clean Architecture](./docs/architecture/backend.md) · [File Structure](./docs/architecture/backend-file-structure.md) · [Frontend UI](./docs/architecture/frontend-ui-guidelines.md) |
| **Security** | [Tiers & Anchoring Policy](./docs/security/tiers-and-anchoring.md) · [Audit Logging](./docs/security/audit-logging.md) |
| **For AI/Agents** | [AGENTS.md](./AGENTS.md) |

> [!NOTE]

### FAQ

| Question | Answer |
|---|---|
| What are Tier A vs Tier B step-up? | [docs/security/tiers-and-anchoring.md](./docs/security/tiers-and-anchoring.md) |
| When does anchoring happen immediately vs in 5-min batches? | [docs/security/tiers-and-anchoring.md](./docs/security/tiers-and-anchoring.md) |
| How do the two HTML tools differ? | [tools/README.en.md](./tools/README.en.md) |

---

## Development conventions

- **Backend:** Feature-based modules (`modules/visit`, `modules/department`, etc.). Validation via `class-validator`. Multi-step workflows use `prisma.$transaction`.
- **Frontend:** Feature-based folders (`features/admin`, `features/receptionist`). Tailwind cyan-600 palette. Soft delete for business entities.
- **Blockchain:** Only hash + Merkle root + metadata are anchored. **Never** PII, medical files, or X-rays.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, ...).

More details in [AGENTS.md](./AGENTS.md).
