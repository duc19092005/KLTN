**🌐 Language:** [🇻🇳 Tiếng Việt](../README.md) · [🇬🇧 English](docs-index.en.md) · [🇷🇺 Русский](docs-index.ru.md)

# Documentation Index

> [!TIP]

Documentation for the KLTN Hospital Management System, organized by topic.

## 🏗️ [Architecture](../architecture/)

| Document | Scope | Content |
|---|---|---|
| [Backend Clean Architecture](../architecture/backend.md) | Backend | Clean architecture pattern, layered design |
| [Backend File Structure](../architecture/backend-file-structure.md) | Backend | Folder layout, module boundaries |
| [Frontend AI Rules](../architecture/frontend-ai-rules.md) | Frontend | Development rules for AI assistants |
| [Frontend UI Guidelines](../architecture/frontend-ui-guidelines.md) | Frontend | Design system, Tailwind tokens |

## 🔒 [Security](../security/)

| Document | Scope | Content |
|---|---|---|
| [Tiers & Anchoring Policy](../security/tiers-and-anchoring.md) | Backend + Frontend | Step-up Tier A/B, immediate vs batch-5min anchoring |
| [Audit Logging & Tamper-Evidence](../security/audit-logging.md) | Backend | Hash chain + Merkle anchoring mechanism |


| Document | Scope | Content |
|---|---|---|

> [!NOTE]

## 🛠️ Standalone tools

| Tool | Purpose |
|---|---|

## 📦 Module-level READMEs

| Path | Role |
|---|---|
| [apps/hospital-api/README.en.md](../applications/hospital-api/README.en.md) | How to run the backend |
| [apps/hospital-web/README.en.md](../applications/hospital-web/README.en.md) | How to run the frontend |
| [apps/audit-contracts/README.en.md](../applications/audit-contracts/README.en.md) | Hardhat, contract deployment |

## 🤝 Agents Guidelines

| Document | Purpose |
|---|---|
| [AGENTS.md](../agents/AGENTS.md) | Domain model & conventions for AI assistants |
| [apps/hospital-web/AGENTS.md](../agents/hospital-web.md) | AI rules specific to the frontend |
