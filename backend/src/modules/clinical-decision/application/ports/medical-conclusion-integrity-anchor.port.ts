import { Prisma } from '@prisma/client';

/** DI token for the MedicalConclusion integrity anchor port. */
export const MEDICAL_CONCLUSION_INTEGRITY_ANCHOR = Symbol('MEDICAL_CONCLUSION_INTEGRITY_ANCHOR');

export type MedicalConclusionAnchorAction = 'CREATE' | 'UPDATE';

/**
 * Interface representing the boundary for MedicalConclusion integrity auditing.
 * It manages computing salted hashes, updating DB records, and logging audits to BlockchainLogger.
 */
export interface MedicalConclusionIntegrityAnchorPort {
  anchorChange(
    conclusion: any,
    action: MedicalConclusionAnchorAction,
    actorId?: string,
    before?: unknown,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;

  triggerImmediateAnchor(): Promise<void>;
}
