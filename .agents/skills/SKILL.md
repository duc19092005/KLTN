---
name: kltn-hospital-management
description: "Project skill configuration for KLTN Hospital Management System — a full-stack healthcare platform with NestJS backend, React frontend, Solidity blockchain audit trail, and Python AI diagnostics."
category: project
risk: safe
source: local
---

# KLTN Hospital Management System — Skill Router

This is the skill configuration for the **KLTN Hospital Management System** (Khóa Luận Tốt Nghiệp). Use this document to understand the project architecture and route tasks to the correct specialized skills.

> **Documentation layout (read in this order):**
> 1. [AGENTS.md](../../docs/agents/AGENTS.md) — canonical source for project overview, architecture decisions, coding conventions, and the **Core Domain Model** (from `schema.prisma`).
> 2. `hospital-management-system` skill — strict **business rules, domain invariants, blockchain/AI rules, anti-patterns, and the code review checklist**.
> 3. This router (`SKILL.md`) — maps task types to the right specialized skills.
>
> AGENTS.md describes *what the system is*; the skill describes *the rules you must enforce*. They are complementary — do not duplicate domain facts here.

## Locked Decisions (do not re-litigate)

These architectural choices are **final** for this project. Do NOT ask the user to reconsider them, and do NOT propose alternatives unless the user explicitly requests a change:

- **Database:** PostgreSQL (no SQLite / MySQL / Mongo).
- **ORM:** Prisma (no TypeORM / Drizzle / Kysely).
- **File storage:** AWS S3 private for medical files/results/PDFs/images; Cloudinary only for staff/doctor avatars and legacy reads.
- **Biometrics:** InsightFace + Euclidean-distance matching (no YOLO / SAM / other CV stacks).
- **Frontend:** React + Vite + Tailwind (cyan-600 "Hospital OS" design system).
- **Blockchain:** Solidity + Hardhat + Ethers.js v6 — used for audit / integrity checkpoints ONLY.
- **Audit backup:** IPFS stores encrypted audit recovery artifacts only; it is not the primary business database backup.
- **Audit journal:** PostgreSQL transaction + audit outbox is the source of truth; Kafka is a replay/journal layer after DB commit, not a replacement for DB transactions.

> Some generic community skills (e.g. `@database-design`) may suggest "ask which DB/ORM" or "consider SQLite". Ignore that guidance here — the stack above is locked. Use those skills only for their schema-modeling / indexing / optimization value.

## Skill Overrides & Known Issues

The localized community skills are kept close to upstream, so some contain generic guidance that conflicts with this project. These overrides take precedence over the skill bodies:

| Area | In the skill | Override for THIS project |
|------|--------------|---------------------------|
| Ghost skills | `nestjs-expert` & `docker-expert` say "switch and stop" → `typescript-type-expert`, `database-expert`, `nodejs-expert`, `react-expert`, `kubernetes-expert`, `github-actions-expert`, `devops-expert` | **None of these exist.** Do not hand off to them. Stay in the current skill or use a real one from the routing table. |
| ORM | `nestjs-expert` DB section / checklist / decision-tree is TypeORM/Mongoose | Use **Prisma** only (`prisma.$transaction`, Prisma Client). Ignore `getRepositoryToken` / repository-pattern advice. |
| Frontend | `react-best-practices` mixes Next.js/RSC (`next/dynamic`, `React.cache()`, `after()`, `server-*`) | Frontend is a **Vite SPA** — apply client-side rules only; skip all Next.js/RSC rules. |
| Docker runs | `docker-expert` "validation" runs `docker build/run/scout` directly | **Do not auto-run** these (resource cost / side effects). Static-analyze first; run Docker only with explicit user consent. |
| Dead links | 9 skills point to `resources/implementation-playbook.md` | **That file does not exist anywhere** — ignore the pointer. |
| Blockchain scope | `blockchain-developer` covers DeFi / NFT / DAO / tokenomics | KLTN blockchain is **audit / integrity ONLY** — no DeFi/NFT/DAO, and never PII/medical data on-chain. |
| File storage | Older docs say Cloudinary for all files | Current rule: **S3 private for medical files**, **Cloudinary for avatars only**. Do not add new medical-file writes to Cloudinary. |
| Audit/IPFS | Older docs imply only DB hashes or direct on-chain logs | Current rule: **BlockchainLogger encrypted snapshots + IPFS encrypted batch artifact + blockchain checkpoint**. Never put plaintext medical data on-chain or in IPFS. |
| DB choice | `database-design` says "ask which DB/ORM", "SQLite may suffice" | Stack is locked (see above) — don't ask, don't suggest alternatives. |

