**🌐 Language:** [🇻🇳 Tiếng Việt](./README.md) · [🇬🇧 English](./README.en.md) · [🇷🇺 Русский](./README.ru.md)

# Documentation Index

> [!TIP]
> Нужен быстрый обзор? Прочтите [**SUMMARY.ru.md**](./SUMMARY.ru.md) — одностраничное техническое резюме на русском, охватывающее архитектуру, модель безопасности и backup/recovery.

Документация KLTN Hospital Management System, организованная по темам.

## 🏗️ [Architecture](./architecture/) — Архитектура

| Документ | Область | Содержание |
|---|---|---|
| [Backend Clean Architecture](./architecture/backend.md) | Backend | Чистая архитектура, слои |
| [Backend File Structure](./architecture/backend-file-structure.md) | Backend | Раскладка папок, границы модулей |
| [Frontend AI Rules](./architecture/frontend-ai-rules.md) | Frontend | Правила разработки для ИИ-ассистента |
| [Frontend UI Guidelines](./architecture/frontend-ui-guidelines.md) | Frontend | Design system, токены Tailwind |

## 🔒 [Security](./security/) — Безопасность

| Документ | Область | Содержание |
|---|---|---|
| [Tiers & Anchoring Policy](./security/tiers-and-anchoring.md) | Backend + Frontend | Step-up Tier A/B, мгновенное vs пакетное (5 мин) якорение |
| [Audit Logging & Tamper-Evidence](./security/audit-logging.md) | Backend | Механизм hash chain + Merkle anchoring |

## 💾 [Backup & Recovery](./backup-recovery/) — Резервное копирование и восстановление

| Документ | Область | Содержание |
|---|---|---|
| [Backup & Recovery Overview](./backup-recovery/overview.md) | Backend + Frontend | Cron 02:00, ручной бэкап, выборочное восстановление, два HTML-инструмента |
| [Backup & Restore CLI](./backup-recovery/backup-restore-cli.md) | Backend | `npm run db:backup` и сценарий восстановления |
| [Emergency Restore (out-of-band)](./backup-recovery/emergency-restore.md) | Backend + Tools | Последний рубеж: SSH + recovery-signer вне сервера |

> [!NOTE]
> Документы внутри `architecture/`, `security/` и `backup-recovery/` — это углублённые технические справочники, оставленные только на вьетнамском. Для русскоязычного обзора см. [`SUMMARY.ru.md`](./SUMMARY.ru.md).

## 🛠️ Автономные инструменты

| Инструмент | Назначение |
|---|---|
| [tools/break-glass-viewer](../tools/break-glass-viewer/README.ru.md) | Офлайн-проверка журнала бэкапов (read-only) |
| [tools/recovery-signer](../tools/recovery-signer/README.ru.md) | Web3-подпись вне сервера для восстановления БД (write) |

## 📦 README модулей

| Путь | Роль |
|---|---|
| [backend/README.ru.md](../backend/README.ru.md) | Как запустить backend |
| [frontend/README.ru.md](../frontend/README.ru.md) | Как запустить frontend |
| [blockchain/README.ru.md](../blockchain/README.ru.md) | Hardhat, деплой контрактов |

## 🤝 Руководство для агентов

| Документ | Назначение |
|---|---|
| [AGENTS.md](../AGENTS.md) | Доменная модель и соглашения для ИИ-ассистентов |
| [frontend/AGENTS.md](../frontend/AGENTS.md) | Правила ИИ для frontend |
