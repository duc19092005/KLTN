# Backend Core API - Hospital Management System (NestJS)

The central backend API built on **NestJS 10**, **Prisma ORM**, and **PostgreSQL**, integrating a 5-layer V2 Tamper-Evident Audit Engine, biometric facial vector verification, Web3 cryptographic wallet challenges, and a Multi-AI Clinical Gateway.

---

## 📚 Detailed Documentation

Please explore the comprehensive sub-documentation links below:

- 🎮 **[Detailed Controllers & Endpoints Specification (16 Controllers)](../../docs/applications/hospital-api/en/controllers.md)**: Full listing of HTTP methods, routes, RBAC permissions, Face Step-Up rules, and business purposes.
- 🎯 **[Business Use Cases Specification (59 Use Cases)](../../docs/applications/hospital-api/en/use-cases.md)**: Execution workflows, atomic transactions, and emitted audit events.
- 🏗️ **[Infrastructure Architectural Guide](../../docs/applications/hospital-api/en/infrastructure.md)**: Deep dive into the Audit Engine, Blockchain Clients, Multi-AI Gateway, and AWS S3 Storage.

---

## 🏛️ Source Code Architecture (Clean Architecture)

```text
apps/hospital-api/
├── prisma/
│   ├── schema.prisma              # PostgreSQL schema (30+ clinical tables)
│   └── migrations/                # Database migrations
│
├── src/
│   ├── common/                    # Guards, Decorators, StepUp Service, Exception filters
│   │
│   ├── infrastructure/            # Technical Infrastructure Layer
│   │   ├── audit/                 # Tamper-evident Audit Engine (Anchoring, Recovery, Logging, Crypto, IPFS)
│   │   ├── blockchain/            # Web3 Signer, Governance, FaceRegistry, AuditAnchor Clients
│   │   ├── prisma/                # Database context & transaction manager
│   │   └── storage/               # AWS S3 Private Storage Adapter & Cloudinary Avatar Uploader
│   │
│   └── modules/                   # Domain Feature Modules
│       ├── ai-model/              # Medical LLM Model Registry & Analytics
│       ├── audit/                 # Audit Dashboard Controller, Queries, Presenters
│       ├── auth/                  # Password, Facial Biometrics, Web3 Wallet & Recovery
│       ├── clinical-decision/     # Multi-AI Consultation & ICD-10 Diagnosis Signing
│       ├── department/            # Department Administration & Leadership
│       ├── doctor/                # Physician Directory & Licensing
│       ├── medical-order/         # Laboratory Orders & S3 Medical Imaging
│       ├── notification/          # Real-time WebSocket / Notification System
│       ├── patient/               # Patient Medical Records & Triage
│       ├── patient-auth/          # Patient SMS OTP Authentication
│       ├── patient-portal/        # Patient Self-Service: Booking, QR Check-in, Medical History
│       ├── staff/                 # Hospital Personnel Management
│       └── visit/                 # Clinical Visit Lifecycle
│
└── test/                          # 56 Test Suites: Unit, Functional, Integration, Tamper-Recovery
```

---

## ⚙️ Setup & Execution

### 1. Install Dependencies
```bash
cd apps/hospital-api
npm install
```

### 2. Configure Environment Variables
```bash
cp .env.example .env
```

### 3. Synchronize Database
```bash
npx prisma generate
npx prisma db push
```

### 4. Start Application
```bash
# Development mode
npm run start:dev

# Production build
npm run build
npm run start:prod
```

---

## 🧪 Automated Testing

```bash
# Execute Unit Tests (56 Test Suites / 308 Tests)
npm run test:unit

# Execute Functional Clinical Scenarios
npm run test:functional

# Execute E2E Tamper & Self-Healing Integration Suite
npm run test:tamper:run
```