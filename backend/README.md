# KLTN Hospital Management System - Backend

A NestJS-based enterprise healthcare platform with ZKP identity verification, biometric authentication, PostgreSQL database, and blockchain audit anchoring.

## Project Setup

```bash
# Install dependencies
$ npm install

# Generate Prisma client
$ npm run prisma:generate

# Build project
$ npm run build

# Start development server
$ npm run start:dev
```

---

## ⛓️ Blockchain Audit & Merkle Tree Anchoring

To guarantee maximum data integrity while avoiding excessive gas costs on public/private blockchains, this system implements a hybrid **Hash-Chain + Merkle Tree Anchoring** mechanism.

```mermaid
graph TD
    subgraph PostgreSQL Database
        MC[MedicalConclusion #10] -->|1. Generate Hash| SNAP[Snapshot Hash256]
        SNAP -->|2. Append to Log| BL[BlockchainLogger seq=10]
        BL -->|3. Linked List| BL_NEXT[BlockchainLogger seq=11]
    end
    
    subgraph Merkle Tree Generator
        BL -->|Leaf 0| MT[Merkle Tree Batch]
        BL_NEXT -->|Leaf 1| MT
        MT -->|Compute Root| MR[Merkle Root]
    end

    subgraph Blockchain (Smart Contract)
        MR -->|4. commitRoot| AA[AuditAnchor Contract]
    end
```

### 1. Merkle Tree Mechanism
Instead of committing every medical event individually to the blockchain, the system batches log entries:
1. **Leaves generation:** Each log entry in the `BlockchainLogger` table represents a leaf. Its hash is the `entryHash`, which is computed as:
   `entryHash = SHA256(pepper | seq | prevHash | dataHash | createdAt)`
2. **Tree Building:** The system hashes adjacent leaves together recursively to build a binary tree (Merkle Tree) until a single hash remains at the top: the **Merkle Root**.
3. **On-chain Anchor:** Only this **Merkle Root** is written to the blockchain in the `AuditAnchor` smart contract via the `commitRoot(batchId, root, leafCount)` function.
4. **Inclusion Proof (Merkle Proof):** To verify that a specific log entry exists in that batch on-chain, we compute a list of hashes (sibling hashes) called a **Merkle Proof**. Using this proof and the leaf hash, anyone can recompute the root and verify it against the immutable root stored on-chain.

---

### 2. Scenario: Hacker Tampers with Doctor A's Conclusion #10

Let's assume **Doctor A** created **Medical Conclusion #10** with the text: `"Bệnh nhân bị viêm dạ dày, chỉ định uống thuốc X."`
The system generated a snapshot, calculated `hash256` and `dataSalt`, saved them in the `MedicalConclusion` table, and appended a log entry in `BlockchainLogger` (e.g. `seq = 10`, `dataHash` = `hash256`). The batch was then anchored on-chain with Merkle Root `0xRootABC`.

Now, a **Hacker** attempts to silently modify Conclusion #10's diagnosis text in the database to: `"Bệnh nhân hoàn toàn khỏe mạnh, không cần uống thuốc."` (e.g., to cover up a medical error or malicious prescription change).

Here is how the checker service detects the fraud step-by-step:

#### Lớp 1: Kiểm tra tính toàn vẹn cục bộ (Local Integrity Check)
The checker recomputes the SHA-256 hash of the current conclusion text in the `MedicalConclusion` table using the stored `dataSalt` and compares it against the `hash256` field in the same table.
* **If the hacker only modified the text** but left the `hash256` column untouched:
  * `recomputedHash !== storedHash` $\rightarrow$ **TAMPER DETECTED!**

#### Lớp 2: Kiểm tra chéo với Nhật ký hệ thống (Cross-Log Integrity Check)
To bypass Lớp 1, the hacker also updates the `hash256` column in the `MedicalConclusion` table to match the new text's hash.
* The checker queries the matching log entry in the `BlockchainLogger` table (where `entity = "MedicalConclusion"` and `entityId = conclusion.id`).
* The checker compares the conclusion's `hash256` with the log's `dataHash`.
* **Since the `BlockchainLogger` is protected by database triggers** that block updates/deletes, the log's `dataHash` remains the original hash.
* `conclusion.hash256 !== logger.dataHash` $\rightarrow$ **TAMPER DETECTED!**

