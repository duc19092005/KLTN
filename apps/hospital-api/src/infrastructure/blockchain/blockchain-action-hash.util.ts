import { ethers } from 'ethers';
import { canonicalize } from '../audit';

export function computeBackendActionHash(actionPayload: unknown): string {
  const canonicalPayload = canonicalize(actionPayload);
  return ethers.keccak256(ethers.toUtf8Bytes(`KLTN_ACTION_V1:${canonicalPayload}`));
}
