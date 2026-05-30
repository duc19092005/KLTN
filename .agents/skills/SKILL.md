---
name: kltn-hospital-management
description: "Project skill configuration for KLTN Hospital Management System — a full-stack healthcare platform with NestJS backend, React frontend, Solidity blockchain audit trail, and Python AI diagnostics."
category: project
risk: safe
source: local
---

# KLTN Hospital Management System — Skill Router

This is the skill configuration for the **KLTN Hospital Management System** (Khóa Luận Tốt Nghiệp). Use this document to understand the project architecture and route tasks to the correct specialized skills.

## Project Overview

A full-stack hospital management platform featuring:
- **Patient intake & queue management** (Receptionist workflow)
- **Clinical diagnostics with AI assistance** (Doctor workflow)
- **Biometric authentication** (Face recognition for staff)
- **Blockchain audit trail** (Immutable record integrity verification)
- **Admin dashboard** (Department, staff, and system management)

## Tech Stack & Skill Mapping

### Backend — NestJS + TypeORM + PostgreSQL
**Directory:** `backend/`
**Skills to use:**
- `@nestjs-expert` — Module architecture, DI patterns, guards, interceptors, pipes
- `@typescript-pro` — TypeScript type safety, generics, decorators
- `@postgresql` — Database queries, indexing, optimization
- `@database-design` — Entity relationships, migrations, schema design
- `@auth-implementation-patterns` — JWT, Passport, RBAC guards
- `@api-design-principles` — RESTful API design, DTOs, validation

**Key patterns in this project:**
- TypeORM entities with PostgreSQL
- JWT + Passport authentication with role-based guards (`ADMIN`, `RECEPTIONIST`, `DOCTOR`)
- State machine pattern for visit lifecycle (`WAITING` → `IN_PROGRESS` → `COMPLETED`)
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
- `@computer-vision-expert` — Face recognition, image processing

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
- MinIO for object storage (medical images)
- Backend + Frontend containers

---

## Workflow-Specific Skill Routing

| Task Type | Primary Skill | Secondary Skills |
|-----------|--------------|-----------------|
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

## Project Conventions

### Naming Conventions
- **Backend entities:** PascalCase (e.g., `Patient`, `Visit`, `Department`)
- **Backend services:** PascalCase + `Service` suffix (e.g., `VisitService`)
- **Frontend components:** PascalCase (e.g., `DepartmentsPage`, `PatientCard`)
- **Frontend features:** kebab-case directories under `features/`
- **API routes:** kebab-case, plural nouns (e.g., `/api/patients`, `/api/visits`)
- **Database tables:** snake_case (TypeORM auto-converts)

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

## When to Use This Skill

- At the start of any task related to this project
- When deciding which specialized skill to invoke
- When needing to understand the project architecture and conventions
- When onboarding or resuming work after a break

## Limitations

- This skill is a router/reference — always defer to specialized skills for implementation details
- Project-specific patterns may evolve; verify against current codebase
- Do not use this skill for tasks unrelated to the KLTN Hospital Management System
