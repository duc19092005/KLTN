/** DI token for the Department integrity anchor port. */
export const DEPARTMENT_INTEGRITY_ANCHOR = Symbol('DEPARTMENT_INTEGRITY_ANCHOR');

export type DepartmentAnchorAction = 'CREATE' | 'UPDATE' | 'DELETE';

export type DepartmentIntegrityEvaluation = {
  id: string;
  departmentCode: string;
  name: string;
  status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED' | 'PENDING_ANCHOR';
  dbMatches: boolean;
  chainMatches: boolean;
  recomputedHash: string | null;
  storedHash: string | null;
  onChainHash: string | null;
};

/**
 * Tamper-evidence boundary for departments: salted hash, on-chain mirror via
 * DepartmentRegistry, hash256/dataSalt persistence, BlockchainLogger audit
 * entry, and integrity evaluation. Only the salted hash goes on-chain.
 */
export interface DepartmentIntegrityAnchorPort {
  anchorChange(department: any, action: DepartmentAnchorAction, actorId?: string, before?: unknown): Promise<void>;
  evaluate(department: any): Promise<DepartmentIntegrityEvaluation>;
  history(id?: string): Promise<unknown>;
}
