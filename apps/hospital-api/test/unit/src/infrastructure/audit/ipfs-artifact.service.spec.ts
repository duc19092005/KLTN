import { IpfsArtifactService } from '../../../../../src/infrastructure/audit/ipfs-artifact.service';

describe('IpfsArtifactService Pinata provider', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('reports ready when PINATA_JWT is configured', () => {
    process.env.IPFS_PROVIDER = 'pinata';
    process.env.PINATA_JWT = 'test-jwt-token';
    delete process.env.IPFS_API_URL;

    const service = new IpfsArtifactService();
    expect(service.isReady()).toBe(true);
  });

  it('uploads through pinFileToIPFS and returns ipfs uri', async () => {
    process.env.IPFS_PROVIDER = 'pinata';
    process.env.PINATA_JWT = 'test-jwt-token';
    process.env.PINATA_API_URL = 'https://api.pinata.cloud';

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ IpfsHash: 'bafytestcid123' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new IpfsArtifactService();
    const result = await service.upload(Buffer.from([1, 2, 3, 4]), 'audit-batch-1.json');

    expect(result).toEqual({ cid: 'bafytestcid123', uri: 'ipfs://bafytestcid123' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer test-jwt-token' },
      }),
    );
  });

  it('downloads through the Pinata gateway', async () => {
    process.env.IPFS_PROVIDER = 'pinata';
    process.env.PINATA_JWT = 'test-jwt-token';
    process.env.PINATA_GATEWAY_URL = 'https://gateway.pinata.cloud';

    const payload = Buffer.from('encrypted-artifact');
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => String(payload.length) },
      arrayBuffer: async () => payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new IpfsArtifactService();
    const bytes = await service.download('ipfs://bafytestcid123');

    expect(Buffer.from(bytes).equals(payload)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://gateway.pinata.cloud/ipfs/bafytestcid123',
      expect.any(Object),
    );
  });
});
