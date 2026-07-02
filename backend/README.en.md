**🌐 Language:** [🇻🇳 Tiếng Việt](./README.md) · [🇬🇧 English](./README.en.md) · [🇷🇺 Русский](./README.ru.md)

# KLTN Hospital Management System - Backend

A NestJS-based enterprise healthcare backend providing APIs for patient management, biometric authentication, PostgreSQL data access, and blockchain audit anchoring.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
# Copy .env.example to .env and fill in the required values
# (Database URL, Blockchain RPC, Cloudinary, etc.)
cp .env.example .env

# 3. Generate the Prisma client
npm run prisma:generate

# 4. Apply database migrations
npx prisma migrate deploy
# or use `npx prisma db push` for local development

# 5. Start the dev server
npm run start:dev
```

## Documentation
- **Audit logging:** for the blockchain audit trail and Merkle anchoring details, see [AUDIT_LOGGING.md](./AUDIT_LOGGING.md).
