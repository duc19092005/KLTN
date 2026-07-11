import { Injectable, Logger } from '@nestjs/common';

type IpfsProvider = 'kubo' | 'pinata';

/**
 * Uploads/downloads encrypted audit recovery artifacts.
 *
 * Providers:
 *  - kubo:   local/self-hosted IPFS HTTP API (/api/v0/add, /api/v0/cat)
 *  - pinata: Pinata pinning API (pinFileToIPFS) + gateway download
 *
 * Select via IPFS_PROVIDER=kubo|pinata (default: auto — pinata if PINATA_JWT or
 * pinata.cloud URL is configured, otherwise kubo when IPFS_API_URL is set).
 */
@Injectable()
export class IpfsArtifactService {
  private readonly logger = new Logger(IpfsArtifactService.name);

  isReady(): boolean {
    const provider = this.resolveProvider();
    if (provider === 'pinata') return Boolean(this.pinataJwt());
    return Boolean(process.env.IPFS_API_URL?.trim());
  }

  async upload(bytes: Buffer, fileName: string): Promise<{ cid: string; uri: string }> {
    const provider = this.requireProvider();
    const primaryCid =
      provider === 'pinata'
        ? await this.pinataAdd(bytes, fileName)
        : await this.kuboAdd(this.requiredApiUrl('IPFS_API_URL'), bytes, fileName, 'IPFS_API_AUTHORIZATION');

    const secondary = process.env.IPFS_SECONDARY_API_URL?.trim();
    if (secondary) {
      // Secondary remains Kubo-compatible (optional dual-pin). Skip for pure Pinata setups.
      if (this.isPinataUrl(secondary)) {
        this.logger.warn('IPFS_SECONDARY_API_URL points at Pinata; dual-pin secondary is only supported for Kubo APIs.');
      } else {
        const secondaryCid = await this.kuboAdd(secondary, bytes, fileName, 'IPFS_SECONDARY_API_AUTHORIZATION');
        if (secondaryCid !== primaryCid) throw new Error('Secondary IPFS pin returned a different CID.');
      }
    }

    return { cid: primaryCid, uri: `ipfs://${primaryCid}` };
  }

