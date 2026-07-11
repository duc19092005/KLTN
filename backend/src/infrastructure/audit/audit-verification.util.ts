import {
  AUDIT_ENTRY_V2,
  AuditEntryCore,
  canonicalize,
  computeAfterHashV2,
  computeBeforeHashV2,
  computeDataHashV2,
  computeDiffHashV2,
  computeEntryHash,
  computeEntryHashV2,
  GENESIS_PREV_HASH,
} from './audit-hash.util';
import { buildAuditEncryptionAad, decryptAuditSnapshot, EncryptedAuditSnapshot } from './audit-encryption.util';

export type AuditVerificationStatus = 'VERIFIED' | 'PENDING' | 'TAMPERED';

export interface AuditRowLike {
  seq: number | null;
  prevHash: string | null;
  entryHash: string | null;
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  dataHash?: string | null;
  dataSalt?: string | null;
  beforeJson?: unknown;
  afterJson?: unknown;
  beforeHash?: string | null;
  afterHash?: string | null;
  diffHash?: string | null;
  hashVersion?: string | null;
  beforeEncrypted?: unknown;
  afterEncrypted?: unknown;
  diffJson?: unknown;
  fieldsChanged?: unknown;
  createdAt: Date | string;
}

export interface AuditRowVerificationResult {
  ok: boolean;
  status: AuditVerificationStatus;
  version: 'V1' | 'V2';
  reason: string | null;
  suspiciousFields: string[];
  decryptedBefore?: unknown;
  decryptedAfter?: unknown;
}

function createdAtIso(row: AuditRowLike): string {
  return row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date(row.createdAt).toISOString();
}

function parseJsonSnapshot(canonicalSnapshot: string): unknown {
  return JSON.parse(canonicalSnapshot);
}

function isEncryptedSnapshot(value: unknown): value is EncryptedAuditSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EncryptedAuditSnapshot>;
  return (
    candidate.alg === 'AES-256-GCM' &&
    typeof candidate.keyId === 'string' &&
    typeof candidate.iv === 'string' &&
    typeof candidate.tag === 'string' &&
    typeof candidate.ciphertext === 'string'
  );
}

function normalizeFieldsChanged(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).sort() : [];
}

function fieldsChangedFromDiff(diffJson: unknown): string[] {
  if (!diffJson || typeof diffJson !== 'object') return [];
  const fields = (diffJson as { fieldsChanged?: unknown }).fieldsChanged;
  return normalizeFieldsChanged(fields);
}

export function verifyAuditRow(row: AuditRowLike): AuditRowVerificationResult {
  if (row.hashVersion === AUDIT_ENTRY_V2) return verifyAuditRowV2(row);
  return verifyAuditRowV1(row);
}

/**
 * Fast list-view check: recomputes entryHash / dataHash from fields already stored
 * on the row. Does NOT decrypt encrypted snapshots (cheap, safe for paginated lists).
 * Open detail still uses full verifyAuditRow (decrypt + recompute).
 */
