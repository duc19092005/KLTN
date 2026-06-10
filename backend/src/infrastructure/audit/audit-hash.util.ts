import { createHash, createHmac, randomBytes } from 'crypto';

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
  return JSON.stringify(toCanonicalJson(value, '$', new WeakSet<object>()));
}

type CanonicalJson = null | boolean | number | string | CanonicalJson[] | { [key: string]: CanonicalJson };

function toCanonicalJson(value: unknown, path: string, seen: WeakSet<object>): CanonicalJson {
  if (value === null) return null;

  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'boolean') return value as string | boolean;
  if (valueType === 'number') {
    if (!Number.isFinite(value as number)) {
      throw new Error(`Unsupported non-finite number at ${path}: NaN/Infinity are not valid audit JSON`);
    }
    return value as number;
  }
  if (valueType === 'undefined') {
    throw new Error(`Unsupported undefined at ${path}: use null or omit the field explicitly`);
  }
  if (valueType === 'bigint') {
    throw new Error(`Unsupported BigInt at ${path}: convert to string before audit hashing`);
  }
  if (valueType === 'function' || valueType === 'symbol') {
    throw new Error(`Unsupported ${valueType} at ${path}: audit snapshots must be plain JSON data`);
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`Unsupported invalid Date at ${path}`);
    }
    return value.toISOString();
  }

  if (value instanceof Map || value instanceof Set) {
    throw new Error(`Unsupported ${value.constructor.name} at ${path}: convert to a deterministic plain object/array first`);
  }

  if (isBinaryLike(value)) {
    throw new Error(`Unsupported binary data at ${path}: convert to a deterministic string digest before audit hashing`);
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) throw new Error(`Unsupported cyclic object at ${path}`);
    seen.add(value);
    const result = value.map((item, index) => toCanonicalJson(item, `${path}[${index}]`, seen));
    seen.delete(value);
    return result;
  }

  if (valueType === 'object') {
    const objectValue = value as Record<string, unknown>;
    if (!isPlainObject(objectValue)) {
      const constructorName = objectValue.constructor?.name ?? 'Object';
      throw new Error(`Unsupported non-plain object ${constructorName} at ${path}: convert to plain JSON before audit hashing`);
    }
    if (seen.has(objectValue)) throw new Error(`Unsupported cyclic object at ${path}`);
    seen.add(objectValue);

    const result = Object.keys(objectValue)
      .sort()
      .reduce((acc, key) => {
        acc[key] = toCanonicalJson(objectValue[key], `${path}.${key}`, seen);
        return acc;
      }, {} as { [key: string]: CanonicalJson });

    seen.delete(objectValue);
    return result;
  }

  throw new Error(`Unsupported value at ${path}: audit snapshots must be plain JSON data`);
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isBinaryLike(value: unknown): boolean {
  return Buffer.isBuffer(value) || ArrayBuffer.isView(value) || value instanceof ArrayBuffer;
}

/** Generate a fresh random salt (hex). */
export function generateSalt(bytes = 16): string {
  return randomBytes(bytes).toString('hex');
}

/** The configured global pepper. Required in production. */
export function getPepper(): string {
  const pepper = process.env.AUDIT_PEPPER || '';
  if (process.env.NODE_ENV === 'production' && !pepper) {
    throw new Error('AUDIT_PEPPER is required in production for audit hash integrity');
  }
  return pepper;
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

/** prevHash value for the very first chain entry (seq = 1). 32 zero bytes in hex. */
export const GENESIS_PREV_HASH = '0'.repeat(64);

/**
 * Core fields that uniquely and immutably identify one audit entry. These are the only inputs to
 * the chain leaf; mutable anchoring metadata (txHash, batchId, ...) is deliberately excluded so
 * the chain stays stable as logs get anchored.
 */
export interface AuditEntryCore {
  seq: number;
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  dataHash?: string | null;
  createdAtIso: string;
}

/**
 * Compute the hash-chain leaf for one audit entry:
 *   entryHash = SHA256(pepper | seq | prevHash | canonical(core)).
 *
 * Because prevHash is the previous entry's entryHash, every leaf transitively commits to the
 * entire history before it. Deleting or editing any past row makes its successor's recomputed
 * entryHash diverge, so the tamper is provable. The pepper (env-only) stops an attacker with mere
 * DB access from forging a valid chain.
 */
export function computeEntryHash(core: AuditEntryCore, prevHash: string, pepper = getPepper()): string {
  const canonical = canonicalize({
    seq: core.seq,
    actorId: core.actorId ?? null,
    action: core.action,
    entity: core.entity,
    entityId: core.entityId ?? null,
    dataHash: core.dataHash ?? null,
    createdAtIso: core.createdAtIso,
  });
  return createHash('sha256').update(`${pepper}|${core.seq}|${prevHash}|${canonical}`).digest('hex');
}

export const AUDIT_ENTRY_V2 = 'KLTN_AUDIT_ENTRY_V2';
export const AUDIT_DATA_V2 = 'KLTN_AUDIT_DATA_V2';
const AUDIT_BEFORE_V1 = 'KLTN_AUDIT_BEFORE_V1';
const AUDIT_AFTER_V1 = 'KLTN_AUDIT_AFTER_V1';
const AUDIT_DIFF_V1 = 'KLTN_AUDIT_DIFF_V1';
const MIN_AUDIT_KEY_CHARS = 32;
const INSECURE_DEV_HASH_KEY = 'dev-only-insecure-audit-hash-key-change-me-32-bytes';

function allowInsecureAuditCrypto(): boolean {
  return process.env.ALLOW_INSECURE_AUDIT_CRYPTO === 'true' && process.env.NODE_ENV !== 'production';
}

function fingerprintSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex').slice(0, 12);
}

