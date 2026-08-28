# Smart Hospital Management System with Biometric Authentication & Tamper-Evident Blockchain Audit Trail

[![NestJS](https://img.shields.io/badge/Backend-NestJS%2010-E0234E?logo=nestjs&logoColor=white)](apps/hospital-api)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?logo=react&logoColor=black)](apps/hospital-web)
[![React Native](https://img.shields.io/badge/Mobile-Expo%20React%20Native-000020?logo=expo&logoColor=white)](apps/hospital-mobile)
[![Solidity](https://img.shields.io/badge/Blockchain-Solidity%20%2B%20Hardhat-363636?logo=solidity&logoColor=white)](apps/audit-contracts)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%2B%20Prisma-4169E1?logo=postgresql&logoColor=white)](apps/hospital-api)
[![Tests](https://img.shields.io/badge/Unit%20Tests-308%20Passed%20(100%25)-brightgreen)](apps/hospital-api)

> 🌐 **Language:** **[Tiếng Việt](README.md)** | **[English](README.en.md)**

---

## 🎯 1. Project Objectives & Thesis Context

In modern digital healthcare, ensuring the uncompromised integrity of clinical records and treatment histories is a critical necessity:
- **Real-world Challenges:** Electronic Health Records (EHR) risk being maliciously altered, deleted, or forged by compromised personnel, external attackers, or rouge database administrators for fraudulent insurance claims or medical malpractice concealment.
- **Privacy & Storage Constraints:** Medical records (PII, radiology imaging, laboratory results) **must never be stored directly on public blockchains** due to strict privacy regulations and prohibitive on-chain storage costs.

### 💡 The Proposed Breakthrough Solution
This thesis delivers a full-stack **Hospital Information System (HIS)** leveraging a **4-Tier Tamper-Evident Audit Architecture** combining **Blockchain**, **IPFS**, and **Modern Cryptography**:
1. **Real-time 5-Layer Off-Chain Hash-Chain (V2):** Every clinical mutation generates a 5-layer cryptographic hash (`beforeHash`, `afterHash`, `diffHash`, `dataHash`, `entryHash`) and encrypts sensitive snapshots with **AES-256-GCM authenticated encryption tied to AAD** (Authenticated Additional Data).
2. **On-Chain Merkle Tree Checkpointing:** Audit logs are periodically aggregated into batches, published as encrypted JSON bundles to **IPFS**, and anchored via their **32-byte Merkle Root** to the `AuditAnchor.sol` smart contract (Zero PII on-chain).
3. **Intelligent Self-Healing & Entity Recovery:** Features an automated 20-minute background Watchdog and Deep-Scan diagnostic tools that detect unauthorized local database modifications and automatically restore authentic records from verified IPFS artifacts.
4. **Multi-Factor Biometric & Web3 Security:** Supports 128-d biometric facial recognition (Cosine similarity $\le 0.45$), EIP-191 Web3 cryptographic wallet challenges for administrators, and mandatory **Face Step-Up MFA** for high-risk operations.
5. **Multi-AI Clinical Consultation Gateway:** Integrates Anthropic Claude 3.5 Sonnet, OpenAI GPT-4o, and Google Gemini 1.5 Pro with transparent ethical evaluation and clinical auditability.

---

## 🏛️ 2. Monorepo Architecture

```text
KLTN/
├── apps/
│   ├── hospital-api/              # Backend Core (NestJS 10, Prisma, PostgreSQL, Multi-AI Gateway)
│   ├── hospital-web/              # Web Clinical & Admin Portal (React, Vite, Tailwind CSS)
│   ├── hospital-mobile/           # Mobile Patient App (Expo React Native, QR Check-in)
│   └── audit-contracts/           # Smart Contracts (Solidity v0.8.20, Hardhat, Identity & Audit)
│
├── infrastructure/
│   ├── compose/                   # Docker Compose configurations (Dev, Prod, Test)
│   ├── nginx/                     # Nginx Reverse Proxy & SSL Gateway
│   └── scripts/                   # Shell scripts: Setup, Backup, Hardhat Deploy, Seed demo
│
├── docs/                          # Comprehensive technical and domain documentation
│   └── applications/
│       └── hospital-api/
│           ├── vi/                # Detailed Vietnamese documentation
│           └── en/                # Detailed English documentation (Controllers, UseCases, Infrastructure)
│
└── README.md                      # Primary repository documentation
```

---

## 🔄 3. End-to-End Audit Trail V2 Lifecycle

The complete audit trail lifecycle from real-time clinical mutation to on-chain checkpointing and self-healing is illustrated in 5 stages:

```mermaid
sequenceDiagram
    autonumber
    actor User as Doctor / Staff
    participant API as Hospital API (NestJS)
    participant DB as PostgreSQL (BlockchainLogger)
    participant IPFS as IPFS Network (Pinata / Node)
    participant SC as Smart Contract (AuditAnchor)
    actor Auditor as Auditor / Admin

    Note over User,DB: Stage 1: Real-time Transaction Logging (Advisory Lock & V2 Hashing)
    User->>API: Execute clinical action (Sign ICD-10 Conclusion / Lab Order)
    API->>API: Compute diffJson V1 & Encrypt snapshot with AES-256-GCM + AAD
    API->>API: Compute 5-layer V2 hashes (before, after, diff, data, entryHash)
    API->>DB: Append sequential log to BlockchainLogger with monotonic seq

    Note over API,SC: Stage 2 & 3: Merkle Tree Batching, IPFS Export & On-Chain Anchor
    API->>API: Construct Merkle Tree from PENDING logs
    API->>API: Extract 32-byte Merkle Root
    API->>IPFS: Encrypt & publish JSON bundle -> Receive IPFS CID & ArtifactHash
    API->>SC: Backend Relayer calls commitCheckpoint(batchId, merkleRoot, CID)
    SC-->>API: Emit on-chain AuditCheckpointCommitted event
    API->>DB: Update Batch & Logs status to ANCHORED

    Note over Auditor,DB: Stage 4 & 5: Monitoring, Self-Healing & Mathematical Proofs
    Auditor->>API: Trigger integrity verification (Deep Scan / 20-minute Watchdog)
    API->>DB: Traverse hash-chain and reconcile against Blockchain
    alt Unauthorized database tampering detected
        API->>SC: Retrieve authentic Merkle Root & IPFS CID
        API->>IPFS: Fetch verified artifact bundle
        API->>DB: Execute atomic transaction overwriting tampered data (Entity Recovered)
    end
    Auditor->>API: Request Merkle Proof for log entry
    API-->>Auditor: Return Sibling Hashes (Independent validation against on-chain root)
```

---

## 🔐 4. Web3 Access Control & Key Management

| Role | Storage Location | Responsibilities |
|---|---|---|
| **Owner / Root Governance** | `BLOCKCHAIN_OWNER_PRIVATE_KEY` (Cold Storage / Multisig in Production) | Add/revoke Admin and Relayer addresses; upgrade contracts. |
| **Relayer / Backend Writer** | `BLOCKCHAIN_RELAYER_PRIVATE_KEY` in Backend Secret Manager | Automatically signs operational transactions: anchors Merkle checkpoints, registers biometric hashes. |
| **Admin Wallet** | Personal Administrator Wallet (MetaMask / EIP-191) | Signs cryptographic authentication challenges for sensitive administrative operations. |

---

## 🚀 5. Quick Start Guide

### Step 1: Start Blockchain Node & Deploy Smart Contracts
```bash
cd apps/audit-contracts
npm install
npm run node
# In a new terminal:
npm run deploy:local
```

### Step 2: Configure & Start Backend API
```bash
cd apps/hospital-api
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run start:dev
```

### Step 3: Start Web Portal
```bash
cd apps/hospital-web
npm install
cp .env.example .env
npm run dev
```

### Step 4: Start Mobile Patient Portal
```bash
cd apps/hospital-mobile
npm install
cp .env.example .env
npx expo start
```

---

## 📖 6. Documentation Directory Links

- 🎮 **[Detailed Backend Controllers & Endpoints](docs/applications/hospital-api/en/controllers.md)**
- 🎯 **[Detailed Backend Business Use Cases](docs/applications/hospital-api/en/use-cases.md)**
- 🏗️ **[Detailed Backend Technical Infrastructure](docs/applications/hospital-api/en/infrastructure.md)**
- ⛓️ **[Smart Contracts Specification](apps/audit-contracts/README.en.md)**
- 💻 **[Frontend Web Portal Specification](apps/hospital-web/README.en.md)**
- 📱 **[Mobile Patient Portal Specification](apps/hospital-mobile/README.en.md)**