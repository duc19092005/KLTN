**🌐 Language:** [🇻🇳 Tiếng Việt](./README.md) · [🇬🇧 English](./README.en.md) · [🇷🇺 Русский](./README.ru.md)

# Documentation Index

Mục lục tài liệu KLTN Hospital Management System, sắp xếp theo chủ đề.

## 🏗️ [Architecture](./architecture/) — Kiến trúc

| Tài liệu | Phạm vi | Nội dung |
|---|---|---|
| [Backend Clean Architecture](./architecture/backend.md) | Backend | Clean architecture pattern, layered design |
| [Backend File Structure](./architecture/backend-file-structure.md) | Backend | Folder layout, module boundaries |
| [Frontend AI Rules](./architecture/frontend-ai-rules.md) | Frontend | Quy tắc dev cho AI assistant |
| [Frontend UI Guidelines](./architecture/frontend-ui-guidelines.md) | Frontend | Design system, Tailwind tokens |

## 🔒 [Security](./security/) — Bảo mật

| Tài liệu | Phạm vi | Nội dung |
|---|---|---|
| [Tiers & Anchoring Policy](./security/tiers-and-anchoring.md) | Backend + Frontend | Step-up Tier A/B, anchor immediate vs batch 5' |
| [Audit Logging & Tamper-Evidence](./security/audit-logging.md) | Backend | Cơ chế hash chain + Merkle anchoring |

## 💾 [Backup & Recovery](./backup-recovery/) — Sao lưu & khôi phục

| Tài liệu | Phạm vi | Nội dung |
|---|---|---|
| [Backup & Recovery Overview](./backup-recovery/overview.md) | Backend + Frontend | Cron 02:00, manual backup, surgical restore, 2 công cụ HTML |
| [Backup & Restore CLI](./backup-recovery/backup-restore-cli.md) | Backend | `npm run db:backup` & restore workflow chuẩn |
| [Emergency Restore (out-of-band)](./backup-recovery/emergency-restore.md) | Backend + Tools | Phương án cuối: SSH + recovery-signer ngoại băng |

## 🛠️ Standalone Tools

| Công cụ | Mục đích |
|---|---|
| [tools/break-glass-viewer](../tools/break-glass-viewer/README.md) | Xác minh sổ backup offline (read-only) |
| [tools/recovery-signer](../tools/recovery-signer/README.md) | Ký Web3 ngoại băng để restore DB (write) |

## 📦 Module-level READMEs

| Đường dẫn | Vai trò |
|---|---|
| [backend/README.md](../backend/README.md) | Hướng dẫn chạy backend |
| [frontend/README.md](../frontend/README.md) | Hướng dẫn chạy frontend |
| [blockchain/README.md](../blockchain/README.md) | Hardhat, deploy contract |
| [mobile/README.md](../mobile/README.md) | Patient mobile OTP setup, APK build, portal usage |

## 🤝 Agents Guidelines

| Tài liệu | Mục đích |
|---|---|
| [AGENTS.md](../AGENTS.md) | Hướng dẫn cho AI assistant về domain model & conventions |
| [frontend/AGENTS.md](../frontend/AGENTS.md) | AI rules dành riêng cho frontend |
