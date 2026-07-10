import { Injectable } from '@nestjs/common';

@Injectable()
export class IpfsArtifactService {
  isReady(): boolean {
    return Boolean(process.env.IPFS_API_URL);
  }

  async upload(bytes: Buffer, fileName: string): Promise<{ cid: string; uri: string }> {
    const primaryCid = await this.add(this.requiredApiUrl('IPFS_API_URL'), bytes, fileName);
    const secondary = process.env.IPFS_SECONDARY_API_URL?.trim();
    if (secondary) {
      const secondaryCid = await this.add(secondary, bytes, fileName);
      if (secondaryCid !== primaryCid) throw new Error('Secondary IPFS pin returned a different CID.');
    }
    return { cid: primaryCid, uri: `ipfs://${primaryCid}` };
  }

  async download(uri: string): Promise<Buffer> {
    const cid = this.cidFromUri(uri);
    const gateway = process.env.IPFS_GATEWAY_URL?.trim().replace(/\/$/, '');
    const apiUrl = this.requiredApiUrl('IPFS_API_URL');
    const response = gateway
      ? await fetch(`${gateway}/ipfs/${encodeURIComponent(cid)}`, { headers: this.authHeaders('IPFS_GATEWAY_AUTHORIZATION') })
      : await fetch(`${apiUrl}/api/v0/cat?arg=${encodeURIComponent(cid)}`, {
          method: 'POST',
          headers: this.authHeaders('IPFS_API_AUTHORIZATION'),
        });
    if (!response.ok) throw new Error(`IPFS cat failed with HTTP ${response.status}.`);
    const maxBytes = Number(process.env.AUDIT_RECOVERY_MAX_ARTIFACT_BYTES ?? 25 * 1024 * 1024);
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

  private async add(apiUrl: string, bytes: Buffer, fileName: string): Promise<string> {
    const form = new FormData();
    form.append('file', new Blob([bytes.toString('utf8')], { type: 'application/json' }), fileName);
    const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/v0/add?pin=true&cid-version=1`, {
      method: 'POST',
      headers: this.authHeaders(apiUrl === process.env.IPFS_SECONDARY_API_URL?.trim() ? 'IPFS_SECONDARY_API_AUTHORIZATION' : 'IPFS_API_AUTHORIZATION'),
      body: form,
    });
    if (!response.ok) throw new Error(`IPFS add failed with HTTP ${response.status}.`);
    const text = await response.text();
    const lastLine = text.trim().split(/\r?\n/).at(-1);
    const parsed = lastLine ? JSON.parse(lastLine) as { Hash?: unknown } : null;
    if (!parsed || typeof parsed.Hash !== 'string') throw new Error('IPFS add response is missing CID.');
    return parsed.Hash;
  }

  private requiredApiUrl(name: string): string {
    const value = process.env[name]?.trim().replace(/\/$/, '');
    if (!value) throw new Error(`${name} is required for audit recovery artifacts.`);
    return value;
  }

  private authHeaders(name: string): HeadersInit {
    const authorization = process.env[name]?.trim();
    return authorization ? { authorization } : {};
  }
}
