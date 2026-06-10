import { ethers } from 'ethers';
import { canonicalize } from '../audit/audit-hash.util';

export function computeBackendActionHash(actionPayload: unknown): string {
  const canonicalPayload = canonicalize(actionPayload);
  return ethers.keccak256(ethers.toUtf8Bytes(`KLTN_ACTION_V1:${canonicalPayload}`));
}
