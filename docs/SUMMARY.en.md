**🌐 Language:** [🇬🇧 English](./SUMMARY.en.md) · [🇷🇺 Русский](./SUMMARY.ru.md)

# Technical Summary


## What this project is

A modern, full-stack hospital platform pursuing the **Triple Aim**: better patient experience, sharper clinical outcomes, and unassailable data integrity. The codebase is structured as a monorepo (NestJS backend, React/Vite frontend, Solidity/Hardhat blockchain, Python AI side-services).

## Architecture at a glance

```text
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│  React + Vite   │ ─► │  NestJS + Prisma │ ─► │ PostgreSQL          │
│  4 role SPAs    │    │  (modular)       │    │ (canonical)         │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
                              │   │   │
                              │   │   └──► Cloudinary (medical files)
                              │   └──────► Python child process (AI/InsightFace)
                              └──────────► Hardhat / Ethers v6
                                            │
                                  ┌─────────▼──────────┐
                                  │ Audit anchors only │
                                  │ (hashes + Merkle)  │
                                  └────────────────────┘
```

- **Frontend** mirrors the same feature topology (`features/admin`, `features/doctor`, ...). Custom "Hospital OS" Tailwind theme. 4 roles: Admin, Receptionist, Doctor, Lab Manager.
- **Blockchain** stores **only** integrity hashes and Merkle roots — never PII or medical files. Active contracts are `IdentityRegistry`, `FaceRegistry`, and `AuditAnchor`; Department/Staff/AI model integrity now flows through `BlockchainLogger` + `AuditAnchor`.
- **AI** runs as a Python child process called from the backend (TensorFlow + InsightFace for face embeddings, plus a pluggable diagnostic provider).

## Security model

Three reinforcing layers:

1. **Biometric authentication.** Face verification for both staff and patients. 128-D face descriptors are encrypted at rest. A liveness step (multi-direction head pose + blink, with descriptor anchor for swap detection) precedes every enrollment.

2. **Step-up sessions ("sudo mode").** Sensitive writes (e.g. signing a clinical conclusion) require a step-up token. One face scan opens a privileged window — TTL ~3 min, idle ~10 min, absolute cap ~30 min — so users don't have to re-scan per action. iPhone-style auto-lock for shared workstations.

3. **Tamper-evident audit trail.** Every domain-write feeds an append-only `BlockchainLogger` table whose rows form a hash chain (each `entryHash` includes the previous one, salted with `AUDIT_PEPPER`). Every ~5 min a Merkle root over the new leaves is anchored on-chain via `AuditAnchor`, with on-row `txHash` for verification. Two policies:
   - **Tier A — anchor immediately** (e.g. blockchain wallet linkage, identity changes).
   - **Tier B — batch every 5 min** (clinical writes; better gas efficiency).
   See [`docs/security/audit-logging.md`](./security/audit-logging.md) for the exact hash formula and [`docs/security/tiers-and-anchoring.md`](./security/tiers-and-anchoring.md) for the policy matrix.

> The on-chain layer can detect tampering even if a hostile DBA edits Postgres directly: the recomputed Merkle root will not match the on-chain root.



## What makes this design notable

- **Out-of-band trust.** Recovery does not depend on the suspect server, the DB, or any in-server `.env`. The root of trust is a Web3 wallet on the Admin's personal device + an on-chain registry — both independent of the failing infrastructure.
- **Three-state integrity badges.** `VERIFIED` / `TAMPERED` / `UNANCHORED` are surfaced honestly in the UI rather than collapsed into a binary "healthy" pill, so operators can tell "verified on-chain" apart from "not verified yet."
- **Step-up sessions vs constant re-prompting.** A pragmatic UX choice that mirrors how real clinicians work — one scan opens a privileged window, lock-on-idle ends it.
- **Hash-only on-chain.** The blockchain layer is strictly an audit anchor. PII, medical files, and X-rays never leave PostgreSQL or Cloudinary. This is both a privacy invariant and a cost optimisation.

## Where to read more

| Topic | File |
|---|---|
| Domain model & conventions for AI assistants | [`AGENTS.md`](../AGENTS.md) |
| Backend clean architecture | [`docs/architecture/backend.md`](./architecture/backend.md) |
| Backend file structure | [`docs/architecture/backend-file-structure.md`](./architecture/backend-file-structure.md) |
| Frontend UI design system | [`docs/architecture/frontend-ui-guidelines.md`](./architecture/frontend-ui-guidelines.md) |
| Step-up tiers & anchoring policy | [`docs/security/tiers-and-anchoring.md`](./security/tiers-and-anchoring.md) |
| Audit logging & tamper-evidence | [`docs/security/audit-logging.md`](./security/audit-logging.md) |

> [!NOTE]
> The deep technical references above are maintained in Vietnamese only. This summary is the canonical English entry point.
