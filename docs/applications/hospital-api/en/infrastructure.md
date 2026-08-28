# Detailed Infrastructure Documentation - Backend Hospital API

This document details the architectural design and components of the technical infrastructure layer (`src/infrastructure/`) in `apps/hospital-api`, covering the Tamper-Evident Audit Engine, Web3 Blockchain Clients, Multi-AI Gateway, Cloud Storage, and SMS Gateway.

---

## Table of Contents
1. [Tamper-Evident Audit Engine](#1-tamper-evident-audit-engine)
2. [Blockchain & Smart Contract Infrastructure](#2-blockchain--smart-contract-infrastructure)
3. [Multi-AI Clinical Gateway](#3-multi-ai-clinical-gateway)
4. [Cloud Storage Infrastructure](#4-cloud-storage-infrastructure)
5. [SMS & OTP Gateway](#5-sms--otp-gateway)

---

## 1. Tamper-Evident Audit Engine
Located at `src/infrastructure/audit/`, the audit engine is responsible for real-time cryptographic hash-chaining, Merkle tree construction, decentralized IPFS publication, on-chain checkpoint anchoring, and database self-healing.

```text
src/infrastructure/audit/
├── anchoring/           # Batch aggregation, Merkle tree computation, IPFS upload & on-chain anchor
│   ├── audit-anchor.service.ts              # Primary anchoring facade
│   ├── audit-batch-preparer.ts              # Gathers PENDING logs & computes Merkle tree
│   ├── audit-batch-artifact-publisher.ts    # Encrypts JSON bundle & uploads to IPFS
│   ├── audit-chain-verifier.ts              # Off-chain hash-chain integrity verification
│   ├── audit-pending-batch-resumer.ts       # Recovers interrupted/pending batches
│   ├── audit-proof.service.ts               # Merkle Inclusion Proof generator
│   └── audit-telegram-alert.service.ts      # Automated Telegram security incident bot
│
├── recovery/            # Integrity scanning, discrepancy detection & self-healing
│   ├── audit-recovery.service.ts            # Recovery orchestrator facade
│   ├── audit-watchdog.scheduler.ts          # 20-minute background auto-heal scheduler
│   ├── audit-deep-scan.service.ts           # Multi-pass full database vs blockchain scanner
│   ├── audit-batch-scanner.ts               # Detects missing or deleted local database batches
│   ├── audit-batch-restorer.ts              # Executes atomic batch restoration from IPFS
│   ├── entity-recovery.service.ts           # Restores tampered business records
│   ├── entity-integrity-evaluator.ts        # Compares live database snapshot against anchored audit
│   ├── entity-cluster-resolver.ts           # Groups visit and patient dependency clusters
│   ├── entity-recreation.service.ts         # Recreates deleted business entities from IPFS
│   ├── entity-recreation-blockers.ts        # Foreign key and unique constraint inspector
│   ├── entity-recreation-source-resolver.ts # Synthesizes complete entity snapshots from IPFS bundle
│   └── verified-audit-bundle.reader.ts      # Validates IPFS bundle integrity and Merkle roots
│
├── logging/             # Real-time transaction logging & V2 hash generation
│   ├── audit-logger.service.ts              # High-throughput logger with PostgreSQL Advisory Lock
│   ├── audit-record-builder.util.ts         # Builds V2 multi-layer hashes and encrypted payloads
│   └── audit-verification.util.ts           # Single-record cryptographic verification
│
├── crypto/              # Cryptographic algorithms & utilities
│   ├── audit-hash.util.ts                   # Canonical JSON serialization & SHA-256 hashing
│   ├── audit-diff.util.ts                   # Computes standardized schema diffJson V1
│   ├── audit-encryption.util.ts             # AES-256-GCM authenticated encryption with AAD
│   └── merkle.util.ts                       # Merkle Tree generator & inclusion proof calculator
│
└── ipfs/                # Decentralized IPFS Storage
    └── ipfs-artifact.service.ts             # Uploads and downloads encrypted audit bundles
```

### Core Cryptographic Guarantees:
- **V2 5-Layer Hashes:** `beforeHash`, `afterHash`, `diffHash`, `dataHash`, and `entryHash` establish mathematically linked audit entries.
- **Authenticated Additional Data (AAD):** `AES-256-GCM` encryption is cryptographically tied to `seq`, `entity`, `entityId`, and `action`, preventing ciphertext swapping attacks between records.
- **Zero PII On-Chain:** The blockchain stores only the 32-byte Merkle Root and IPFS CID, preserving complete patient privacy.

---

## 2. Blockchain & Smart Contract Infrastructure
Located at `src/infrastructure/blockchain/`, provides hardened JSON-RPC provider connections, a write mutex queue, and modular clients:

```text
src/infrastructure/blockchain/
├── blockchain.service.ts                    # Wallet signer & RPC provider coordinator facade
├── blockchain-action-hash.util.ts           # Domain-separated action hash utility
└── clients/
    ├── blockchain-governance.client.ts      # IdentityRegistry.sol client (Admin & Relayer roles)
    ├── blockchain-face-registry.client.ts   # FaceRegistry.sol client (Biometric template hashes)
    └── blockchain-audit-anchor.client.ts    # AuditAnchor.sol client (On-chain Merkle Checkpoints)
```

---

## 3. Multi-AI Clinical Gateway
Located at `src/modules/clinical-decision/infrastructure/ai/`, decoupling LLM providers from clinical domain services:

```text
src/modules/clinical-decision/infrastructure/ai/
├── provider-clinical-ai.gateway.ts          # Model routing gateway
├── clinical-ai-provider-client.ts           # Standard client interface
├── anthropic-clinical-ai.client.ts          # Anthropic Claude 3.5 Sonnet client
├── gemini-clinical-ai.client.ts             # Google Gemini 1.5 Pro client
├── openai-compatible-clinical-ai.client.ts  # OpenAI GPT-4o / vLLM compatible client
├── clinical-ai-credential.resolver.ts       # Secure API key resolver
├── clinical-ai-response.parser.ts           # Clinical JSON parser & sanitizer
└── clinical-ai-http.client.ts               # HTTP client with timeouts and retries
```

---

## 4. Cloud Storage Infrastructure
- **AWS S3 Private Storage Adapter:**
  - Securely stores radiology images (DICOM, JPG, PNG) and PDF lab reports in private S3 buckets.
  - Generates short-lived (15-minute) Pre-signed URLs after rigorous RBAC evaluation.
  - Maintains SHA-256 checksums in PostgreSQL to detect unauthorized modifications on cloud storage.
- **Cloudinary Avatar Uploader:**
  - Manages public profile avatars for hospital physicians and administrative personnel.

---

## 5. SMS & OTP Gateway
Located at `src/modules/patient-auth/sms/`:
- Integrates with the eSMS Brandname Gateway to dispatch 6-digit numeric OTPs for patient login.
- Features rate limiting, cooldown tracking, and HMAC-SHA256 hashed OTP storage.