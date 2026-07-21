import { AuditRecoveryCryptoService } from '../../../../../src/infrastructure/audit/audit-recovery-crypto.service';

describe('AuditRecoveryCryptoService', () => {
  const originalKey = process.env.AUDIT_RECOVERY_ENCRYPTION_KEY;
  const originalKeyId = process.env.AUDIT_RECOVERY_ENCRYPTION_KEY_ID;

  beforeEach(() => {
    process.env.AUDIT_RECOVERY_ENCRYPTION_KEY = '44'.repeat(32);
    process.env.AUDIT_RECOVERY_ENCRYPTION_KEY_ID = 'recovery-test-v1';
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.AUDIT_RECOVERY_ENCRYPTION_KEY;
    else process.env.AUDIT_RECOVERY_ENCRYPTION_KEY = originalKey;
    if (originalKeyId === undefined) delete process.env.AUDIT_RECOVERY_ENCRYPTION_KEY_ID;
    else process.env.AUDIT_RECOVERY_ENCRYPTION_KEY_ID = originalKeyId;
  });

  it('encrypts one bundle with a locally wrapped per-batch DEK and decrypts it', async () => {
    const service = new AuditRecoveryCryptoService();
    const plaintext = Buffer.from('{"patient":"must-not-leak"}', 'utf8');

    const encrypted = await service.encrypt(plaintext, 10);

    expect(encrypted.artifactHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(encrypted.bytes.toString('utf8')).not.toContain('must-not-leak');
    await expect(service.decrypt(encrypted.bytes, 10)).resolves.toEqual(plaintext);
    await expect(service.decrypt(encrypted.bytes, 11)).rejects.toThrow('AAD');
  });

  it('rejects a tampered encrypted artifact', async () => {
    const service = new AuditRecoveryCryptoService();
    const encrypted = await service.encrypt(Buffer.from('trusted'), 2);
    const parsed = JSON.parse(encrypted.bytes.toString('utf8'));
    parsed.ciphertext = parsed.ciphertext.slice(0, -2) + 'AA';

    await expect(service.decrypt(Buffer.from(JSON.stringify(parsed)), 2)).rejects.toThrow();
  });

  it('accepts the same local recovery key in production', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const service = new AuditRecoveryCryptoService();
      expect(() => service.assertReady()).not.toThrow();
      const plaintext = Buffer.from('production recovery payload');
      const encrypted = await service.encrypt(plaintext, 19);
      await expect(service.decrypt(encrypted.bytes, 19)).resolves.toEqual(plaintext);
    } finally {
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('rejects malformed local key material', () => {
    process.env.AUDIT_RECOVERY_ENCRYPTION_KEY = 'not-a-32-byte-hex-key';

    expect(() => new AuditRecoveryCryptoService().assertReady()).toThrow(
      'AUDIT_RECOVERY_ENCRYPTION_KEY must be a 32-byte hex string',
    );
  });
});