export interface AuditDataHashV2Input {
  entity: string;
  entityId?: string | null;
  action: string;
  beforeHash?: string | null;
  afterHash?: string | null;
  diffHash?: string | null;
  fieldsChanged?: unknown;
}

export interface AuditEntryHashV2Input extends AuditDataHashV2Input {
  seq: number;
  prevHash: string;
  actorId?: string | null;
  dataHash: string;
  createdAtIso: string;
}

export function getAuditHashKey(): string {
  const key = process.env.AUDIT_HASH_KEY || '';
  if (!key) {
    if (allowInsecureAuditCrypto()) return INSECURE_DEV_HASH_KEY;
    throw new Error('AUDIT_HASH_KEY is required for Blockchain Audit V2. Set ALLOW_INSECURE_AUDIT_CRYPTO=true only for local dev/CI fallback.');
  }
  if (key.length < MIN_AUDIT_KEY_CHARS) {
    throw new Error(`AUDIT_HASH_KEY must be at least ${MIN_AUDIT_KEY_CHARS} characters`);
  }
  return key;
}

export function getAuditHashKeyFingerprint(): string {
  return fingerprintSecret(getAuditHashKey());
}

function hmacSha256Hex(message: string, key = getAuditHashKey()): string {
  return createHmac('sha256', key).update(message).digest('hex');
}

export function computeBeforeHashV2(entity: string, entityId: string | null | undefined, rawBefore: unknown, key = getAuditHashKey()): string {
  return hmacSha256Hex(`${AUDIT_BEFORE_V1}|${entity}|${entityId ?? null}|${canonicalize(rawBefore)}`, key);
}

export function computeAfterHashV2(entity: string, entityId: string | null | undefined, rawAfter: unknown, key = getAuditHashKey()): string {
  return hmacSha256Hex(`${AUDIT_AFTER_V1}|${entity}|${entityId ?? null}|${canonicalize(rawAfter)}`, key);
}

export function computeDiffHashV2(diffJson: unknown, key = getAuditHashKey()): string {
  return hmacSha256Hex(`${AUDIT_DIFF_V1}|${canonicalize(diffJson)}`, key);
}

export function computeDataHashV2(input: AuditDataHashV2Input, key = getAuditHashKey()): string {
  return hmacSha256Hex(
    canonicalize({
      schema: AUDIT_DATA_V2,
      entity: input.entity,
      entityId: input.entityId ?? null,
      action: input.action,
      beforeHash: input.beforeHash ?? null,
      afterHash: input.afterHash ?? null,
      diffHash: input.diffHash ?? null,
      fieldsChanged: input.fieldsChanged ?? [],
    }),
    key,
  );
}

export function computeEntryHashV2(input: AuditEntryHashV2Input): string {
  return createHash('sha256')
    .update(
      canonicalize({
        schema: AUDIT_ENTRY_V2,
        seq: input.seq,
        prevHash: input.prevHash,
        entity: input.entity,
        entityId: input.entityId ?? null,
        action: input.action,
        actorId: input.actorId ?? null,
        dataHash: input.dataHash,
        beforeHash: input.beforeHash ?? null,
        afterHash: input.afterHash ?? null,
        diffHash: input.diffHash ?? null,
        createdAtIso: input.createdAtIso,
      }),
    )
    .digest('hex');
}
