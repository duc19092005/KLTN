**🌐 Language:** [🇬🇧 English](./SUMMARY.en.md) · [🇷🇺 Русский](./SUMMARY.ru.md)

# Техническое резюме

> Одностраничный технический обзор системы KLTN Hospital Management для рецензентов, которым нужно быстро понять проект перед погружением в полные технические документы на вьетнамском в [`docs/architecture/`](./architecture/), [`docs/security/`](./security/), [`docs/backup-recovery/`](./backup-recovery/).

## Что это за проект

Современная полнофункциональная платформа управления больницей, ориентированная на «Тройную цель»: улучшение опыта пациента, точность клинических решений и непреложная целостность данных. Кодовая база — монорепозиторий (backend на NestJS, frontend на React/Vite, blockchain на Solidity/Hardhat, AI-сервисы на Python).

## Архитектура

```text
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│  React + Vite   │ ─► │  NestJS + Prisma │ ─► │ PostgreSQL          │
│  SPA для 4 ролей│    │  (модульный)     │    │ (источник правды)   │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
                              │   │   │
                              │   │   └──► Cloudinary (медицинские файлы)
                              │   └──────► Python child-process (AI/InsightFace)
                              └──────────► Hardhat / Ethers v6
                                            │
                                  ┌─────────▼──────────┐
                                  │ Только хеши аудита │
                                  │ (хеши + Merkle)    │
                                  └────────────────────┘
```

- **Backend** — clean architecture, разбитая по фичам (`modules/visit`, `modules/department`, `modules/backup` и т.д.). Все многошаговые сценарии используют `prisma.$transaction` для атомарности. Контроллеры тонкие, бизнес-логика — в сервисах.
- **Frontend** повторяет ту же топологию по фичам (`features/admin`, `features/doctor`, ...). Своя «Hospital OS» дизайн-система на Tailwind. 4 роли: Admin, Receptionist, Doctor, Lab Manager.
- **Blockchain** хранит **только** хеши целостности и Merkle-корни — никогда PII или медицинские файлы. Шесть контрактов (`IdentityRegistry`, `DepartmentRegistry`, `FaceRegistry`, `AuditAnchor`, `StaffRegistry`, `AiModelRegistry`).
- **AI** работает как Python child-process, вызываемый backend (TensorFlow + InsightFace для face-эмбеддингов, плюс pluggable диагностический провайдер).

## Модель безопасности

Три усиливающих друг друга слоя:

1. **Биометрическая аутентификация.** Распознавание лица для персонала и пациентов. 128-мерные дескрипторы лица шифруются при хранении. Перед регистрацией обязателен шаг проверки живости (повороты головы по нескольким направлениям + моргание, с anchor-дескриптором для обнаружения подмены).

2. **Step-up-сессии (режим «sudo»).** Чувствительные операции записи (например, подписание клинического заключения) требуют step-up-токена. Одно сканирование лица открывает привилегированное окно — TTL ~3 мин, idle ~10 мин, hard cap ~30 мин — чтобы пользователю не приходилось сканироваться при каждом действии. iPhone-style auto-lock для общих рабочих станций.

3. **Журнал аудита с защитой от подделки.** Каждая запись бизнес-сущности добавляется в append-only таблицу `BlockchainLogger`, строки которой образуют хеш-цепочку (каждый `entryHash` включает предыдущий, с солью `AUDIT_PEPPER`). Каждые ~5 минут Merkle-корень новых листьев якорится on-chain через `AuditAnchor`, с `txHash` в самой записи для проверки. Две политики:
   - **Tier A — мгновенный якорь** (например, привязка blockchain-кошелька, изменения identity).
   - **Tier B — пакет раз в 5 мин** (клинические записи; экономия gas).
   Подробнее: [`docs/security/audit-logging.md`](./security/audit-logging.md) (формула хеша) и [`docs/security/tiers-and-anchoring.md`](./security/tiers-and-anchoring.md) (матрица политик).

