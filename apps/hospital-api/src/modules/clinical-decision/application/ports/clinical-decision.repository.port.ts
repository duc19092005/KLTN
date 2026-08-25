import { AiModelRegistry, Prisma } from '@prisma/client';

/** DI token for the clinical decision repository port. */
export const CLINICAL_DECISION_REPOSITORY = Symbol('CLINICAL_DECISION_REPOSITORY');

export type ClinicalDecisionBeforeWriteHook = (tx: Prisma.TransactionClient) => Promise<void>;

/** Minimal visit shape for doctor ownership checks. */
export type ClinicalVisitInfo = {
  id: string;
  patientId: string;
  departmentId: string;
  staffId: string | null;
  status: string;
};

/** Doctor profile with specialty, used for AI-model defaulting. */
export type ClinicalDoctor = {
  id: string;
  staffId: string;
  departmentId: string | null;
  specialty: string;
};

export type CreateAiDiagnosisData = {
  aiModelId: string;
  patientId: string;
  visitId: string;
  prompt: string;
  result: string;
  confidence?: number;
};

export type UpsertConclusionData = {
  visitId: string;
  doctorId: string;
  staffId?: string;
  aiDiagnosisId?: string | null;
  finalDiagnosis: string;
  treatmentPlan?: string | null;
  prescription?: string | null;
  followUpNote?: string | null;
  doctorNote?: string | null;
};

/**
 * Full Visit fields required by EntityRecoveryService for the `Visit` entity
 * (REQUIRED_SNAPSHOT_FIELDS.Visit). This is the canonical shape consumed by
 * `buildVisitSnapshot`.
 */
export type ClinicalVisitAuditSnapshot = {
  id: string;
  visitCode: string;
  patientId: string;
  departmentId: string;
  staffId: string | null;
  status: string;
  source: string;
  checkInAt: Date | string;
  completedAt: Date | string | null;
};

/**
 * Persistence boundary for the clinical-decision workflow. The Prisma
 * implementation keeps the visit include shapes and the conclusion upsert +
 * visit COMPLETED transition transaction unchanged.
 */
export interface ClinicalDecisionRepositoryPort {
  findDoctorByUserId(userId: string): Promise<ClinicalDoctor | null>;
  findVisitById(visitId: string): Promise<ClinicalVisitInfo | null>;
  findFullVisit(visitId: string): Promise<any>;
  findPatientMedicalHistory(patientId: string, currentVisitId: string): Promise<unknown[]>;

  findAiModelById(id: string): Promise<AiModelRegistry | null>;
  findDefaultAiModelForSpecialty(specialty: string): Promise<AiModelRegistry | null>;

  createAiDiagnosis(
    data: CreateAiDiagnosisData,
    afterWrite?: (diagnosis: unknown, tx: Prisma.TransactionClient) => Promise<void>,
    beforeWrite?: ClinicalDecisionBeforeWriteHook,
  ): Promise<unknown>;

  findAiDiagnosisWithVisit(id: string): Promise<{ id: string; visit: ClinicalVisitInfo | null } | null>;
  updateAiDiagnosisReview(
    id: string,
    reviewedByDoctorId: string,
    doctorFeedback: string | null,
    afterWrite?: (before: unknown, after: unknown, tx: Prisma.TransactionClient) => Promise<void>,
    beforeWrite?: ClinicalDecisionBeforeWriteHook,
  ): Promise<unknown>;

  findAiDiagnosisById(id: string): Promise<{ id: string; visitId: string } | null>;
  countPendingMedicalOrders(visitId: string): Promise<number>;

  findConclusionByVisitId(visitId: string): Promise<any | null>;

  /** Atomic: upsert conclusion + transition visit to COMPLETED. */
  upsertConclusionAndCompleteVisit(
    data: UpsertConclusionData,
    afterWrite?: (
      conclusion: unknown,
      visitAfter: ClinicalVisitAuditSnapshot | null,
      tx: Prisma.TransactionClient,
    ) => Promise<void>,
    beforeWrite?: ClinicalDecisionBeforeWriteHook,
  ): Promise<unknown>;
}