export function verifyAuditRowLight(row: AuditRowLike): AuditRowVerificationResult {
  if (row.hashVersion === AUDIT_ENTRY_V2) {
    const suspiciousFields: string[] = [];
    if (row.seq == null) suspiciousFields.push('seq');
    if (!row.entryHash) suspiciousFields.push('entryHash');
    if (!row.beforeHash) suspiciousFields.push('beforeHash');
    if (!row.afterHash) suspiciousFields.push('afterHash');
    if (!row.diffHash) suspiciousFields.push('diffHash');
    if (!row.dataHash) suspiciousFields.push('dataHash');
    if (suspiciousFields.length > 0) {
      return {
        ok: false,
        status: 'PENDING',
        version: 'V2',
        reason: `Thiếu field bắt buộc để kiểm tra hash: ${suspiciousFields.join(', ')}. Thường gặp ở log cũ, ghi dở, hoặc event không đủ schema V2.`,
        suspiciousFields,
      };
    }

    const fieldsChanged = normalizeFieldsChanged(row.fieldsChanged);
    const recomputedDataHash = computeDataHashV2({
      entity: row.entity,
      entityId: row.entityId ?? null,
      action: row.action,
      beforeHash: row.beforeHash!,
      afterHash: row.afterHash!,
      diffHash: row.diffHash!,
      fieldsChanged,
    });
    if (recomputedDataHash !== row.dataHash) {
      return {
        ok: false,
        status: 'TAMPERED',
        version: 'V2',
        reason: 'dataHash không khớp (kiểm tra nhanh danh sách).',
        suspiciousFields: ['dataHash'],
      };
    }

    const recomputedEntryHash = computeEntryHashV2({
      seq: row.seq!,
      prevHash: row.prevHash ?? GENESIS_PREV_HASH,
      entity: row.entity,
      entityId: row.entityId ?? null,
      action: row.action,
      actorId: row.actorId ?? null,
      beforeHash: row.beforeHash!,
      afterHash: row.afterHash!,
      diffHash: row.diffHash!,
      dataHash: row.dataHash!,
      createdAtIso: createdAtIso(row),
    });
    if (recomputedEntryHash !== row.entryHash) {
      return {
        ok: false,
        status: 'TAMPERED',
        version: 'V2',
        reason: 'entryHash không khớp (kiểm tra nhanh danh sách).',
        suspiciousFields: ['entryHash'],
      };
    }

    return {
      ok: true,
      status: 'VERIFIED',
      version: 'V2',
      reason: 'Kiểm tra nhanh danh sách (không giải mã snapshot). Mở chi tiết để xác thực đầy đủ.',
      suspiciousFields: [],
    };
  }

  return verifyAuditRowV1(row);
}

export function verifyAuditRowV1(row: AuditRowLike): AuditRowVerificationResult {
  if (row.seq == null || !row.entryHash) {
    return { ok: false, status: 'PENDING', version: 'V1', reason: 'Missing V1 seq or entryHash', suspiciousFields: ['seq', 'entryHash'] };
  }
  const recomputed = computeEntryHash(
    {
      seq: row.seq,
      actorId: row.actorId ?? null,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId ?? null,
      dataHash: row.dataHash ?? null,
      createdAtIso: createdAtIso(row),
    } satisfies AuditEntryCore,
    row.prevHash ?? GENESIS_PREV_HASH,
  );
  if (recomputed !== row.entryHash) {
    return { ok: false, status: 'TAMPERED', version: 'V1', reason: 'V1 entryHash mismatch', suspiciousFields: ['entryHash', 'dataHash'] };
  }
  return { ok: true, status: 'VERIFIED', version: 'V1', reason: null, suspiciousFields: [] };
}