> On-chain слой обнаружит подделку даже если злоумышленный DBA отредактирует Postgres напрямую: пересчитанный Merkle-корень не совпадёт с on-chain.

## Резервное копирование и восстановление

- **Автоматический ночной бэкап** (по умолчанию в 02:00) через `pg_dump`, плюс ручные бэкапы по запросу администратора. Каждый дамп записывается как JSONL-строка в `backup-ledger.jsonl` (offsite-том) с SHA-256; сама строка журнала также входит в хеш-цепочку и якорится on-chain.
- **Surgical Restore (точечное восстановление).** Когда повреждено только несколько записей и UI Admin работает, восстановление происходит запись за записью из последнего нетронутого бэкапа — минимальная зона поражения. См. [`docs/backup-recovery/overview.md`](./backup-recovery/overview.md).
- **Emergency Restore (вне сервера).** Когда БД удалена/невосстановима, а биометрии нельзя доверять, восстановление защищено Web3-подписью администратора, проверяемой против on-chain `IdentityRegistry`. Challenge подписывается через MetaMask на *личной* машине администратора с помощью автономного `tools/recovery-signer/index.html` — приватный ключ никогда не попадает на падающий сервер. См. [`docs/backup-recovery/emergency-restore.md`](./backup-recovery/emergency-restore.md).
- **Break-glass viewer.** Независимый однофайловый HTML-инструмент (`tools/break-glass-viewer/index.html`, чистый JS, полностью офлайн), который перепроверяет хеш-цепочку JSONL-журнала и (опционально, с pepper) каждый `entryHash`. Размещается на том же offsite-томе, что и журнал, чтобы аудитор мог проверить целостность не доверяя серверу.

## Чем эта архитектура примечательна

- **Доверие вне сервера.** Восстановление не зависит от подозреваемого сервера, БД и какого-либо `.env` внутри сервера. Корень доверия — Web3-кошелёк на личном устройстве администратора + on-chain registry, оба независимы от падающей инфраструктуры.
- **Трёхпозиционные индикаторы целостности.** `VERIFIED` / `TAMPERED` / `UNANCHORED` показываются честно в UI, а не сводятся к бинарному «healthy», чтобы оператор отличал «проверено on-chain» от «ещё не проверено».
- **Step-up-сессии вместо постоянных переподтверждений.** Прагматичный UX, отражающий реальную работу клиницистов — одно сканирование открывает привилегированное окно, lock-on-idle закрывает его.
- **Hash-only on-chain.** Блокчейн используется строго как audit anchor. PII, медицинские файлы и рентгены никогда не покидают PostgreSQL/Cloudinary. Это и privacy-инвариант, и оптимизация затрат.

## Где читать дальше

| Тема | Файл |
|---|---|
| Доменная модель и соглашения для ИИ-агентов | [`AGENTS.md`](../AGENTS.md) |
| Backend clean architecture | [`docs/architecture/backend.md`](./architecture/backend.md) |
| Структура файлов backend | [`docs/architecture/backend-file-structure.md`](./architecture/backend-file-structure.md) |
| Дизайн-система frontend | [`docs/architecture/frontend-ui-guidelines.md`](./architecture/frontend-ui-guidelines.md) |
| Step-up tiers & политика якорения | [`docs/security/tiers-and-anchoring.md`](./security/tiers-and-anchoring.md) |
| Аудит-логи и tamper-evidence | [`docs/security/audit-logging.md`](./security/audit-logging.md) |
| Обзор backup & recovery | [`docs/backup-recovery/overview.md`](./backup-recovery/overview.md) |
| Emergency restore (out-of-band) | [`docs/backup-recovery/emergency-restore.md`](./backup-recovery/emergency-restore.md) |

> [!NOTE]
> Полные технические документы выше поддерживаются только на вьетнамском. Это резюме — канонический англо/русскоязычный entry point.
