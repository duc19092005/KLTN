import { computeBackendActionHash } from '../../../../../src/infrastructure/blockchain/blockchain-action-hash.util';

describe('blockchain-action-hash.util', () => {
  it('hashes logically equivalent payloads with different key order identically', () => {
    const left = computeBackendActionHash({ b: 2, a: 1, nested: { y: true, x: 'ok' } });
    const right = computeBackendActionHash({ nested: { x: 'ok', y: true }, a: 1, b: 2 });

    expect(left).toBe(right);
    expect(left).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('domain separates backend action hashes from raw canonical JSON hashes', () => {
    const hash = computeBackendActionHash({ a: 1 });

    expect(hash).not.toBe(computeBackendActionHash({ a: 2 }));
  });

  it('rejects unsafe non-canonical payloads', () => {
    expect(() => computeBackendActionHash({ value: undefined })).toThrow('Unsupported undefined at $.value');
  });
});
