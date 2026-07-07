import { DoctorAnchorAction } from './doctor-integrity-anchor.port';

/** DI token for the doctor re-anchor port (used by StaffModule to avoid forwardRef). */
export const DOCTOR_REANCHOR = Symbol('DOCTOR_REANCHOR');

/**
 * Narrow boundary exposed to other modules (StaffModule) so a staff update that
 * touches a doctor can re-anchor the unified doctor hash WITHOUT importing the
 * whole DoctorService via forwardRef. Mirrors the former
 * DoctorService.reanchorForStaffUpdate().
 */
export interface DoctorReanchorPort {
  reanchorForStaffUpdate(
    staffProfileId: string,
    actorId?: string,
    beforeSnapshot?: Record<string, unknown> | null,
    action?: DoctorAnchorAction,
  ): Promise<void>;
}
