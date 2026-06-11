import { createHash } from 'crypto';
import { getPepper, canonicalize, GENESIS_PREV_HASH } from '../../../infrastructure/audit/audit-hash.util';

/**
 * A backup manifest is the small, hashable description of one backup. The dump file itself is large
 * and stored on disk / object store; the manifest is what we anchor on-chain so the backup becomes
 * self-verifying:
 *   - sha256   proves the dump bytes were not altered after creation,
 *   - maxSeq   tells us up to which audited change the backup is "fresh" (poisoned-backup diagnosis),
 *   - createdAtIso pins the exact moment of creation for legal timestamping.
 */
export interface BackupManifest {
  backupCode: string;
  fileName: string;
  sha256: string;
  sizeBytes: number;
  maxSeq: number | null;
  createdAtIso: string;
}

/**
 * Hash-chain leaf for the backup ledger, mirroring the BlockchainLogger chain convention:
 *   entryHash = SHA256(pepper | backupCode | sha256 | maxSeq | createdAtIso | prevHash | canonical)
 * Because prevHash links to the previous backup, silently deleting or reordering a BackupRecord
 * breaks the chain and is provable — even an attacker with DB access cannot forge it without the
 * env-only pepper.
 */
export function computeBackupEntryHash(
  manifest: BackupManifest,
  prevHash: string = GENESIS_PREV_HASH,
  pepper = getPepper(),
): string {
  const canonical = canonicalize({
    backupCode: manifest.backupCode,
    fileName: manifest.fileName,
    sha256: manifest.sha256,
    sizeBytes: manifest.sizeBytes,
    maxSeq: manifest.maxSeq ?? null,
    createdAtIso: manifest.createdAtIso,
  });
  return createHash('sha256')
    .update(`${pepper}|${manifest.backupCode}|${manifest.sha256}|${manifest.maxSeq ?? ''}|${manifest.createdAtIso}|${prevHash}|${canonical}`)
    .digest('hex');
}

/** SHA256 of an arbitrary buffer (the dump file). Lowercase hex. */
export function sha256Buffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}
