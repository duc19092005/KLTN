import { AuditAction } from '../../../../infrastructure/audit/audit-logger.service';

/** DI token for the Staff integrity anchor port. */
export const STAFF_INTEGRITY_ANCHOR = Symbol('STAFF_INTEGRITY_ANCHOR');

export type StaffIntegrityEvaluation = {
  id: string;
  employeeCode: string;
  fullName: string;
  status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED';
  dbMatches: boolean;
  chainMatches: boolean;
  recomputedHash: string | null;
  storedHash: string | null;
  onChainHash: string | null;
};

/**
 * Tamper-evidence boundary for (non-doctor) staff: salted hash, on-chain mirror
 * via StaffRegistry, hash256/dataSalt persistence, BlockchainLogger audit entry,
 * and integrity evaluation. Only the salted hash goes on-chain.
 *
 * action is the AuditAction so DELETE/UPDATE semantics (used by setStatus) are
 * preserved exactly.
 */
export interface StaffIntegrityAnchorPort {
  anchorChange(staffProfile: any, action: AuditAction, actorId?: string, before?: unknown): Promise<void>;
  evaluate(staff: any): Promise<StaffIntegrityEvaluation>;
  history(id?: string): Promise<unknown>;
}
