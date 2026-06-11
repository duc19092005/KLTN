**🌐 Language:** [🇻🇳 Tiếng Việt](./README.md) · [🇬🇧 English](./README.en.md) · [🇷🇺 Русский](./README.ru.md)

# KLTN Hospital Management System - Backend

Backend на NestJS для медицинской платформы: API для управления пациентами, биометрической аутентификации, работы с PostgreSQL и якорения аудита в блокчейне.

## Установка

```bash
# 1. Установить зависимости
npm install

# 2. Настроить переменные окружения
# Скопировать .env.example в .env и заполнить значения
# (Database URL, Blockchain RPC, Cloudinary и т.д.)
cp .env.example .env

# 3. Сгенерировать клиент Prisma
npm run prisma:generate

# 4. Применить миграции БД
npx prisma migrate deploy
# или `npx prisma db push` для локальной разработки

# 5. Запустить dev-сервер
npm run start:dev
```

## Документация
- **Аудит-логи:** подробности о цепочке аудита и якорении Merkle — [AUDIT_LOGGING.md](./AUDIT_LOGGING.md).
- **Восстановление БД:** проверяемое восстановление данных после вмешательства — [BACKUP_RESTORE.md](./BACKUP_RESTORE.md).
