/** DI token for the Patient integrity anchor port. */
export const PATIENT_INTEGRITY_ANCHOR = Symbol('PATIENT_INTEGRITY_ANCHOR');

export type PatientIntegrityEvaluation = {
  id: string;
  patientCode: string;
  fullName: string;
  status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED';
  dbMatches: boolean;
  chainMatches: boolean;
  recomputedHash: string | null;
  storedHash: string | null;
};

/**
 * Interface representing the boundary for Patient integrity auditing.
 */
export interface PatientIntegrityAnchorPort {
  anchorChange(patient: any, action: string, actorId?: string, before?: unknown): Promise<void>;
  evaluate(patient: any, skipChainCheck?: boolean): Promise<PatientIntegrityEvaluation>;
  history(id?: string): Promise<any[]>;
}
