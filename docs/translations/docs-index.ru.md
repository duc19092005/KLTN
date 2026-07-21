**🌐 Language:** [🇻🇳 Tiếng Việt](../README.md) · [🇬🇧 English](docs-index.en.md) · [🇷🇺 Русский](docs-index.ru.md)

# Documentation Index

> [!TIP]

Документация KLTN Hospital Management System, организованная по темам.

## 🏗️ [Architecture](../architecture/) — Архитектура

| Документ | Область | Содержание |
|---|---|---|
| [Backend Clean Architecture](../architecture/backend.md) | Backend | Чистая архитектура, слои |
| [Backend File Structure](../architecture/backend-file-structure.md) | Backend | Раскладка папок, границы модулей |
| [Frontend AI Rules](../architecture/frontend-ai-rules.md) | Frontend | Правила разработки для ИИ-ассистента |
| [Frontend UI Guidelines](../architecture/frontend-ui-guidelines.md) | Frontend | Design system, токены Tailwind |

## 🔒 [Security](../security/) — Безопасность

| Документ | Область | Содержание |
|---|---|---|
| [Tiers & Anchoring Policy](../security/tiers-and-anchoring.md) | Backend + Frontend | Step-up Tier A/B, мгновенное vs пакетное (5 мин) якорение |
| [Audit Logging & Tamper-Evidence](../security/audit-logging.md) | Backend | Механизм hash chain + Merkle anchoring |


| Документ | Область | Содержание |
|---|---|---|

> [!NOTE]

## 🛠️ Автономные инструменты

| Инструмент | Назначение |
|---|---|

## 📦 README модулей

| Путь | Роль |
|---|---|
| [apps/hospital-api/README.ru.md](../applications/hospital-api/README.ru.md) | Как запустить backend |
| [apps/hospital-web/README.ru.md](../applications/hospital-web/README.ru.md) | Как запустить frontend |
| [apps/audit-contracts/README.ru.md](../applications/audit-contracts/README.ru.md) | Hardhat, деплой контрактов |

## 🤝 Руководство для агентов

| Документ | Назначение |
|---|---|
| [AGENTS.md](../agents/AGENTS.md) | Доменная модель и соглашения для ИИ-ассистентов |
| [apps/hospital-web/AGENTS.md](../agents/hospital-web.md) | Правила ИИ для frontend |
