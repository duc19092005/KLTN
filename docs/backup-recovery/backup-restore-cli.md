# Database Backup & Verified Restore Workflow

What happens if data is tampered with, and we need to recover the correct data?

```text
[Hacker modifies DB] -> [Verification fails at seq=10]
                                  ↓
                  [Retrieve PostgreSQL Backups]
                                  ↓
      [Run Verification check on Backup DB against Blockchain Root]
                                  ↓
             Is Backup Valid? ── NO ──> [Reject Backup]
                   │
                  YES
                   ↓
   [Superadmin Face Scan Step-Up] ── Fail ──> [Abort Restore]
                   │
                Success
                   ↓
       [Restore Database to Clean State]
```

## 1. How Backup Data is Structured
The system uses automated, periodic PostgreSQL backups (dump files or WAL logs for PITR) saved to a secure, write-once-read-many (WORM) storage (e.g., AWS S3 with Object Lock or a read-only local backup vault).

## 2. Verification of the Backup Database
Before performing any restoration, the backup database **must be verified** against the blockchain to ensure it was not also tampered with or corrupted:
1. The backup database is restored onto an isolated staging environment.
2. The verification engine runs local hash-chain checks and Merkle roots verification on this backup database, comparing them against the immutable roots stored in the on-chain `AuditAnchor` contract.
3. If the backup's calculated Merkle roots match the on-chain roots, the backup is certified as **100% authentic and clean**.

## 3. Biometric-Secured Restore Execution
To prevent malicious actors from triggering unauthorized database restores:
1. **Mandatory Face Verification:** The database restore script is protected by a **Face Step-up authentication guard**.
2. **Superadmin authorization:** The physical superadmin must perform a live facial scan (verified against the on-chain `FaceRegistry`).
3. **Execution:** Only when the biometric match is verified and a single-use restore token is minted, the database restoration process is allowed to run.

## 4. Emergency Database Recovery (Out-of-Band CLI)
If the database or `User` table is completely compromised, preventing the Admin from logging into the web dashboard:
1. Run the emergency CLI restore command directly on the server host:
   ```bash
   npm run db:emergency-restore <path_to_backup_file>
   ```
2. The tool will print a dynamic cryptographic challenge.
3. The Admin signs this challenge using their Web3 wallet (via MetaMask or hardware wallets).
4. Paste the signature back into the CLI prompt.
5. The script recovers the signer's address, calls the blockchain (`IdentityRegistry`) directly via RPC, and if the signer is recognized as an authorized Admin or the owner, it executes the restore, bypassing database authentication checks entirely.
6. **Note on Face Scanning:** This flow **does not perform a face scan** because SSH/Terminal sessions do not have access to camera hardware, and the DB data cannot be trusted. Web3 cryptographic signing is used instead.
