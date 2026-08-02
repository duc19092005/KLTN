import { AuditAction } from '../../../../infrastructure/audit/audit-logger.service';
import { Prisma } from '@prisma/client';

/** DI token for the Staff integrity anchor port. */
export const STAFF_INTEGRITY_ANCHOR = Symbol('STAFF_INTEGRITY_ANCHOR');

export type StaffIntegrityEvaluation = {
  id: string;
  employeeCode: string;
  fullName: string;
  status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED' | 'PENDING_ANCHOR';
  dbMatches: boolean;
  chainMatches: boolean;
  recomputedHash: string | null;
  storedHash: string | null;
  onChainHash: string | null;
};

/**
 * Tamper-evidence boundary for (non-doctor) staff: salted hash,
 * hash256/dataSalt persistence, BlockchainLogger audit entry, AuditAnchor
 * Merkle anchoring, and integrity evaluation. Only hashes/Merkle roots go
 * on-chain.
 *
 * action is the AuditAction so DELETE/UPDATE semantics (used by setStatus) are
 * preserved exactly.
 */
export interface StaffIntegrityAnchorPort {
  anchorChange(
    staffProfile: any,
    action: AuditAction,
    actorId?: string,
    before?: unknown,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
  evaluate(staff: any, skipChainCheck?: boolean): Promise<StaffIntegrityEvaluation>;
  history(id?: string): Promise<unknown>;
}