## Project Overview

A full-stack hospital management platform featuring:
- **Patient intake & queue management** (Receptionist workflow)
- **Clinical diagnostics with AI assistance** (Doctor workflow)
- **Biometric authentication** (Face recognition for staff)
- **Blockchain audit trail** (Merkle checkpoint, encrypted audit snapshots, IPFS recovery artifact)
- **Admin dashboard** (Department, staff, and system management)

## Tech Stack & Skill Mapping

### Backend — NestJS + Prisma + PostgreSQL
**Directory:** `apps/hospital-api/`
**Skills to use:**
- `@nestjs-expert` — Module architecture, DI patterns, guards, interceptors, pipes
- `@typescript-pro` — TypeScript type safety, generics, decorators
- `@postgresql` — Database queries, indexing, optimization
- `@database-design` — Prisma model relationships, migrations, schema design
- `@auth-implementation-patterns` — JWT, Passport, RBAC guards
- `@api-design-principles` — RESTful API design, DTOs, validation

**Key patterns in this project:**
- Prisma ORM with PostgreSQL (canonical schema: `apps/hospital-api/prisma/schema.prisma`)
- JWT + Passport authentication with role-based guards (`ADMIN`, `RECEPTIONIST`, `DOCTOR`, `LAB_MANAGER`)
- State machine for visit lifecycle: `WAITING → IN_PROGRESS → WAITING_TEST_RESULT → WAITING_CONCLUSION → COMPLETED` (+ `CANCELLED`)
- Modular architecture: each domain has its own module (patient, visit, department, staff, etc.)
- ConfigModule with `.env` for environment management
- Transactional audit outbox: business write and audit row must commit together; Kafka publishes/replays after DB commit.
- Audit recovery uses `BlockchainLogger.beforeEncrypted/afterEncrypted`, IPFS encrypted artifacts, and blockchain Merkle checkpoints.

---

### Frontend — React (Vite) + React Router
**Directory:** `apps/hospital-web/`
**Skills to use:**
- `@react-best-practices` — Component patterns, performance optimization
- `@react-patterns` — State management, hooks, component composition
- `@react-ui-patterns` — UI component design, layout patterns
- `@frontend-design` — Visual design, responsive layouts
- `@ui-ux-designer` — UX flows, accessibility, user experience

**Key patterns in this project:**
- Vite-based React SPA with React Router v6
- Role-based routing (Admin, Receptionist, Doctor dashboards)
- Axios for API calls with interceptors
- Tailwind CSS for styling with custom design system (cyan-600 palette)
- Feature-based folder structure (`features/admin/`, `features/receptionist/`, `features/doctor/`)

---

### Blockchain — Solidity + Hardhat + Ethers.js
**Directory:** `apps/audit-contracts/`
**Skills to use:**
- `@blockchain-developer` — Smart contract development, security, testing
- `@solidity-security` — Contract vulnerability assessment, access control

**Key patterns in this project:**
- Hardhat development environment
- AuditAnchor checkpoint contract stores append-only batch checkpoints: `merkleRoot`, `artifactHash`, `artifactUri`, `leafCount`, timestamp/committed status.
- On-chain data is verification metadata only. Do not store plaintext, encrypted snapshots, patient PII, diagnosis text, prescriptions, files, API keys, or AES/private keys on-chain.
- Backend computes `entryHash` for each audit row, builds a Merkle root for a batch, uploads an encrypted IPFS artifact, then commits the checkpoint.
- Ethers.js v6 for blockchain interaction from backend

