**🌐 Language:** [🇻🇳 Tiếng Việt](./README.md) · [🇬🇧 English](./README.en.md) · [🇷🇺 Русский](./README.ru.md)

# KLTN Hospital Management System - Backend

A NestJS-based enterprise healthcare platform backend providing APIs for patient management, biometric authentication, PostgreSQL database interactions, and blockchain audit anchoring.

## Setup Instructions

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
# Copy .env.example to .env and fill in the required values (Database URL, Blockchain RPC, Cloudinary, etc.)
cp .env.example .env

# 3. Generate Prisma client
npm run prisma:generate

# 4. Apply database migrations
npx prisma migrate deploy
# or use `npx prisma db push` for local development

# 5. Start development server
npm run start:dev
```

## Documentation
- **Audit Logging:** For detailed information on the blockchain audit and Merkle tree anchoring implementation, see [AUDIT_LOGGING.md](./AUDIT_LOGGING.md).
- **Database Restore:** For instructions on verified data restoration after tampering, see [BACKUP_RESTORE.md](./BACKUP_RESTORE.md).
