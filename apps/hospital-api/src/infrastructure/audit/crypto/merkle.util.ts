import { createHash } from 'crypto';

/**
 * Merkle tree utilities for batch-anchoring audit logs.
 *
 * V1 is preserved for historical batches.
 * V2 is the Solidity-friendly algorithm for new batches:
 *  - leaf = sha256(DOMAIN_LEAF || bytes32(entryHash))
 *  - node = sha256(DOMAIN_NODE || min(bytes32 a,b) || max(bytes32 a,b))
 */

export const MERKLE_SHA256_STRING_V1 = 'MERKLE_SHA256_STRING_V1';
export const MERKLE_SHA256_BYTES32_V2 = 'MERKLE_SHA256_BYTES32_V2';
export type MerkleAlgorithm = typeof MERKLE_SHA256_STRING_V1 | typeof MERKLE_SHA256_BYTES32_V2;

const ZERO = '0'.repeat(64);
const HEX_32_BYTES = /^[0-9a-f]{64}$/i;
const DOMAIN_LEAF_V2 = Buffer.from('KLTN_AUDIT_LEAF_V2');
const DOMAIN_NODE_V2 = Buffer.from('KLTN_AUDIT_NODE_V2');

function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

function stripHexPrefix(value: string): string {
  return value.startsWith('0x') ? value.slice(2) : value;
}

function normalizeHex32(value: string, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a 32-byte hex string`);
  }
  const clean = stripHexPrefix(value).toLowerCase();
  if (!HEX_32_BYTES.test(clean)) {
    throw new Error(`${label} must be a 32-byte hex string`);
  }
  return clean;
}

function normalizeEntryHashes(entryHashes: string[]): string[] {
  return entryHashes.map((entryHash, index) => normalizeHex32(entryHash, `Merkle entryHash[${index}]`));
}

function bytes32(hex: string): Buffer {
  return Buffer.from(normalizeHex32(hex, 'Merkle bytes32'), 'hex');
}

export function hashLeaf(entryHashHex: string): string {
  return sha256Hex(`leaf:${normalizeHex32(entryHashHex, 'Merkle entryHash')}`);
}

function hashPair(a: string, b: string): string {
  const left = normalizeHex32(a, 'Merkle left node');
  const right = normalizeHex32(b, 'Merkle right node');
  const [lo, hi] = left <= right ? [left, right] : [right, left];
  return sha256Hex(`node:${lo}${hi}`);
}

export function hashLeafV2(entryHashHex: string): string {
  return sha256Hex(Buffer.concat([DOMAIN_LEAF_V2, bytes32(entryHashHex)]));
}

function hashPairV2(a: string, b: string): string {
  const left = normalizeHex32(a, 'Merkle left node');
  const right = normalizeHex32(b, 'Merkle right node');
  const [lo, hi] = left <= right ? [left, right] : [right, left];
  return sha256Hex(Buffer.concat([DOMAIN_NODE_V2, bytes32(lo), bytes32(hi)]));
}

function computeMerkleRootWith(entryHashes: string[], leafHasher: (leaf: string) => string, pairHasher: (a: string, b: string) => string, allowEmpty: boolean): string {
  if (entryHashes.length === 0) {
    if (allowEmpty) return ZERO;
    throw new Error('Cannot compute a Merkle root for an empty batch');
  }
  let level = normalizeEntryHashes(entryHashes).map(leafHasher);
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : level[i];
      next.push(pairHasher(left, right));
    }
    level = next;
  }
  return level[0];
}

function buildMerkleProofWith(entryHashes: string[], index: number, leafHasher: (leaf: string) => string, pairHasher: (a: string, b: string) => string): string[] {
  if (index < 0 || index >= entryHashes.length) {
    throw new Error('Merkle proof index out of range');
  }
  const proof: string[] = [];
  let level = normalizeEntryHashes(entryHashes).map(leafHasher);
  let idx = index;
  while (level.length > 1) {
    const isRight = idx % 2 === 1;
    const siblingIdx = isRight ? idx - 1 : idx + 1;
    proof.push(siblingIdx < level.length ? level[siblingIdx] : level[idx]);
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : level[i];
      next.push(pairHasher(left, right));
    }
    level = next;
    idx = Math.floor(idx / 2);
  }
  return proof;
}

function verifyMerkleProofWith(entryHashHex: string, proof: string[], root: string, leafHasher: (leaf: string) => string, pairHasher: (a: string, b: string) => string): boolean {
  const expectedRoot = normalizeHex32(root, 'Merkle root');
  let acc = leafHasher(entryHashHex);
  for (let index = 0; index < proof.length; index += 1) {
    acc = pairHasher(acc, normalizeHex32(proof[index], `Merkle proof[${index}]`));
  }
  return acc === expectedRoot;
}

export function computeMerkleRoot(entryHashes: string[]): string {
  return computeMerkleRootWith(entryHashes, hashLeaf, hashPair, true);
}

export function computeMerkleRootV2(entryHashes: string[]): string {
  return computeMerkleRootWith(entryHashes, hashLeafV2, hashPairV2, false);
}

export function computeMerkleRootForAlgorithm(entryHashes: string[], algorithm: string): string {
  return algorithm === MERKLE_SHA256_BYTES32_V2 ? computeMerkleRootV2(entryHashes) : computeMerkleRoot(entryHashes);
}

export function buildMerkleProof(entryHashes: string[], index: number): string[] {
  return buildMerkleProofWith(entryHashes, index, hashLeaf, hashPair);
}

export function buildMerkleProofV2(entryHashes: string[], index: number): string[] {
  return buildMerkleProofWith(entryHashes, index, hashLeafV2, hashPairV2);
}

export function buildMerkleProofForAlgorithm(entryHashes: string[], index: number, algorithm: string): string[] {
  return algorithm === MERKLE_SHA256_BYTES32_V2 ? buildMerkleProofV2(entryHashes, index) : buildMerkleProof(entryHashes, index);
}

export function verifyMerkleProof(entryHashHex: string, proof: string[], root: string): boolean {
  return verifyMerkleProofWith(entryHashHex, proof, root, hashLeaf, hashPair);
}

export function verifyMerkleProofV2(entryHashHex: string, proof: string[], root: string): boolean {
  return verifyMerkleProofWith(entryHashHex, proof, root, hashLeafV2, hashPairV2);
}

export function verifyMerkleProofForAlgorithm(entryHashHex: string, proof: string[], root: string, algorithm: string): boolean {
  return algorithm === MERKLE_SHA256_BYTES32_V2
    ? verifyMerkleProofV2(entryHashHex, proof, root)
    : verifyMerkleProof(entryHashHex, proof, root);
}

export function rootToBytes32(hexDigest: string): string {
  return `0x${normalizeHex32(hexDigest, 'Merkle root')}`;
}
