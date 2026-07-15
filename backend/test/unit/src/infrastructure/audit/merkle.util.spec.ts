import {
  MERKLE_SHA256_BYTES32_V2,
  buildMerkleProof,
  buildMerkleProofForAlgorithm,
  buildMerkleProofV2,
  computeMerkleRoot,
  computeMerkleRootForAlgorithm,
  computeMerkleRootV2,
  hashLeaf,
  rootToBytes32,
  verifyMerkleProof,
  verifyMerkleProofForAlgorithm,
  verifyMerkleProofV2,
} from '../../../../../src/infrastructure/audit/merkle.util';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const C = 'c'.repeat(64);
const D = 'd'.repeat(64);

describe('merkle.util v1', () => {
  it('computes a deterministic root for the same leaves', () => {
    const leaves = [A, B, C, D];

    expect(computeMerkleRoot(leaves)).toBe(computeMerkleRoot([...leaves]));
  });

  it('returns the documented zero root for an empty tree', () => {
    expect(computeMerkleRoot([])).toBe('0'.repeat(64));
  });

  it('builds an empty proof for a single leaf and verifies it', () => {
    const root = computeMerkleRoot([A]);
    const proof = buildMerkleProof([A], 0);

    expect(proof).toEqual([]);
    expect(verifyMerkleProof(A, proof, root)).toBe(true);
  });

  it('verifies every leaf in an odd-sized tree using duplicate-last hashing', () => {
    const leaves = [A, B, C];
    const root = computeMerkleRoot(leaves);

    leaves.forEach((leaf, index) => {
      expect(verifyMerkleProof(leaf, buildMerkleProof(leaves, index), root)).toBe(true);
    });
  });

  it('handles duplicate leaves', () => {
    const leaves = [A, A, B];
    const root = computeMerkleRoot(leaves);

    expect(verifyMerkleProof(A, buildMerkleProof(leaves, 0), root)).toBe(true);
    expect(verifyMerkleProof(A, buildMerkleProof(leaves, 1), root)).toBe(true);
  });

  it('rejects a tampered leaf', () => {
    const leaves = [A, B, C];
    const root = computeMerkleRoot(leaves);

    expect(verifyMerkleProof(D, buildMerkleProof(leaves, 1), root)).toBe(false);
  });

  it('rejects a tampered proof', () => {
    const leaves = [A, B, C];
    const root = computeMerkleRoot(leaves);
    const proof = buildMerkleProof(leaves, 1);
    proof[0] = hashLeaf(D);

    expect(verifyMerkleProof(B, proof, root)).toBe(false);
  });

  it('rejects a wrong root', () => {
    const leaves = [A, B, C];

    expect(verifyMerkleProof(B, buildMerkleProof(leaves, 1), D)).toBe(false);
  });

  it('normalizes 0x-prefixed and uppercase hex inputs', () => {
    const lowerRoot = computeMerkleRoot([A, B]);
    const prefixedUpperRoot = computeMerkleRoot([`0x${A.toUpperCase()}`, `0x${B.toUpperCase()}`]);

    expect(prefixedUpperRoot).toBe(lowerRoot);
    expect(rootToBytes32(lowerRoot)).toBe(`0x${lowerRoot}`);
  });

  it('rejects invalid entry hashes, proof nodes, and roots', () => {
    expect(() => computeMerkleRoot(['not-hex'])).toThrow('Merkle entryHash[0] must be a 32-byte hex string');
    expect(() => buildMerkleProof([A], 2)).toThrow('Merkle proof index out of range');
    expect(() => verifyMerkleProof(A, ['not-hex'], computeMerkleRoot([A]))).toThrow(
      'Merkle proof[0] must be a 32-byte hex string',
    );
    expect(() => verifyMerkleProof(A, [], 'not-hex')).toThrow('Merkle root must be a 32-byte hex string');
    expect(() => rootToBytes32('abc')).toThrow('Merkle root must be a 32-byte hex string');
  });
});

describe('merkle.util v2', () => {
  it('computes a different root than v1 because v2 hashes raw bytes32 with domains', () => {
    const leaves = [A, B, C];

    expect(computeMerkleRootV2(leaves)).not.toBe(computeMerkleRoot(leaves));
    expect(computeMerkleRootV2(leaves)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('throws for empty v2 batches', () => {
    expect(() => computeMerkleRootV2([])).toThrow('Cannot compute a Merkle root for an empty batch');
  });

  it('builds and verifies v2 proofs', () => {
    const leaves = [A, B, C, D];
    const root = computeMerkleRootV2(leaves);

    leaves.forEach((leaf, index) => {
      expect(verifyMerkleProofV2(leaf, buildMerkleProofV2(leaves, index), root)).toBe(true);
    });
  });

  it('dispatches by algorithm version', () => {
    const leaves = [A, B, C];
    const root = computeMerkleRootForAlgorithm(leaves, MERKLE_SHA256_BYTES32_V2);
    const proof = buildMerkleProofForAlgorithm(leaves, 1, MERKLE_SHA256_BYTES32_V2);

    expect(verifyMerkleProofForAlgorithm(B, proof, root, MERKLE_SHA256_BYTES32_V2)).toBe(true);
  });

  it('matches the canonical MERKLE_SHA256_BYTES32_V2 root/proof values', () => {
    const entries = [A, B, C];
    const expectedRoot = '5f591b089c3b297deae0b31b1aeff9527c3c576102d1c7806044a4bd8bf46816';
    const expectedProofForB = [
      'cdd4aae47c338bb7c8284f7d92aafebf4577f3c6de8c507d26733f2ddbee4d02',
      '87e53ac47db516100ef13899fbc51614fc15a0594fd8f5dc91b478f28a97975f',
    ];

    const root = computeMerkleRootForAlgorithm(entries, MERKLE_SHA256_BYTES32_V2);
    const proof = buildMerkleProofForAlgorithm(entries, 1, MERKLE_SHA256_BYTES32_V2);

    expect(root).toBe(expectedRoot);
    expect(proof).toEqual(expectedProofForB);
    expect(verifyMerkleProofForAlgorithm(B, proof, root, MERKLE_SHA256_BYTES32_V2)).toBe(true);
  });
});
