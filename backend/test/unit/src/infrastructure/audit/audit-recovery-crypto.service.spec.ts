import { AuditRecoveryCryptoService } from '../../../../../src/infrastructure/audit/audit-recovery-crypto.service';

describe('AuditRecoveryCryptoService', () => {
  const originalProvider = process.env.AUDIT_RECOVERY_KEY_PROVIDER;
  const originalKey = process.env.AUDIT_RECOVERY_ENCRYPTION_KEY;
  const originalKeyId = process.env.AUDIT_RECOVERY_ENCRYPTION_KEY_ID;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.AUDIT_RECOVERY_KEY_PROVIDER = 'local';
    process.env.AUDIT_RECOVERY_ENCRYPTION_KEY = '44'.repeat(32);
    process.env.AUDIT_RECOVERY_ENCRYPTION_KEY_ID = 'recovery-test-v1';
  });

  afterAll(() => {
    if (originalProvider === undefined) delete process.env.AUDIT_RECOVERY_KEY_PROVIDER;
    else process.env.AUDIT_RECOVERY_KEY_PROVIDER = originalProvider;
    if (originalKey === undefined) delete process.env.AUDIT_RECOVERY_ENCRYPTION_KEY;
    else process.env.AUDIT_RECOVERY_ENCRYPTION_KEY = originalKey;
    if (originalKeyId === undefined) delete process.env.AUDIT_RECOVERY_ENCRYPTION_KEY_ID;
    else process.env.AUDIT_RECOVERY_ENCRYPTION_KEY_ID = originalKeyId;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it('encrypts one bundle with a wrapped per-batch DEK and decrypts it', async () => {
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
    parsed.ciphertext = `${parsed.ciphertext.slice(0, -2)}AA`;

    await expect(service.decrypt(Buffer.from(JSON.stringify(parsed)), 2)).rejects.toThrow();
  });

  it('rejects local wrapping in production before a batch is prepared', () => {
    process.env.NODE_ENV = 'production';
    process.env.AUDIT_RECOVERY_KEY_PROVIDER = 'local';

    expect(() => new AuditRecoveryCryptoService().assertReady()).toThrow(
      'Local audit recovery wrapping key is forbidden in production',
    );
  });

  it('requires complete Vault configuration in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.AUDIT_RECOVERY_KEY_PROVIDER = 'vault';
    delete process.env.VAULT_ADDR;
    delete process.env.VAULT_TOKEN;
    delete process.env.VAULT_AUDIT_TRANSIT_KEY;

    expect(() => new AuditRecoveryCryptoService().assertReady()).toThrow('VAULT_ADDR is required');
  });

  it('round-trips a bundle through mocked Vault Transit envelope wrapping', async () => {
    process.env.NODE_ENV = 'production';
    process.env.AUDIT_RECOVERY_KEY_PROVIDER = 'vault';
    process.env.VAULT_ADDR = 'http://vault:8200';
    process.env.VAULT_TOKEN = 'test-token-must-not-appear';
    process.env.VAULT_AUDIT_TRANSIT_KEY = 'kltn-audit-recovery';
    const wrappedDeks = new Map<string, string>();
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { plaintext?: string; ciphertext?: string };
      if (body.plaintext) {
        const ciphertext = `vault:v1:${Buffer.from(body.plaintext).toString('base64')}`;
        wrappedDeks.set(ciphertext, body.plaintext);
        return new Response(JSON.stringify({ data: { ciphertext } }), { status: 200 });
      }
      const plaintext = body.ciphertext ? wrappedDeks.get(body.ciphertext) : undefined;
      return new Response(JSON.stringify({ data: { plaintext } }), { status: 200 });
    });

    try {
      const service = new AuditRecoveryCryptoService();
      expect(() => service.assertReady()).not.toThrow();
      const plaintext = Buffer.from('production recovery payload');
      const encrypted = await service.encrypt(plaintext, 7);
      await expect(service.decrypt(encrypted.bytes, 7)).resolves.toEqual(plaintext);
    } finally {
      fetchMock.mockRestore();
      delete process.env.VAULT_ADDR;
      delete process.env.VAULT_TOKEN;
      delete process.env.VAULT_AUDIT_TRANSIT_KEY;
    }
  });
});