export function verifyAuditRowV2(row: AuditRowLike): AuditRowVerificationResult {
  const suspiciousFields: string[] = [];
  if (row.seq == null) suspiciousFields.push('seq');
  if (!row.entryHash) suspiciousFields.push('entryHash');
  if (!row.beforeHash) suspiciousFields.push('beforeHash');
  if (!row.afterHash) suspiciousFields.push('afterHash');
  if (!row.diffHash) suspiciousFields.push('diffHash');
  if (!row.dataHash) suspiciousFields.push('dataHash');
  if (!isEncryptedSnapshot(row.beforeEncrypted)) suspiciousFields.push('beforeEncrypted');
  if (!isEncryptedSnapshot(row.afterEncrypted)) suspiciousFields.push('afterEncrypted');
  if (suspiciousFields.length > 0) {
    return { ok: false, status: 'TAMPERED', version: 'V2', reason: 'Missing required V2 audit fields', suspiciousFields };
  }

  try {
    const aad = buildAuditEncryptionAad({
      seq: row.seq!,
      entity: row.entity,
      entityId: row.entityId ?? null,
      action: row.action,
      createdAtIso: createdAtIso(row),
    });
    const beforeCanonical = decryptAuditSnapshot(row.beforeEncrypted as EncryptedAuditSnapshot, aad);
    const afterCanonical = decryptAuditSnapshot(row.afterEncrypted as EncryptedAuditSnapshot, aad);
    const decryptedBefore = parseJsonSnapshot(beforeCanonical);
    const decryptedAfter = parseJsonSnapshot(afterCanonical);
    const recomputedBeforeHash = computeBeforeHashV2(row.entity, row.entityId, decryptedBefore);
    const recomputedAfterHash = computeAfterHashV2(row.entity, row.entityId, decryptedAfter);
    const recomputedDiffHash = computeDiffHashV2(row.diffJson);
    const fieldsChanged = normalizeFieldsChanged(row.fieldsChanged);
    const diffFieldsChanged = fieldsChangedFromDiff(row.diffJson);
    const recomputedDataHash = computeDataHashV2({
      entity: row.entity,
      entityId: row.entityId ?? null,
      action: row.action,
      beforeHash: recomputedBeforeHash,
      afterHash: recomputedAfterHash,
      diffHash: recomputedDiffHash,
      fieldsChanged,
    });
    const recomputedEntryHash = computeEntryHashV2({
      seq: row.seq!,
      prevHash: row.prevHash ?? GENESIS_PREV_HASH,
      entity: row.entity,
      entityId: row.entityId ?? null,
      action: row.action,
      actorId: row.actorId ?? null,
      beforeHash: recomputedBeforeHash,
      afterHash: recomputedAfterHash,
      diffHash: recomputedDiffHash,
      dataHash: recomputedDataHash,
      createdAtIso: createdAtIso(row),
    });

    if (recomputedBeforeHash !== row.beforeHash) suspiciousFields.push('beforeEncrypted', 'beforeHash');
    if (recomputedAfterHash !== row.afterHash) suspiciousFields.push('afterEncrypted', 'afterHash');
    if (recomputedDiffHash !== row.diffHash) suspiciousFields.push('diffJson', 'diffHash');
    if (canonicalize(fieldsChanged) !== canonicalize(diffFieldsChanged)) suspiciousFields.push('fieldsChanged', 'diffJson');
    if (recomputedDataHash !== row.dataHash) suspiciousFields.push('dataHash');
    if (recomputedEntryHash !== row.entryHash) suspiciousFields.push('entryHash');

    if (suspiciousFields.length > 0) {
      return {
        ok: false,
        status: 'TAMPERED',
        version: 'V2',
        reason: 'V2 audit hash mismatch',
        suspiciousFields: Array.from(new Set(suspiciousFields)),
        decryptedBefore,
        decryptedAfter,
      };
    }

    return { ok: true, status: 'VERIFIED', version: 'V2', reason: null, suspiciousFields: [], decryptedBefore, decryptedAfter };
  } catch (error) {
    return {
      ok: false,
      status: 'TAMPERED',
      version: 'V2',
      reason: error instanceof Error ? error.message : 'Unable to verify V2 audit row',
      suspiciousFields: ['beforeEncrypted', 'afterEncrypted'],
    };
  }
}

export function compareLiveSnapshotToAuditAfter(row: AuditRowLike, liveSnapshot: unknown): AuditRowVerificationResult {
  const rowResult = verifyAuditRow(row);
  if (!rowResult.ok) return rowResult;
  if (row.hashVersion !== AUDIT_ENTRY_V2) return rowResult;

  const liveHash = computeAfterHashV2(row.entity, row.entityId, liveSnapshot);
  if (liveHash !== row.afterHash) {
    const suspiciousFields = inferChangedFields(rowResult.decryptedAfter, liveSnapshot);
    return {
      ok: false,
      status: 'TAMPERED',
      version: 'V2',
      reason: 'Live DB snapshot does not match latest audited afterHash',
      suspiciousFields,
      decryptedBefore: rowResult.decryptedBefore,
      decryptedAfter: rowResult.decryptedAfter,
    };
  }

  return rowResult;
}

function inferChangedFields(expected: unknown, actual: unknown): string[] {
  if (!expected || !actual || typeof expected !== 'object' || typeof actual !== 'object') return ['snapshot'];
  const left = expected as Record<string, unknown>;
  const right = actual as Record<string, unknown>;
  return Array.from(new Set([...Object.keys(left), ...Object.keys(right)]))
    .sort()
    .filter((field) => canonicalize(left[field] ?? null) !== canonicalize(right[field] ?? null));
}
