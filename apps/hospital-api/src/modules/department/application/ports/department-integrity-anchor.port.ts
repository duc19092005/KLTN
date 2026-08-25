/** DI token for the Department integrity anchor port. */
export const DEPARTMENT_INTEGRITY_ANCHOR = Symbol('DEPARTMENT_INTEGRITY_ANCHOR');

export type DepartmentAnchorAction = 'CREATE' | 'UPDATE' | 'DELETE';

export type DepartmentIntegrityEvaluation = {
  id: string;
  departmentCode: string;
  name: string;
  status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED' | 'PENDING_ANCHOR' | 'VERIFICATION_UNAVAILABLE';
  dbMatches: boolean;
  chainMatches: boolean;
  recomputedHash: string | null;
  storedHash: string | null;
  onChainHash: string | null;
};

/**
 * Tamper-evidence boundary for departments: salted hash, hash256/dataSalt
 * persistence, BlockchainLogger audit entry, AuditAnchor Merkle anchoring, and
 * integrity evaluation. Only hashes/Merkle roots go on-chain.
 */
export interface DepartmentIntegrityAnchorPort {
  anchorChange(
    department: any,
    action: DepartmentAnchorAction,
    actorId?: string,
    before?: unknown,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
  evaluate(department: any, skipChainCheck?: boolean): Promise<DepartmentIntegrityEvaluation>;
  evaluateMany(departments: any[]): Promise<DepartmentIntegrityEvaluation[]>;
  history(id?: string): Promise<unknown>;
}
import { Prisma } from '@prisma/client';
