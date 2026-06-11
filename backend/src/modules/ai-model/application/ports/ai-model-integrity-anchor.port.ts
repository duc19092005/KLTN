/** DI token for the AI model integrity anchor port. */
export const AI_MODEL_INTEGRITY_ANCHOR = Symbol('AI_MODEL_INTEGRITY_ANCHOR');

export type AiModelAnchorAction = 'CREATE' | 'UPDATE' | 'DELETE';

export type IntegrityEvaluation = {
  id: string;
  modelName: string;
  modelVersion: string;
  status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED' | 'PENDING_ANCHOR';
  dbMatches: boolean;
  chainMatches: boolean;
  recomputedHash: string | null;
  storedHash: string | null;
  onChainHash: string | null;
};

/**
 * Boundary for AI model tamper-evidence: hashing a snapshot, mirroring it
 * on-chain (AIModelRegistry), persisting hash256/dataSalt, writing the
 * BlockchainLogger audit entry, and recomputing/verifying integrity.
 *
 * Keeps the append-only audit + on-chain anchor behavior; never sends PII or
 * model content on-chain (only the salted hash).
 */
export interface AiModelIntegrityAnchorPort {
  /** Anchor a create/update/delete change and write the audit log. */
  anchorChange(model: any, action: AiModelAnchorAction, actorId?: string, before?: unknown): Promise<void>;
  /** Recompute the integrity hash and compare against DB + on-chain values. */
  evaluate(model: any): Promise<IntegrityEvaluation>;
  /** Append-only change history for an AI model (or all). */
  history(id?: string): Promise<unknown>;
}