#### Lớp 3: Kiểm tra đứt gãy chuỗi liên kết (Hash-Chain Verification)
To bypass Lớp 2, the hacker attempts to bypass database triggers (e.g., by gaining superuser DB access, disabling triggers, and modifying the `dataHash` in the log entry `seq = 10` to match the new hash).
* To prevent this, `BlockchainLogger` is a hash chain (each entry points to `prevHash`).
* Since the hacker modified `dataHash` of `seq = 10`, the `entryHash` of `seq = 10` changes.
* This breaks the chain because the next record (`seq = 11`) expects the old `entryHash` in its `prevHash` column.
* `logger[11].prevHash !== logger[10].entryHash` $\rightarrow$ **TAMPER DETECTED!** (The chain is broken at `seq = 10`).

#### Lớp 4: Xác thực On-chain với Merkle Root (On-Chain Blockchain Anchor check)
To bypass Lớp 3, the hacker recalculates the entire hash-chain from `seq = 10` to the latest record in the database so that all `prevHash` linkages align.
* The checker requests the **Merkle Proof** for log `seq = 10` from the current database.
* The checker queries the `AuditAnchor` smart contract on the blockchain to get the committed Merkle Root for the batch containing `seq = 10` (which is `0xRootABC`).
* The checker recalculates the Merkle Root using the current database leaf hash of `seq = 10` and the sibling hashes provided by the proof.
* Since the leaf hash of `seq = 10` has been changed by the hacker, the recalculated root will be `0xRootXYZ`.
* `recalculatedRoot (0xRootXYZ) !== onChainRoot (0xRootABC)` $\rightarrow$ **TAMPER DETECTED!**
* **Conclusion:** Because the blockchain root `0xRootABC` is immutable and cannot be modified by any hacker or admin, the tampering of Doctor A's Conclusion #10 is mathematically proven.

---

### 3. Database Backup & Verified Restore Workflow

What happens if Doctor A's Conclusion #10 is indeed modified, and we need to recover the correct data?

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

#### 3.1. How Backup Data is Structured
The system uses automated, periodic PostgreSQL backups (dump files or WAL logs for PITR) saved to a secure, write-once-read-many (WORM) storage (e.g., AWS S3 with Object Lock or a read-only local backup vault).

#### 3.2. Verification of the Backup Database
Before performing any restoration, the backup database **must be verified** against the blockchain to ensure it was not also tampered with or corrupted:
1. The backup database is restored onto an isolated staging environment.
2. The verification engine runs Lớp 3 and Lớp 4 checks on this backup database, comparing its local hash-chains and Merkle roots against the immutable roots stored in the on-chain `AuditAnchor` contract.
3. If the backup's calculated Merkle roots match the on-chain roots, the backup is certified as **100% authentic and clean**.

#### 3.3. Biometric-Secured Restore Execution
To prevent malicious actors from triggering unauthorized database restores (e.g., to rollback database transactions, remove billing records, or overwrite active data with a stale backup):
1. **Mandatory Face Verification:** The database restore script is protected by a **Face Step-up authentication guard**.
2. **Superadmin authorization:** The physical superadmin must perform a live facial scan (verified against the on-chain `FaceRegistry`).
3. **Execution:** Only when the biometric match is verified and a single-use restore token is minted, the database restoration process is allowed to run, restoring the database to the verified clean state.

#### 3.4. Emergency Database Recovery (Out-of-Band CLI)
If the database or `User` table is completely compromised, preventing the Admin from logging into the web dashboard (e.g., deleted credentials, changed passwords, or tampered face templates):
1. Run the emergency CLI restore command directly on the server host:
   ```bash
   npm run db:emergency-restore <path_to_backup_file>
   ```
2. The tool will print a dynamic cryptographic challenge.
3. The Admin signs this challenge using their Web3 wallet (via MetaMask or hardware wallets).
4. Paste the signature back into the CLI prompt.
5. The script recovers the signer's address, calls the blockchain (`IdentityRegistry`) directly via RPC, and if the signer is recognized as an authorized Admin or the owner, it executes the restore (using docker-compose fallback or local psql), bypassing database authentication checks entirely.
6. **Note on Face Scanning:** This flow **does not perform a face scan** because (a) SSH/Terminal sessions do not have access to camera hardware, and (b) if the database is compromised, the face template comparison data in the DB cannot be trusted. Web3 cryptographic signing is used instead as the root of trust.

