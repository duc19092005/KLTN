import { createHash, randomBytes } from 'crypto';

/**
 * Audit hashing utilities for tamper-evidence.
 *
 * The integrity hash of a record is SHA256(pepper || salt || canonicalData) where:
 *  - pepper: a secret, global value from env (AUDIT_PEPPER). Never stored in the DB, so an
 *    attacker who only has database access cannot recompute a valid hash to forge the chain.
 *  - salt: a per-record random value stored alongside the record. Prevents identical payloads
 *    from producing identical hashes and defeats precomputation/rainbow attacks.
 *  - canonicalData: a deterministic JSON serialization of the business fields (keys sorted),
 *    so logically-equal objects always hash identically regardless of key order.
 *
 * The resulting hex digest is mirrored on-chain (DepartmentRegistry). Verification recomputes
 * this hash from the current DB row and compares it with the immutable on-chain value.
 */

/** Recursively produce a deterministic JSON string with object keys sorted. */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: any): any {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map(sortValue);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortValue(value[key]);
        return acc;
      }, {} as Record<string, any>);
  }
  return value;
}

/** Generate a fresh random salt (hex). */
export function generateSalt(bytes = 16): string {
  return randomBytes(bytes).toString('hex');
}

/** The configured global pepper. Empty string if unset (degrades to salt-only hashing). */
export function getPepper(): string {
  return process.env.AUDIT_PEPPER || '';
}

/**
 * Compute the integrity hash for a record snapshot.
 * @returns lowercase hex SHA256 digest.
 */
export function computeRecordHash(data: unknown, salt: string, pepper = getPepper()): string {
  const canonical = canonicalize(data);
  return createHash('sha256').update(`${pepper}|${salt}|${canonical}`).digest('hex');
}

/**
 * Convert a hex SHA256 digest into a 0x-prefixed bytes32 string for on-chain storage.
 * DepartmentRegistry stores values as bytes32, and SHA256 is exactly 32 bytes.
 */
export function hashToBytes32(hexDigest: string): string {
  const clean = hexDigest.startsWith('0x') ? hexDigest.slice(2) : hexDigest;
  if (clean.length !== 64) throw new Error('Expected a 32-byte (64 hex char) SHA256 digest');
  return `0x${clean}`;
}
