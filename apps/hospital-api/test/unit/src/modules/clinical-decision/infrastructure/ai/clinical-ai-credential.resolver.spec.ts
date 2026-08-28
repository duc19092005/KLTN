import { createCipheriv, randomBytes } from 'crypto';
import { ClinicalAiCredentialResolver } from '../../../../../../../src/modules/clinical-decision/infrastructure/ai/clinical-ai-credential.resolver';

describe('ClinicalAiCredentialResolver', () => {
  const original = process.env.ENCRYPTION_KEY;
  const resolver = new ClinicalAiCredentialResolver();

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'ab'.repeat(32);
  });

  afterAll(() => {
    if (original === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = original;
  });

  it('decrypts the existing v1 AES-256-GCM credential format', () => {
    const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update('provider-secret', 'utf8'), cipher.final()]);
    const encrypted = `v1:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${ciphertext.toString('hex')}`;

    expect(resolver.decrypt(encrypted)).toBe('provider-secret');
  });

  it('rejects malformed credential formats before a provider is called', () => {
    expect(() => resolver.decrypt('legacy-secret')).toThrow('định dạng cũ');
  });
});