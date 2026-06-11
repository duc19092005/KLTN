/** DI token for the Doctor integrity anchor port. */
export const DOCTOR_INTEGRITY_ANCHOR = Symbol('DOCTOR_INTEGRITY_ANCHOR');

export type DoctorAnchorAction = 'CREATE' | 'UPDATE' | 'DELETE';

export type DoctorIntegrityEvaluation = {
  id: string;
  staffProfileId: string;
  specialty: string;
  licenseNumber: string;
  status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED' | 'PENDING_ANCHOR';
  dbMatches: boolean;
  chainMatches: boolean;
  recomputedHash: string | null;
  storedHash: string | null;
  onChainHash: string | null;
};

/**
 * Tamper-evidence boundary for doctors. The unified hash (staff + doctor) is
 * mirrored on-chain via StaffRegistry under doctor.id, hash256/dataSalt
 * persisted on DoctorProfile, and a BlockchainLogger entry written. Only the
 * salted hash goes on-chain.
 */
export interface DoctorIntegrityAnchorPort {
  anchorChange(doctor: any, action: DoctorAnchorAction, actorId?: string, before?: unknown): Promise<void>;
  evaluate(doctor: any): Promise<DoctorIntegrityEvaluation>;
  history(id?: string): Promise<unknown>;
}
