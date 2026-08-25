const SENSITIVE_KEYS = new Set([
  'fullName',
  'citizenId',
  'identityNumber',
  'phone',
  'address',
  'insuranceNumber',
  'emergencyContact',
  'email',
  'username',
  'dob',
  'dateOfBirth',
  'gender',
  'finalDiagnosis',
  'treatmentPlan',
  'prescription',
  'followUpNote',
  'doctorNote',
  'clinicalNote',
  'note',
  'result',
  'prompt',
  'doctorFeedback',
  'url',
  'secureUrl',
  'downloadUrl',
  'cloudinaryPublicId',
  'bucket',
  'objectKey',
  'etag',
  'sha256',
  'fileName',
  'originalName',
  'avatarUrl',
  'apiEndpoint',
  'password',
  'passwordHash',
  'faceEmbedding',
  'faceHash',
]);

const GLOBAL_SAFE_KEYS = new Set([
  'id',
  'schema',
  'entity',
  'entityId',
  'action',
  'actorId',
  'dataHash',
  'hash256',
  'status',
  'type',
  'role',
  'departmentId',
  'staffProfileId',
  'doctorProfileId',
  'patientId',
  'visitId',
  'orderId',
  'resultId',
  'medicalConclusionId',
  'aiDiagnosisId',
  'aiModelId',
  'aiModelRegistryId',
  'aiQualityId',
  'batchId',
  'seq',
  'prevHash',
  'entryHash',
  'txHash',
  'blockNumber',
  'fieldsChanged',
  'fileCount',
  'mimeTypes',
  'fileSizes',
  'createdAt',
  'updatedAt',
  'createdAtIso',
  'timestamp',
]);

/**
 * Redact audit payloads before they are persisted in BlockchainLogger JSON columns.
 */
export function sanitizeAuditPayload(entity: string, payload: unknown): unknown {
  if (payload == null) return null;
  return sanitizeValue(entity, payload, '$');
}

function sanitizeValue(entity: string, value: unknown, path: string): unknown {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item, index) => sanitizeValue(entity, item, `${path}[${index}]`));

  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') return value;
  if (valueType === 'bigint') return value.toString();
  if (valueType === 'undefined' || valueType === 'function' || valueType === 'symbol') return undefined;

  if (value instanceof Map || value instanceof Set) return '[REDACTED_UNSUPPORTED_STRUCTURE]';

  if (valueType === 'object') {
    return sanitizeObject(entity, value as Record<string, unknown>, path);
  }

  return undefined;
}

function sanitizeObject(entity: string, value: Record<string, unknown>, path: string): Record<string, unknown> {
  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      if (SENSITIVE_KEYS.has(key) || shouldRedactByName(key)) {
        acc[key] = '[REDACTED]';
        return acc;
      }

      if (!GLOBAL_SAFE_KEYS.has(key)) {
        acc[key] = '[REDACTED]';
        return acc;
      }

      const sanitized = sanitizeValue(entity, value[key], `${path}.${key}`);
      if (sanitized !== undefined) acc[key] = sanitized;
      return acc;
    }, {} as Record<string, unknown>);
}

function shouldRedactByName(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    normalized.includes('password') ||
    normalized.includes('secret') ||
    normalized.includes('token') ||
    normalized.includes('embedding') ||
    normalized.includes('diagnosis') ||
    normalized.includes('treatment') ||
    normalized.includes('prescription') ||
    normalized.includes('citizen') ||
    normalized.includes('phone') ||
    normalized.includes('address') ||
    normalized.includes('url') ||
    normalized.includes('filename') ||
    normalized.includes('cloudinary') ||
    normalized.includes('objectkey') ||
    normalized.includes('download') ||
    normalized.includes('email') ||
    normalized.includes('username') ||
    normalized === 'dob' ||
    normalized.includes('dateofbirth') ||
    normalized.includes('identity')
  );
}
