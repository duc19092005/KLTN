import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { canonicalize } from './audit-hash.util';

export const AUDIT_ENCRYPTION_ALG = 'AES-256-GCM';
export const AUDIT_ENCRYPTION_VERSION = 'AUDIT_AES_256_GCM_V1';
export const AUDIT_ENCRYPTION_AAD_V1 = 'KLTN_AUDIT_ENCRYPTION_AAD_V1';

const HEX_32_BYTES = /^[0-9a-f]{64}$/i;
const KEY_ID_PATTERN = /^[a-zA-Z0-9._:-]{3,80}$/;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const INSECURE_DEV_ENCRYPTION_KEY = '0'.repeat(64);
const INSECURE_DEV_KEY_ID = 'local-dev-insecure-audit-key';

function allowInsecureAuditCrypto(): boolean {
  return process.env.ALLOW_INSECURE_AUDIT_CRYPTO === 'true' && process.env.NODE_ENV !== 'production';
}

export interface AuditEncryptionAadInput {
  seq: number;
  entity: string;
  entityId?: string | null;
  action: string;
  createdAtIso: string;
}

export interface EncryptedAuditSnapshot {
  alg: typeof AUDIT_ENCRYPTION_ALG;
  keyId: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

export function getAuditEncryptionKeyHex(): string {
  const key = process.env.AUDIT_ENCRYPTION_KEY || '';
  if (!key) {
    if (allowInsecureAuditCrypto()) return INSECURE_DEV_ENCRYPTION_KEY;
    throw new Error('AUDIT_ENCRYPTION_KEY is required for Blockchain Audit V2. Set ALLOW_INSECURE_AUDIT_CRYPTO=true only for local dev/CI fallback.');
  }
  if (!HEX_32_BYTES.test(key)) {
    throw new Error('AUDIT_ENCRYPTION_KEY must be a 32-byte hex string');
  }
  return key.toLowerCase();
}

export function getAuditEncryptionKey(): Buffer {
  return Buffer.from(getAuditEncryptionKeyHex(), 'hex');
}

export function getAuditEncryptionKeyId(): string {
  const keyId = process.env.AUDIT_ENCRYPTION_KEY_ID || (allowInsecureAuditCrypto() ? INSECURE_DEV_KEY_ID : '');
  if (!keyId) throw new Error('AUDIT_ENCRYPTION_KEY_ID is required for Blockchain Audit V2');
  if (!KEY_ID_PATTERN.test(keyId)) throw new Error('AUDIT_ENCRYPTION_KEY_ID must be 3-80 safe identifier characters');
  return keyId;
}

export function buildAuditEncryptionAad(input: AuditEncryptionAadInput): string {
  return canonicalize({
    schema: AUDIT_ENCRYPTION_AAD_V1,
    seq: input.seq,
    entity: input.entity,
    entityId: input.entityId ?? null,
    action: input.action,
    createdAtIso: input.createdAtIso,
  });
}

export function encryptAuditSnapshot(
  canonicalPlaintext: string,
  aad: string,
  key = getAuditEncryptionKey(),
  keyId = getAuditEncryptionKeyId(),
): EncryptedAuditSnapshot {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: AUTH_TAG_BYTES });
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(canonicalPlaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    alg: AUDIT_ENCRYPTION_ALG,
    keyId,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

export function decryptAuditSnapshot(
  encrypted: EncryptedAuditSnapshot,
  aad: string,
  key = getAuditEncryptionKey(),
): string {
  if (encrypted.alg !== AUDIT_ENCRYPTION_ALG) {
    throw new Error(`Unsupported audit encryption algorithm: ${encrypted.alg}`);
  }

  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(encrypted.iv, 'base64'), {
    authTagLength: AUTH_TAG_BYTES,
  });
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
