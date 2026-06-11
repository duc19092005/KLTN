**🌐 Language:** [🇻🇳 Tiếng Việt](./README.md) · [🇬🇧 English](./README.en.md) · [🇷🇺 Русский](./README.ru.md)

# Documentation Index

> [!TIP]
> Just want a fast overview? Read [**SUMMARY.en.md**](./SUMMARY.en.md) — a one-page technical summary covering architecture, security model, and backup/recovery in English.

Documentation for the KLTN Hospital Management System, organized by topic.

## 🏗️ [Architecture](./architecture/)

| Document | Scope | Content |
|---|---|---|
| [Backend Clean Architecture](./architecture/backend.md) | Backend | Clean architecture pattern, layered design |
| [Backend File Structure](./architecture/backend-file-structure.md) | Backend | Folder layout, module boundaries |
| [Frontend AI Rules](./architecture/frontend-ai-rules.md) | Frontend | Development rules for AI assistants |
| [Frontend UI Guidelines](./architecture/frontend-ui-guidelines.md) | Frontend | Design system, Tailwind tokens |

## 🔒 [Security](./security/)

| Document | Scope | Content |
|---|---|---|
| [Tiers & Anchoring Policy](./security/tiers-and-anchoring.md) | Backend + Frontend | Step-up Tier A/B, immediate vs batch-5min anchoring |
| [Audit Logging & Tamper-Evidence](./security/audit-logging.md) | Backend | Hash chain + Merkle anchoring mechanism |

## 💾 [Backup & Recovery](./backup-recovery/)

| Document | Scope | Content |
|---|---|---|
| [Backup & Recovery Overview](./backup-recovery/overview.md) | Backend + Frontend | Cron 02:00, manual backup, surgical restore, two HTML tools |
| [Backup & Restore CLI](./backup-recovery/backup-restore-cli.md) | Backend | `npm run db:backup` & restore workflow |
| [Emergency Restore (out-of-band)](./backup-recovery/emergency-restore.md) | Backend + Tools | Last-resort path: SSH + recovery-signer out-of-band |

> [!NOTE]
> The documents under `architecture/`, `security/`, and `backup-recovery/` are deep technical references kept in Vietnamese only. For an English overview, read [`SUMMARY.en.md`](./SUMMARY.en.md).

## 🛠️ Standalone tools

| Tool | Purpose |
|---|---|
| [tools/break-glass-viewer](../tools/break-glass-viewer/README.en.md) | Verify the backup ledger offline (read-only) |
| [tools/recovery-signer](../tools/recovery-signer/README.en.md) | Out-of-band Web3 signing to restore the DB (write) |

## 📦 Module-level READMEs

| Path | Role |
|---|---|
| [backend/README.en.md](../backend/README.en.md) | How to run the backend |
| [frontend/README.en.md](../frontend/README.en.md) | How to run the frontend |
| [blockchain/README.en.md](../blockchain/README.en.md) | Hardhat, contract deployment |

## 🤝 Agents Guidelines

| Document | Purpose |
|---|---|
| [AGENTS.md](../AGENTS.md) | Domain model & conventions for AI assistants |
| [frontend/AGENTS.md](../frontend/AGENTS.md) | AI rules specific to the frontend |
