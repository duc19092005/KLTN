import { randomBytes } from 'crypto';
import { canonicalize } from './audit-hash.util';
import {
  buildAuditEncryptionAad,
  decryptAuditSnapshot,
  encryptAuditSnapshot,
  getAuditEncryptionKey,
  getAuditEncryptionKeyId,
} from './audit-encryption.util';

describe('audit-encryption.util', () => {
  const key = Buffer.from('11'.repeat(32), 'hex');
  const otherKey = Buffer.from('22'.repeat(32), 'hex');
  const aad = buildAuditEncryptionAad({
    seq: 12,
    entity: 'StaffProfile',
    entityId: 'staff-1',
    action: 'UPDATE',
    createdAtIso: '2026-06-10T00:00:00.000Z',
  });
  const plaintext = canonicalize({ fullName: 'abc', avatarUrl: 'https://cdn.example/avatar.png' });

  it('builds deterministic canonical AAD', () => {
    expect(aad).toBe(
      '{"action":"UPDATE","createdAtIso":"2026-06-10T00:00:00.000Z","entity":"StaffProfile","entityId":"staff-1","schema":"KLTN_AUDIT_ENCRYPTION_AAD_V1","seq":12}',
    );
  });

  it('encrypts and decrypts a canonical audit snapshot', () => {
    const encrypted = encryptAuditSnapshot(plaintext, aad, key, 'audit-key-2026-01');

    expect(encrypted).toEqual({
      alg: 'AES-256-GCM',
      keyId: 'audit-key-2026-01',
      iv: expect.any(String),
      tag: expect.any(String),
      ciphertext: expect.any(String),
    });
    expect(encrypted.ciphertext).not.toContain('abc');
    expect(encrypted.ciphertext).not.toContain('cdn.example');
    expect(decryptAuditSnapshot(encrypted, aad, key)).toBe(plaintext);
  });

  it('uses a random IV so equal plaintexts produce different ciphertexts', () => {
    const left = encryptAuditSnapshot(plaintext, aad, key, 'audit-key-2026-01');
    const right = encryptAuditSnapshot(plaintext, aad, key, 'audit-key-2026-01');

    expect(left.iv).not.toBe(right.iv);
    expect(left.ciphertext).not.toBe(right.ciphertext);
    expect(decryptAuditSnapshot(left, aad, key)).toBe(plaintext);
    expect(decryptAuditSnapshot(right, aad, key)).toBe(plaintext);
  });

  it('fails when ciphertext is tampered', () => {
    const encrypted = encryptAuditSnapshot(plaintext, aad, key, 'audit-key-2026-01');
    const tampered = {
      ...encrypted,
      ciphertext: Buffer.concat([Buffer.from(encrypted.ciphertext, 'base64'), randomBytes(1)]).toString('base64'),
    };

    expect(() => decryptAuditSnapshot(tampered, aad, key)).toThrow();
  });

  it('fails when AAD is tampered', () => {
    const encrypted = encryptAuditSnapshot(plaintext, aad, key, 'audit-key-2026-01');
    const wrongAad = buildAuditEncryptionAad({
      seq: 13,
      entity: 'StaffProfile',
      entityId: 'staff-1',
      action: 'UPDATE',
      createdAtIso: '2026-06-10T00:00:00.000Z',
    });

    expect(() => decryptAuditSnapshot(encrypted, wrongAad, key)).toThrow();
  });

  it('fails with the wrong key', () => {
    const encrypted = encryptAuditSnapshot(plaintext, aad, key, 'audit-key-2026-01');

    expect(() => decryptAuditSnapshot(encrypted, aad, otherKey)).toThrow();
  });

  it('requires AUDIT_ENCRYPTION_KEY in production', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalKey = process.env.AUDIT_ENCRYPTION_KEY;
    process.env.NODE_ENV = 'production';
    delete process.env.AUDIT_ENCRYPTION_KEY;

    try {
      expect(() => getAuditEncryptionKey()).toThrow('AUDIT_ENCRYPTION_KEY is required for Blockchain Audit V2');
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalKey === undefined) delete process.env.AUDIT_ENCRYPTION_KEY;
      else process.env.AUDIT_ENCRYPTION_KEY = originalKey;
    }
  });

  it('rejects malformed configured encryption keys', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalKey = process.env.AUDIT_ENCRYPTION_KEY;
    process.env.NODE_ENV = 'development';
    process.env.AUDIT_ENCRYPTION_KEY = 'not-hex';

    try {
      expect(() => getAuditEncryptionKey()).toThrow('AUDIT_ENCRYPTION_KEY must be a 32-byte hex string');
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalKey === undefined) delete process.env.AUDIT_ENCRYPTION_KEY;
      else process.env.AUDIT_ENCRYPTION_KEY = originalKey;
    }
  });
  it('requires explicit opt-in for the local insecure fallback key', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalKey = process.env.AUDIT_ENCRYPTION_KEY;
    const originalAllow = process.env.ALLOW_INSECURE_AUDIT_CRYPTO;
    process.env.NODE_ENV = 'development';
    delete process.env.AUDIT_ENCRYPTION_KEY;
    process.env.ALLOW_INSECURE_AUDIT_CRYPTO = 'true';

    try {
      expect(getAuditEncryptionKey()).toEqual(Buffer.alloc(32, 0));
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalKey === undefined) delete process.env.AUDIT_ENCRYPTION_KEY;
      else process.env.AUDIT_ENCRYPTION_KEY = originalKey;
      if (originalAllow === undefined) delete process.env.ALLOW_INSECURE_AUDIT_CRYPTO;
      else process.env.ALLOW_INSECURE_AUDIT_CRYPTO = originalAllow;
    }
  });

  it('validates configured key ids', () => {
    const originalKeyId = process.env.AUDIT_ENCRYPTION_KEY_ID;
    process.env.AUDIT_ENCRYPTION_KEY_ID = 'bad key id';

    try {
      expect(() => getAuditEncryptionKeyId()).toThrow('AUDIT_ENCRYPTION_KEY_ID must be 3-80 safe identifier characters');
    } finally {
      if (originalKeyId === undefined) delete process.env.AUDIT_ENCRYPTION_KEY_ID;
      else process.env.AUDIT_ENCRYPTION_KEY_ID = originalKeyId;
    }
  });
});
