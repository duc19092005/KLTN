import { Prisma } from '@prisma/client';
import { PageIntegrityResult } from '../../../../infrastructure/audit/anchoring/audit-page-integrity.types';

export const MEDICAL_ORDER_INTEGRITY_ANCHOR = Symbol('MEDICAL_ORDER_INTEGRITY_ANCHOR');
export const MEDICAL_RESULT_INTEGRITY_ANCHOR = Symbol('MEDICAL_RESULT_INTEGRITY_ANCHOR');

export type ClinicalRecordAction = 'CREATE' | 'UPDATE';

export interface MedicalOrderIntegrityAnchorPort {
  anchorChange(order: unknown, action: ClinicalRecordAction, actorId?: string | null, before?: Record<string, unknown> | null, tx?: Prisma.TransactionClient): Promise<void>;
  evaluateMany(orders: unknown[]): Promise<Map<string, PageIntegrityResult>>;
}

export interface MedicalResultIntegrityAnchorPort {
  anchorChange(result: unknown, action: ClinicalRecordAction, actorId?: string | null, before?: Record<string, unknown> | null, tx?: Prisma.TransactionClient): Promise<void>;
  evaluateMany(results: unknown[]): Promise<Map<string, PageIntegrityResult>>;
}