---

### Audit / IPFS / Kafka Recovery
**Directory:** `apps/hospital-api/src/infrastructure/audit/`
**Skills to use:**
- `@hospital-management-system` — audit invariants and recovery rules
- `@security-audit` — tamper/recovery threat model
- `@blockchain-developer` — checkpoint contract behavior
- `@postgresql` — outbox, transactional consistency, PITR assumptions

**Current audit flow:**
- Business mutations write `BlockchainLogger` and `AuditOutbox` in the same PostgreSQL transaction.
- Kafka is a durable post-commit journal/replay layer. Do not write Kafka before a business transaction commits.
- Tier A audit logs anchor immediately; Tier B logs anchor by batch.
- Each audit row stores redacted display snapshots (`beforeJson`, `afterJson`, `fieldsChanged`) and encrypted recovery snapshots (`beforeEncrypted`, `afterEncrypted`).
- `beforeHash`/`afterHash` verify decrypted plaintext snapshots. `entryHash` links the audit row into the hash chain. Merkle root anchors a batch on-chain.
- IPFS stores an AES-256-GCM encrypted artifact containing the batch audit rows, including `beforeEncrypted` and `afterEncrypted`.
- `artifactHash` is SHA-256 of the encrypted IPFS artifact and is committed on-chain with `artifactUri`.

**Recovery rules:**
- Entity recovery restores one selected business entity from the latest trusted anchored `afterEncrypted` snapshot.
- If DB audit is tampered, recover the audit batch from IPFS first, verify artifact hash + hash chain + Merkle root, then run entity recovery.
- If IPFS artifact is missing/tampered and no valid pin exists, use PostgreSQL PITR/WAL or database backup. IPFS is not a full DB backup.
- Admin may view audit metadata/redacted fields without an extra face scan after login. Audit recovery still requires the configured recovery authorization/step-up flow.
- Normal entity restore/delete lifecycle operations do not require face step-up under the latest business rule; audit history recovery remains sensitive.

---

### AI/ML — Python + TensorFlow + InsightFace
**Directory:** `apps/hospital-api/src/` (Python scripts/services)
**Skills to use:**
- `@python-pro` — Python best practices, async patterns
- `@hospital-management-system` — Biometric domain rules (enrollment, on-chain face-hash anchoring, anti-replay, matching threshold)

**Key patterns in this project:**
- InsightFace for facial recognition (biometric authentication)
- TensorFlow for AI diagnostic assistance
- Euclidean distance threshold for face matching
- Python scripts integrated with NestJS via child processes
- Face step-up is reserved for sensitive security/recovery actions defined by current business rules; do not add face scans to every restore/delete unless the rule requires it.

---

### DevOps & Infrastructure
**File:** `infrastructure/compose/compose.yml`
**Skills to use:**
- `@docker-expert` — Container configuration, multi-service orchestration
- `@deployment-procedures` — Deployment workflows

**Key services:**
- PostgreSQL database container
- Redis for caching/sessions
- Kafka for audit replay/journal where configured
- AWS S3 private for medical files/results/PDFs/images
- Cloudinary for staff/doctor avatars and legacy-compatible avatar URLs
- IPFS is external/cloud or test-local depending on environment; do not require IPFS in production Docker Compose unless explicitly requested
- Backend + Frontend containers

---

## Workflow-Specific Skill Routing

