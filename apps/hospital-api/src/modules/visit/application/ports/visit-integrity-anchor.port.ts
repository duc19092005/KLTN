import { Prisma } from '@prisma/client';
import { PageIntegrityResult } from '../../../../infrastructure/audit/anchoring/audit-page-integrity.types';

export const VISIT_INTEGRITY_ANCHOR = Symbol('VISIT_INTEGRITY_ANCHOR');

export type VisitAnchorAction = 'CREATE' | 'UPDATE';

/** Application boundary for Visit integrity persistence and batched verification. */
export interface VisitIntegrityAnchorPort {
  anchorChange(
    visit: unknown,
    action: VisitAnchorAction,
    actorId?: string | null,
    before?: Record<string, unknown> | null,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
  evaluateMany(visits: unknown[]): Promise<Map<string, PageIntegrityResult>>;
}
