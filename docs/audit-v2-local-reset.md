# Blockchain Audit V2 Local Reset

This document describes the **local-only** reset workflow for Blockchain Audit V2 during development.

> [!CAUTION]
> Never run this against production or staging data. The reset deletes audit chain rows and audit batches.
> It is intended only for disposable local databases while the project is still in development.

## What the reset does

The helper script clears:

- `BlockchainLogger`
- `AuditBatch`
- audit integrity columns on local domain rows:
  - `Patient.hash256`, `Patient.dataSalt`
  - `StaffProfile.hash256`, `StaffProfile.dataSalt`
  - `DoctorProfile.hash256`, `DoctorProfile.dataSalt`
  - `Department.hash256`, `Department.dataSalt`
  - `MedicalConclusion.hash256`, `MedicalConclusion.dataSalt`
  - `AiModelRegistry.hash256`, `AiModelRegistry.dataSalt`

It does **not** delete patients, visits, staff, doctors, orders, results, or conclusions.

## Safety gates

The script refuses to run unless all local safety checks pass:

1. `NODE_ENV` must not be `production`.
2. `ALLOW_DEV_AUDIT_RESET=true` must be set.
3. If `DATABASE_URL` looks remote, the script refuses unless
   `FORCE_REMOTE_DEV_AUDIT_RESET=true` is also set.
4. The operator must type the exact confirmation phrase:

```text
RESET AUDIT V2
```

For non-interactive disposable CI/dev containers, add:

```bash
SKIP_DEV_AUDIT_RESET_PROMPT=true
```

## Command

Run from the backend directory:

```bash
ALLOW_DEV_AUDIT_RESET=true npm run audit:v2:reset:dev
```

For a fully non-interactive local container:

```bash
ALLOW_DEV_AUDIT_RESET=true \
SKIP_DEV_AUDIT_RESET_PROMPT=true \
npm run audit:v2:reset:dev
```

## Recommended local workflow

1. Stop backend workers that may be writing audit logs.
2. Confirm the database is local/disposable.
3. Run the reset command.
4. Re-run seed or manually replay critical flows:
   - patient update
   - staff/doctor update
   - visit status update
   - medical result creation
   - medical conclusion finalization
   - security login/face-step-up event
5. Start the backend and allow `AuditAnchorService` to create fresh V2 batches.
6. Verify the audit UI shows V2 rows with encrypted diffs and redaction policy codes.

## Why this exists

Blockchain Audit V2 changed audit row hashing, encryption, redaction, and Merkle anchoring.
During local development it is often cleaner to discard old local audit rows instead of
migrating demo data. This helper provides that path while keeping destructive behavior gated.
