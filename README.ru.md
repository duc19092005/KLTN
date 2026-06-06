**🌐 Language:** [🇻🇳 Tiếng Việt](./README.md) · [🇬🇧 English](./README.en.md) · [🇷🇺 Русский](./README.ru.md)

# KLTN Hospital Management System

> Современная полнофункциональная медицинская платформа, ориентированная на «Тройную цель»: улучшение опыта пациента, точность клинических решений и непреложная целостность данных.

> [!TIP]
> **Для быстрого технического обзора** (архитектура, модель безопасности, backup/recovery на одной странице) читайте [`docs/SUMMARY.ru.md`](./docs/SUMMARY.ru.md).

## Обзор

Система управления больницей объединяет **биометрическую аутентификацию**, **ИИ-помощь при диагностике** и **блокчейн-аудит**, чтобы целостность каждой медицинской записи можно было доказать — даже если сервер был скомпрометирован.

### Ключевые сценарии

| Рабочий процесс | Описание |
|---|---|
| **Регистратура** | Приём пациентов, очередь, проверка удостоверения личности |
| **Врач** | Медицинская карта + ИИ-подсказки диагноза + заключение, заякоренное в блокчейне |
| **Лаборатория** | Обработка медицинских заказов, загрузка результатов в Cloudinary |
| **Администратор** | Управление отделениями, персоналом, ИИ-моделями, журналами аудита, резервными копиями |

### Особенности безопасности

- **Биометрическая аутентификация:** распознавание лица как для персонала, так и для пациентов
- **Step-up-сессии (режим «sudo»):** одно сканирование лица открывает привилегированное окно, без необходимости постоянно сканироваться
- **Авто-блокировка экрана:** в стиле iPhone, настраиваемая пользователем (1–15 минут)
- **Блокчейн-якорь:** на цепи хранятся только хеши и Merkle-корни, **никогда медицинские данные**
- **Восстановление вне сервера (out-of-band):** Web3-подпись с отдельного устройства, когда БД скомпрометирована

---

## Архитектура

Монорепозиторий с тремя независимыми компонентами:

```text
KLTN/
├── backend/      NestJS + Prisma + PostgreSQL
├── frontend/     React + Vite + Tailwind
├── blockchain/   Solidity + Hardhat
├── docs/         Технические документы по темам
└── tools/        HTML-инструменты для аварийных ситуаций (офлайн)
```

| Слой | Стек | Роль |
|---|---|---|
| **[Backend](./backend/README.ru.md)** | NestJS, TypeScript, Prisma, PostgreSQL | Бизнес-логика, интеграция ИИ (дочерний процесс Python), обработка биометрии |
| **[Frontend](./frontend/README.ru.md)** | React (Vite), Tailwind, React Router v6 | SPA для 4 ролей: Admin, Receptionist, Doctor, Lab Manager |
| **[Blockchain](./blockchain/README.ru.md)** | Solidity, Hardhat, Ethers.js v6 | Журналы аудита и проверка целостности (только хеши и Merkle, без PII) |
| **AI/ML** | Python 3.12, TensorFlow, InsightFace | Диагностические подсказки, 128-мерные эмбеддинги лица |

---

## Быстрый старт

### Требования

- Docker + Docker Compose
- Node.js 20+
- (Опционально) MetaMask для тестирования кошелька

### Полный запуск через Docker

```bash
docker compose up -d
# Backend:  http://localhost:3001/api
# Frontend: http://localhost:5173
# Postgres: localhost:5432
# Hardhat:  http://localhost:8545
```

### Или по отдельности

```bash
# Backend
cd backend && npm install && npm run start:dev

# Frontend
cd frontend && npm install && npm run dev

# Blockchain (локальный узел + деплой)
cd blockchain && npm install
npx hardhat node                          # терминал 1
npx hardhat run scripts/deploy.js --network localhost  # терминал 2
```

---

## Документация

Полное оглавление: [`docs/README.ru.md`](./docs/README.ru.md).

### По темам

| Тема | Документы |
|---|---|
| **Архитектура** | [Backend Clean Architecture](./docs/architecture/backend.md) · [File Structure](./docs/architecture/backend-file-structure.md) · [Frontend UI](./docs/architecture/frontend-ui-guidelines.md) |
| **Безопасность** | [Tiers & Anchoring Policy](./docs/security/tiers-and-anchoring.md) · [Audit Logging](./docs/security/audit-logging.md) |
| **Резервное копирование и DR** | [Overview](./docs/backup-recovery/overview.md) · [Backup CLI](./docs/backup-recovery/backup-restore-cli.md) · [Emergency Restore](./docs/backup-recovery/emergency-restore.md) |
| **Автономные инструменты** | [Break-Glass Viewer](./tools/break-glass-viewer/README.ru.md) · [Recovery Signer](./tools/recovery-signer/README.ru.md) |
| **Для ИИ-агентов** | [AGENTS.md](./AGENTS.md) |

> [!NOTE]
> Технические документы внутри `docs/architecture/`, `docs/security/` и `docs/backup-recovery/` оставлены только на вьетнамском. Многоязычное покрытие ограничено набором README выше.

### Часто задаваемые вопросы

| Вопрос | Ответ |
|---|---|
| Что такое Tier A и Tier B step-up? | [docs/security/tiers-and-anchoring.md](./docs/security/tiers-and-anchoring.md) |
| Когда якорение происходит сразу, а когда пакетом раз в 5 минут? | [docs/security/tiers-and-anchoring.md](./docs/security/tiers-and-anchoring.md) |
| Когда запускается автоматическая резервная копия? Как админ запускает её вручную? | [docs/backup-recovery/overview.md](./docs/backup-recovery/overview.md) |
| Чем отличаются два HTML-инструмента? | [tools/README.ru.md](./tools/README.ru.md) |
| База полностью удалена. Как восстановить? | [docs/backup-recovery/emergency-restore.md](./docs/backup-recovery/emergency-restore.md) |

---

## Соглашения разработки

- **Backend:** модули по фичам (`modules/visit`, `modules/department`, ...). Валидация через `class-validator`. Многошаговые сценарии используют `prisma.$transaction`.
- **Frontend:** папки по фичам (`features/admin`, `features/receptionist`). Палитра Tailwind cyan-600. Мягкое удаление для бизнес-сущностей.
- **Blockchain:** в цепь попадают только хеш + Merkle-корень + метаданные. **Никогда** PII, медицинские файлы, рентгены.
- **Коммиты:** Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, ...).

Подробнее в [AGENTS.md](./AGENTS.md).
