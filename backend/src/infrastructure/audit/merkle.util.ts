import { createHash } from 'crypto';

/**
 * Merkle tree utilities for batch-anchoring audit logs.
 *
 * The anchoring job collects the entryHash of every not-yet-anchored BlockchainLogger row
 * (already a hash-chained leaf) and builds a binary Merkle tree over them. Only the ROOT is
 * committed on-chain (AuditAnchor.commitRoot), so gas is flat regardless of batch size: 10 or
 * 10,000 logs both cost one transaction storing one 32-byte root.
 *
 * Each log can later be proven to belong to a committed batch with an O(log n) Merkle proof,
 * without revealing the other logs. Verification recomputes the root from the leaf + proof and
 * compares it to the immutable on-chain value.
 *
 * Hashing convention (must stay stable; it defines proof validity):
 *  - leaf  = sha256(hex leaf string as utf8)            -- domain-separated from internal nodes
 *  - node  = sha256( min(a,b) || max(a,b) )             -- sorted pairs => order-independent proofs
 *  - odd node out is promoted (hashed with itself)
 */

const ZERO = '0'.repeat(64);

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Hash a raw leaf value (an entryHash hex string) into a Merkle leaf. */
export function hashLeaf(entryHashHex: string): string {
  return sha256Hex(`leaf:${entryHashHex.toLowerCase()}`);
}

/** Combine two child hashes into a parent. Sorted so proofs don't need a left/right flag. */
function hashPair(a: string, b: string): string {
  const [lo, hi] = a.toLowerCase() <= b.toLowerCase() ? [a, b] : [b, a];
  return sha256Hex(`node:${lo}${hi}`);
}

/**
 * Build the Merkle root over an ordered list of entryHash hex strings.
 * Returns 64 zero-chars for an empty input (callers must not commit an empty batch).
 */
export function computeMerkleRoot(entryHashes: string[]): string {
  if (entryHashes.length === 0) return ZERO;
  let level = entryHashes.map(hashLeaf);
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : level[i]; // promote odd leaf
      next.push(hashPair(left, right));
    }
    level = next;
  }
  return level[0];
}

/**
 * Produce a Merkle proof (list of sibling hashes, bottom-up) for the leaf at `index`.
 * Verifiers fold the proof into the leaf with hashPair and compare against the committed root.
 */
export function buildMerkleProof(entryHashes: string[], index: number): string[] {
  if (index < 0 || index >= entryHashes.length) {
    throw new Error('Merkle proof index out of range');
  }
  const proof: string[] = [];
  let level = entryHashes.map(hashLeaf);
  let idx = index;
  while (level.length > 1) {
    const isRight = idx % 2 === 1;
    const siblingIdx = isRight ? idx - 1 : idx + 1;
    const sibling = siblingIdx < level.length ? level[siblingIdx] : level[idx];
    proof.push(sibling);
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : level[i];
      next.push(hashPair(left, right));
    }
    level = next;
    idx = Math.floor(idx / 2);
  }
  return proof;
}

/** Recompute the root from a single leaf + its proof. Used by independent verifiers. */
export function verifyMerkleProof(entryHashHex: string, proof: string[], root: string): boolean {
  let acc = hashLeaf(entryHashHex);
  for (const sibling of proof) {
    acc = hashPair(acc, sibling);
  }
  return acc.toLowerCase() === root.toLowerCase();
}

/** Convert a hex SHA256 digest into a 0x-prefixed bytes32 for AuditAnchor.commitRoot. */
export function rootToBytes32(hexDigest: string): string {
  const clean = hexDigest.startsWith('0x') ? hexDigest.slice(2) : hexDigest;
  if (clean.length !== 64) throw new Error('Expected a 32-byte (64 hex char) Merkle root');
  return `0x${clean}`;
}