  async download(uri: string): Promise<Buffer> {
    const cid = this.cidFromUri(uri);
    const provider = this.requireProvider();
    const maxBytes = Number(process.env.AUDIT_RECOVERY_MAX_ARTIFACT_BYTES ?? 25 * 1024 * 1024);

    let response: Response;
    if (provider === 'pinata') {
      const gateway = this.pinataGatewayUrl();
      response = await fetch(`${gateway}/ipfs/${encodeURIComponent(cid)}`, {
        headers: this.authHeadersFromValue(process.env.IPFS_GATEWAY_AUTHORIZATION || process.env.PINATA_GATEWAY_AUTHORIZATION),
      });
    } else {
      const gateway = process.env.IPFS_GATEWAY_URL?.trim().replace(/\/$/, '');
      const apiUrl = this.requiredApiUrl('IPFS_API_URL');
      response = gateway
        ? await fetch(`${gateway}/ipfs/${encodeURIComponent(cid)}`, {
            headers: this.authHeadersFromValue(process.env.IPFS_GATEWAY_AUTHORIZATION),
          })
        : await fetch(`${apiUrl}/api/v0/cat?arg=${encodeURIComponent(cid)}`, {
            method: 'POST',
            headers: this.authHeadersFromValue(process.env.IPFS_API_AUTHORIZATION),
          });
    }

    if (!response.ok) throw new Error(`IPFS download failed with HTTP ${response.status}.`);
    const declaredLength = Number(response.headers.get('content-length') ?? 0);
    if (declaredLength > maxBytes) throw new Error('IPFS recovery artifact exceeds configured limit.');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maxBytes) throw new Error('IPFS recovery artifact exceeds configured limit.');
    return bytes;
  }

  cidFromUri(uri: string): string {
    if (!/^ipfs:\/\/[a-zA-Z0-9]+$/.test(uri)) throw new Error('Invalid IPFS artifact URI.');
    return uri.slice('ipfs://'.length);
  }

  private resolveProvider(): IpfsProvider | null {
    const explicit = (process.env.IPFS_PROVIDER || '').trim().toLowerCase();
    if (explicit === 'pinata' || explicit === 'kubo') return explicit;

    if (this.pinataJwt() || this.isPinataUrl(process.env.IPFS_API_URL) || this.isPinataUrl(process.env.PINATA_API_URL)) {
      return 'pinata';
    }
    if (process.env.IPFS_API_URL?.trim()) return 'kubo';
    return null;
  }

  private requireProvider(): IpfsProvider {
    const provider = this.resolveProvider();
    if (!provider) {
      throw new Error('IPFS is not configured. Set IPFS_PROVIDER=pinata with PINATA_JWT, or IPFS_API_URL for local Kubo.');
    }
    if (provider === 'pinata' && !this.pinataJwt()) {
      throw new Error('PINATA_JWT (or IPFS_API_AUTHORIZATION=Bearer <jwt>) is required for Pinata.');
    }
    return provider;
  }

  private pinataJwt(): string | null {
    const dedicated = process.env.PINATA_JWT?.trim();
    if (dedicated) return dedicated.replace(/^Bearer\s+/i, '');

    const auth = process.env.IPFS_API_AUTHORIZATION?.trim();
    if (auth) {
      const jwt = auth.replace(/^Bearer\s+/i, '').trim();
      if (jwt) return jwt;
    }
    return null;
  }

  private pinataApiUrl(): string {
    return (process.env.PINATA_API_URL || process.env.IPFS_API_URL || 'https://api.pinata.cloud')
      .trim()
      .replace(/\/$/, '');
  }

  private pinataGatewayUrl(): string {
    return (process.env.PINATA_GATEWAY_URL || process.env.IPFS_GATEWAY_URL || 'https://gateway.pinata.cloud')
      .trim()
      .replace(/\/$/, '');
  }

  private isPinataUrl(value?: string | null): boolean {
    if (!value) return false;
    try {
      const host = new URL(value.includes('://') ? value : `https://${value}`).hostname.toLowerCase();
      return host.includes('pinata.cloud');
    } catch {
      return value.toLowerCase().includes('pinata');
    }
  }

  private async pinataAdd(bytes: Buffer, fileName: string): Promise<string> {
    const jwt = this.pinataJwt();
    if (!jwt) throw new Error('PINATA_JWT is required.');

    const form = new FormData();
    // Encrypted artifacts are binary — never stringify as utf8.
    form.append('file', new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' }), fileName);
    form.append(
      'pinataMetadata',
      JSON.stringify({
        name: fileName,
        keyvalues: { app: 'kltn', purpose: 'audit-recovery' },
      }),
    );
    form.append(
      'pinataOptions',
      JSON.stringify({
        cidVersion: 1,
      }),
    );

    const response = await fetch(`${this.pinataApiUrl()}/pinning/pinFileToIPFS`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
      body: form,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Pinata pinFileToIPFS failed with HTTP ${response.status}: ${body.slice(0, 300)}`);
    }

    const parsed = (await response.json()) as { IpfsHash?: unknown; cid?: unknown };
    const cid = typeof parsed.IpfsHash === 'string' ? parsed.IpfsHash : typeof parsed.cid === 'string' ? parsed.cid : null;
    if (!cid) throw new Error('Pinata response is missing IpfsHash.');
    return cid;
  }

  private async kuboAdd(apiUrl: string, bytes: Buffer, fileName: string, authEnv: string): Promise<string> {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' }), fileName);
    const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/v0/add?pin=true&cid-version=1`, {
      method: 'POST',
      headers: this.authHeadersFromValue(process.env[authEnv]),
      body: form,
    });
    if (!response.ok) throw new Error(`IPFS add failed with HTTP ${response.status}.`);
    const text = await response.text();
    const lastLine = text.trim().split(/\r?\n/).at(-1);
    const parsed = lastLine ? (JSON.parse(lastLine) as { Hash?: unknown }) : null;
    if (!parsed || typeof parsed.Hash !== 'string') throw new Error('IPFS add response is missing CID.');
    return parsed.Hash;
  }

  private requiredApiUrl(name: string): string {
    const value = process.env[name]?.trim().replace(/\/$/, '');
    if (!value) throw new Error(`${name} is required for audit recovery artifacts.`);
    return value;
  }

  private authHeadersFromValue(authorization?: string | null): HeadersInit {
    const value = authorization?.trim();
    if (!value) return {};
    if (/^Bearer\s+/i.test(value) || /^Basic\s+/i.test(value)) return { authorization: value };
    return { authorization: `Bearer ${value}` };
  }
}
