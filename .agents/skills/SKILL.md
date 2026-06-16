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
> 1. [AGENTS.md](file:///home/congthang/Desktop/KhoaLuanV2/KLTN/AGENTS.md) — canonical source for project overview, architecture decisions, coding conventions, and the **Core Domain Model** (from `schema.prisma`).
> 2. `hospital-management-system` skill — strict **business rules, domain invariants, blockchain/AI rules, anti-patterns, and the code review checklist**.
> 3. This router (`SKILL.md`) — maps task types to the right specialized skills.
>
> AGENTS.md describes *what the system is*; the skill describes *the rules you must enforce*. They are complementary — do not duplicate domain facts here.

## Locked Decisions (do not re-litigate)

These architectural choices are **final** for this project. Do NOT ask the user to reconsider them, and do NOT propose alternatives unless the user explicitly requests a change:

- **Database:** PostgreSQL (no SQLite / MySQL / Mongo).
- **ORM:** Prisma (no TypeORM / Drizzle / Kysely).
- **File storage:** Cloudinary (no MinIO / S3).
- **Biometrics:** InsightFace + Euclidean-distance matching (no YOLO / SAM / other CV stacks).
- **Frontend:** React + Vite + Tailwind (cyan-600 "Hospital OS" design system).
- **Blockchain:** Solidity + Hardhat + Ethers.js v6 — used for audit / integrity ONLY.

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
| DB choice | `database-design` says "ask which DB/ORM", "SQLite may suffice" | Stack is locked (see above) — don't ask, don't suggest alternatives. |

## Project Overview

A full-stack hospital management platform featuring:
- **Patient intake & queue management** (Receptionist workflow)
- **Clinical diagnostics with AI assistance** (Doctor workflow)
- **Biometric authentication** (Face recognition for staff)
- **Blockchain audit trail** (Immutable record integrity verification)
- **Admin dashboard** (Department, staff, and system management)

## Tech Stack & Skill Mapping

### Backend — NestJS + Prisma + PostgreSQL
**Directory:** `backend/`
**Skills to use:**
- `@nestjs-expert` — Module architecture, DI patterns, guards, interceptors, pipes
- `@typescript-pro` — TypeScript type safety, generics, decorators
- `@postgresql` — Database queries, indexing, optimization
- `@database-design` — Prisma model relationships, migrations, schema design
- `@auth-implementation-patterns` — JWT, Passport, RBAC guards
- `@api-design-principles` — RESTful API design, DTOs, validation

**Key patterns in this project:**
- Prisma ORM with PostgreSQL (canonical schema: `backend/prisma/schema.prisma`)
- JWT + Passport authentication with role-based guards (`ADMIN`, `RECEPTIONIST`, `DOCTOR`, `LAB_MANAGER`)
- State machine for visit lifecycle: `WAITING → IN_PROGRESS → WAITING_TEST_RESULT → WAITING_CONCLUSION → COMPLETED` (+ `CANCELLED`)
- Modular architecture: each domain has its own module (patient, visit, department, staff, etc.)
- ConfigModule with `.env` for environment management

---

### Frontend — React (Vite) + React Router
**Directory:** `frontend/`
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
**Directory:** `blockchain/`
**Skills to use:**
- `@blockchain-developer` — Smart contract development, security, testing
- `@solidity-security` — Contract vulnerability assessment, access control

**Key patterns in this project:**
- Hardhat development environment
- IdentityRegistry as base ownership contract
- AuditAnchor for anchoring record integrity hashes on-chain
- DepartmentRegistry and FaceRegistry for entity management
- Ethers.js v6 for blockchain interaction from backend

---

### AI/ML — Python + TensorFlow + InsightFace
**Directory:** `backend/src/` (Python scripts/services)
**Skills to use:**
- `@python-pro` — Python best practices, async patterns
- `@hospital-management-system` — Biometric domain rules (enrollment, on-chain face-hash anchoring, anti-replay, matching threshold)

**Key patterns in this project:**
- InsightFace for facial recognition (biometric authentication)
- TensorFlow for AI diagnostic assistance
- Euclidean distance threshold for face matching
- Python scripts integrated with NestJS via child processes

---

### DevOps & Infrastructure
**File:** `docker-compose.yml`
**Skills to use:**
- `@docker-expert` — Container configuration, multi-service orchestration
- `@deployment-procedures` — Deployment workflows

**Key services:**
- PostgreSQL database container
- Redis for caching/sessions
- Cloudinary for medical file & image storage (external SaaS, configured via `CLOUDINARY_*` env vars)
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

### Code Style
- Backend: ESLint + Prettier (NestJS defaults)
- Frontend: ESLint + Prettier (React/Vite defaults)
- Blockchain: Solidity style guide (Hardhat linter)
- Commit messages: Conventional Commits format

### File Organization
```
KLTN/
├── backend/           # NestJS API server
│   └── src/
│       ├── modules/   # Feature modules (patient, visit, staff, etc.)
│       ├── infrastructure/  # Cross-cutting concerns (audit, blockchain, etc.)
│       └── common/    # Shared utilities, decorators, guards
├── frontend/          # React SPA
│   └── src/
│       ├── features/  # Feature-based pages (admin, receptionist, doctor)
│       ├── components/ # Shared UI components
│       └── services/  # API service layer
├── blockchain/        # Solidity smart contracts
│   ├── contracts/     # Smart contract source files
│   ├── scripts/       # Deployment scripts
│   └── test/          # Contract tests
└── docker-compose.yml # Multi-service orchestration
```

## Mobile NFC Addendum

**Directory:** `mobile/`

Use this routing for NFC mobile work:

| Task Type | Primary Skill | Secondary Skills |
|-----------|--------------|-----------------|
| Mobile NFC app/screen | `@hospital-management-system` | `@react-patterns`, `@ui-ux-designer` |

Key mobile patterns:

- One Expo React Native codebase with two app surfaces: `src/apps/receptionist-scanner/` and `src/apps/patient-portal/`.
- Shared NFC parsing and API client live under `src/shared/`.
- Blank cards use NDEF Text JSON with `type: "KLTN_CCCD"` and `version: 1`.
- Mobile env uses `EXPO_PUBLIC_BACKEND_URL`; never commit `mobile/.env`.
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
