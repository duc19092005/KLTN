import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  computeEntryHashV2,
  computeBeforeHashV2,
  computeAfterHashV2,
  computeDiffHashV2,
  computeDataHashV2,
  GENESIS_PREV_HASH,
  AUDIT_ENTRY_V2,
  canonicalize,
} from '../crypto/audit-hash.util';
import { sanitizeAuditPayload } from '../crypto/audit-sanitizer.util';
import { buildAuditDiff } from '../crypto/audit-diff.util';
import {
  AUDIT_ENCRYPTION_VERSION,
  buildAuditEncryptionAad,
  encryptAuditSnapshot,
} from '../crypto/audit-encryption.util';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'ACCESS' | 'SECURITY';

const FK_FIELD: Record<string, string> = {
  Department: 'departmentId',
  StaffProfile: 'staffProfileId',
  DoctorProfile: 'doctorProfileId',
  Patient: 'patientId',
  AiModelRegistry: 'aiModelRegistryId',
  MedicalConclusion: 'medicalConclusionId',
  Visit: 'visitId',
  MedicalOrder: 'medicalOrderId',
  MedicalResult: 'medicalResultId',
  AiQuality: 'aiQualityId',
};

export interface AuditRecordV2Params {
  entity: string;
  entityId: string;
  action: AuditAction | string;
  actorId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  onChainStatus?: string;
  txHash?: string | null;
  blockNumber?: number | null;
  metadata?: unknown;
}

export function buildAuditRecordV2Data(
  params: AuditRecordV2Params,
  tail: { seq: number | null; entryHash: string | null } | null,
  highWater: number,
): Prisma.BlockchainLoggerUncheckedCreateInput {
  if (tail == null && highWater > 0) {
    throw new Error(`AUDIT_CHAIN_RECOVERY_REQUIRED: local audit history is empty but blockchain is anchored through seq ${highWater}.`);
  }
  if ((tail?.seq ?? 0) < highWater) {
    throw new Error(`AUDIT_CHAIN_RECOVERY_REQUIRED: local chain ends at seq ${tail?.seq ?? 0}, below anchored seq ${highWater}.`);
  }
  const seq = Math.max(tail?.seq ?? 0, highWater) + 1;
  const eventId = randomUUID();
  const prevHash = tail?.entryHash ?? GENESIS_PREV_HASH;
  const createdAt = new Date();
  const createdAtIso = createdAt.toISOString();
  const rawBefore = params.before ?? null;
  const rawAfter = params.after ?? null;
  const diffJson = buildAuditDiff(params.before ?? null, params.after ?? null);
  const fieldsChanged = diffJson.fieldsChanged;

  const beforeHash = computeBeforeHashV2(params.entity, params.entityId, rawBefore);
  const afterHash = computeAfterHashV2(params.entity, params.entityId, rawAfter);
  const diffHash = computeDiffHashV2(diffJson);
  const dataHash = computeDataHashV2({
    entity: params.entity,
    entityId: params.entityId,
    action: params.action,
    beforeHash,
    afterHash,
    diffHash,
    fieldsChanged,
  });
  const entryHash = computeEntryHashV2({
    seq,
    prevHash,
    entity: params.entity,
    entityId: params.entityId,
    action: params.action,
    actorId: params.actorId ?? null,
    beforeHash,
    afterHash,
    diffHash,
    dataHash,
    createdAtIso,
  });
  const aad = buildAuditEncryptionAad({
    seq,
    entity: params.entity,
    entityId: params.entityId,
    action: params.action,
    createdAtIso,
  });
  const beforeEncrypted = encryptAuditSnapshot(canonicalize(rawBefore), aad);
  const afterEncrypted = encryptAuditSnapshot(canonicalize(rawAfter), aad);

  const fkField = FK_FIELD[params.entity];
  const data: Record<string, any> = {
    entity: params.entity,
    eventId,
    entityId: params.entityId,
    action: params.action,
    actorId: params.actorId ?? null,
    dataHash,
    dataSalt: null,
    beforeJson: sanitizeAuditPayload(params.entity, rawBefore) as any,
    afterJson: sanitizeAuditPayload(params.entity, rawAfter) as any,
    beforeHash,
    afterHash,
    diffHash,
    hashVersion: AUDIT_ENTRY_V2,
    beforeEncrypted: beforeEncrypted as any,
    afterEncrypted: afterEncrypted as any,
    encryptionVersion: AUDIT_ENCRYPTION_VERSION,
    encryptionKeyId: beforeEncrypted.keyId,
    diffJson: diffJson as any,
    fieldsChanged: fieldsChanged as any,
    onChainStatus: params.onChainStatus ?? 'PENDING',
    txHash: params.txHash ?? null,
    blockNumber: params.blockNumber ?? null,
    metadata: sanitizeAuditPayload(params.entity, params.metadata) as any,
    seq,
    prevHash,
    entryHash,
    createdAt,
  };
  if (fkField) data[fkField] = params.entityId;

  return data as Prisma.BlockchainLoggerUncheckedCreateInput;
}