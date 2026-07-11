import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ARTIFACT_SCHEMA = 'KLTN_AUDIT_RECOVERY_ENCRYPTED_BUNDLE_V1';
const ALG = 'AES-256-GCM';
const IV_BYTES = 12;

interface LocalWrappedDek {
  provider: 'local';
  keyId: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

interface VaultWrappedDek {
  provider: 'vault';
  keyId: string;
  ciphertext: string;
}

type WrappedDek = LocalWrappedDek | VaultWrappedDek;

export interface EncryptedRecoveryArtifact {
  schema: typeof ARTIFACT_SCHEMA;
  alg: typeof ALG;
  keyId: string;
  aad: string;
  iv: string;
  tag: string;
  ciphertext: string;
  wrappedDek: WrappedDek;
}

@Injectable()
export class AuditRecoveryCryptoService {
  async encrypt(plaintext: Buffer, batchId: number): Promise<{ bytes: Buffer; artifactHash: string; keyId: string }> {
    const dek = randomBytes(32);
    const iv = randomBytes(IV_BYTES);
    const aad = `KLTN_AUDIT_RECOVERY_BUNDLE_V1|${batchId}`;
    const cipher = createCipheriv('aes-256-gcm', dek, iv);
    cipher.setAAD(Buffer.from(aad, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    const wrappedDek = await this.wrapDek(dek);
    dek.fill(0);

    const artifact: EncryptedRecoveryArtifact = {
      schema: ARTIFACT_SCHEMA,
      alg: ALG,
      keyId: wrappedDek.keyId,
      aad,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
      wrappedDek,
    };
    const bytes = Buffer.from(JSON.stringify(artifact), 'utf8');
    return {
      bytes,
      artifactHash: `0x${createHash('sha256').update(bytes).digest('hex')}`,
      keyId: wrappedDek.keyId,
    };
  }

  async decrypt(bytes: Buffer, expectedBatchId: number): Promise<Buffer> {
    const artifact = this.parse(bytes);
    const expectedAad = `KLTN_AUDIT_RECOVERY_BUNDLE_V1|${expectedBatchId}`;
    if (artifact.aad !== expectedAad) throw new Error('Recovery artifact AAD does not match batch.');

    const dek = await this.unwrapDek(artifact.wrappedDek);
    try {
      const decipher = createDecipheriv('aes-256-gcm', dek, Buffer.from(artifact.iv, 'base64'));
      decipher.setAAD(Buffer.from(artifact.aad, 'utf8'));
      decipher.setAuthTag(Buffer.from(artifact.tag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(artifact.ciphertext, 'base64')),
        decipher.final(),
      ]);
    } finally {
      dek.fill(0);
    }
  }

  hash(bytes: Buffer): string {
    return `0x${createHash('sha256').update(bytes).digest('hex')}`;
  }

  private parse(bytes: Buffer): EncryptedRecoveryArtifact {
    const value = JSON.parse(bytes.toString('utf8')) as Partial<EncryptedRecoveryArtifact>;
    if (value.schema !== ARTIFACT_SCHEMA || value.alg !== ALG || !value.wrappedDek) {
      throw new Error('Unsupported recovery artifact schema.');
    }
    if (!value.aad || !value.iv || !value.tag || !value.ciphertext || !value.keyId) {
      throw new Error('Recovery artifact is incomplete.');
    }
    return value as EncryptedRecoveryArtifact;
  }

  private provider(): 'local' | 'vault' {
    const configured = (process.env.AUDIT_RECOVERY_KEY_PROVIDER ?? 'local').toLowerCase();
    if (configured !== 'local' && configured !== 'vault') {
      throw new Error(`Unsupported AUDIT_RECOVERY_KEY_PROVIDER: ${configured}`);
    }
    if (process.env.NODE_ENV === 'production' && configured === 'local') {
      throw new Error('Local audit recovery wrapping key is forbidden in production; configure Vault.');
    }
    return configured;
  }

  private async wrapDek(dek: Buffer): Promise<WrappedDek> {
    if (this.provider() === 'vault') {
      const keyId = this.requiredEnv('VAULT_AUDIT_TRANSIT_KEY');
      const response = await this.vaultRequest(`encrypt/${encodeURIComponent(keyId)}`, {
        plaintext: dek.toString('base64'),
      });
      const ciphertext = this.readVaultCiphertext(response);
      return { provider: 'vault', keyId, ciphertext };
    }

    const kek = this.localKey();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', kek, iv);
    cipher.setAAD(Buffer.from(ARTIFACT_SCHEMA, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(dek), cipher.final()]);
    return {
      provider: 'local',
      keyId: process.env.AUDIT_RECOVERY_ENCRYPTION_KEY_ID ?? 'audit-recovery-local-v1',
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };
  }

  private async unwrapDek(wrapped: WrappedDek): Promise<Buffer> {
    if (wrapped.provider === 'vault') {
      const response = await this.vaultRequest(`decrypt/${encodeURIComponent(wrapped.keyId)}`, {
        ciphertext: wrapped.ciphertext,
      });
      const plaintext = this.readVaultPlaintext(response);
      const dek = Buffer.from(plaintext, 'base64');
      if (dek.length !== 32) throw new Error('Vault returned an invalid recovery DEK.');
      return dek;
    }

    const decipher = createDecipheriv('aes-256-gcm', this.localKey(), Buffer.from(wrapped.iv, 'base64'));
    decipher.setAAD(Buffer.from(ARTIFACT_SCHEMA, 'utf8'));
    decipher.setAuthTag(Buffer.from(wrapped.tag, 'base64'));
    const dek = Buffer.concat([
      decipher.update(Buffer.from(wrapped.ciphertext, 'base64')),
      decipher.final(),
    ]);
    if (dek.length !== 32) throw new Error('Invalid locally wrapped recovery DEK.');
    return dek;
  }

  private localKey(): Buffer {
    const hex = this.requiredEnv('AUDIT_RECOVERY_ENCRYPTION_KEY');
    if (!/^[0-9a-f]{64}$/i.test(hex)) {
      throw new Error('AUDIT_RECOVERY_ENCRYPTION_KEY must be a 32-byte hex string.');
    }
    return Buffer.from(hex, 'hex');
  }

  private async vaultRequest(path: string, body: Record<string, string>): Promise<unknown> {
    const address = this.requiredEnv('VAULT_ADDR').replace(/\/$/, '');
    const token = this.requiredEnv('VAULT_TOKEN');
    const mount = (process.env.VAULT_TRANSIT_MOUNT ?? 'transit').replace(/^\/+|\/+$/g, '');
    const response = await fetch(`${address}/v1/${mount}/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-vault-token': token },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Vault Transit request failed with HTTP ${response.status}.`);
    return response.json();
  }

  private readVaultCiphertext(value: unknown): string {
    const ciphertext = (value as { data?: { ciphertext?: unknown } })?.data?.ciphertext;
    if (typeof ciphertext !== 'string') throw new Error('Vault encrypt response is missing ciphertext.');
    return ciphertext;
  }

  private readVaultPlaintext(value: unknown): string {
    const plaintext = (value as { data?: { plaintext?: unknown } })?.data?.plaintext;
    if (typeof plaintext !== 'string') throw new Error('Vault decrypt response is missing plaintext.');
    return plaintext;
  }

  private requiredEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name} is required.`);
    return value;
  }
}