| Task Type | Primary Skill | Secondary Skills |
|-----------|--------------|-----------------|
| Clinical/hospital domain logic | `@hospital-management-system` | `@nestjs-expert`, `@blockchain-developer` |
| Patient/visit/queue workflow | `@hospital-management-system` | `@nestjs-expert`, `@database-design` |
| Biometric auth / face recognition | `@hospital-management-system` | `@python-pro`, `@auth-implementation-patterns` |
| New API endpoint | `@nestjs-expert` | `@api-design-principles`, `@typescript-pro` |
| Database schema change | `@database-design` | `@postgresql`, `@nestjs-expert` |
| Frontend page/component | `@react-best-practices` | `@frontend-design`, `@ui-ux-designer` |
| Smart contract | `@blockchain-developer` | `@solidity-security` |
| Audit/Kafka/IPFS/recovery | `@hospital-management-system` | `@security-audit`, `@blockchain-developer`, `@postgresql` |
| Authentication/Security | `@auth-implementation-patterns` | `@nestjs-expert`, `@security-audit` |
| Bug fixing | `@debugger` | `@error-detective`, `@systematic-debugging` |
| Code review | `@code-reviewer` | `@code-review-excellence`, `@clean-code` |
| Testing | `@testing-qa` | `@nestjs-expert` (unit), `@e2e-testing` |
| Performance issue | `@performance-optimizer` | `@postgresql-optimization`, `@react-component-performance` |
| Documentation | `@documentation` | `@api-documentation` |

> **Skill resolution:** Every skill referenced above is localized under `.agents/skills/` (project scope), so this router is self-contained when the repo is cloned. If a skill is ever missing locally, it falls back to the global library (`~/.agents/skills/`). Note: `@computer-vision-expert` was intentionally removed — biometric work is covered by `@hospital-management-system` + `@python-pro` (the project uses InsightFace, not YOLO/SAM).

## Project Conventions

### Naming Conventions
- **Prisma models:** PascalCase (e.g., `Patient`, `Visit`, `Department`)
- **Backend services:** PascalCase + `Service` suffix (e.g., `VisitService`)
- **Frontend components:** PascalCase (e.g., `DepartmentsPage`, `PatientCard`)
- **Frontend features:** kebab-case directories under `features/`
- **API routes:** kebab-case, plural nouns (e.g., `/api/patients`, `/api/visits`)
- **Database tables:** mapped from Prisma models (use `@@map`/`@map` if a different table name is needed)
- **Audit algorithm docs:** `docs/architecture/audit-algorithm.md` documents the current hash/encryption formulas and recovery flow.

### Code Style
- Backend: ESLint + Prettier (NestJS defaults)
- Frontend: ESLint + Prettier (React/Vite defaults)
- Blockchain: Solidity style guide (Hardhat linter)
- Commit messages: Conventional Commits format

### File Organization
```
KLTN/
├── apps/
│   ├── hospital-api/       # NestJS API + Prisma
│   ├── hospital-web/       # React + Vite SPA
│   ├── hospital-mobile/    # Expo React Native app
│   └── audit-contracts/    # Solidity + Hardhat contracts
├── infrastructure/
│   ├── compose/            # Dev, production, and test stacks
│   ├── nginx/              # Reverse proxy configuration
│   └── scripts/            # Deploy, backup, restore, and test helpers
├── docs/                   # Central documentation
└── README.md               # Project entry point
```
## Mobile NFC Addendum

**Directory:** `apps/hospital-mobile/`

Use this routing for NFC mobile work:

| Task Type | Primary Skill | Secondary Skills |
|-----------|--------------|-----------------|
| Mobile NFC app/screen | `@hospital-management-system` | `@react-patterns`, `@ui-ux-designer` |

Key mobile patterns:

- One Expo React Native codebase with two app surfaces: `src/apps/receptionist-scanner/` and `src/apps/patient-portal/`.
- Shared NFC parsing and API client live under `src/shared/`.
- Blank cards use NDEF Text JSON with `type: "KLTN_CCCD"` and `version: 1`.
- Mobile env uses `EXPO_PUBLIC_BACKEND_URL`; never commit `apps/hospital-mobile/.env`.
- Real NFC scans require a native dev build/prebuild because `react-native-nfc-manager` is not an Expo Go-only flow.

## When to Use This Skill

- At the start of any task related to this project
- When deciding which specialized skill to invoke
- When needing to understand the project architecture and conventions
- When onboarding or resuming work after a break

## Limitations

- This skill is a router/reference — always defer to specialized skills for implementation details
- Project-specific patterns may evolve; verify against current codebase
- Do not use this skill for tasks unrelated to the KLTN Hospital Management System
