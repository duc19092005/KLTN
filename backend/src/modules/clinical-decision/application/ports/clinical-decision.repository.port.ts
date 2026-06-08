import { AiModelRegistry } from '@prisma/client';

/** DI token for the clinical decision repository port. */
export const CLINICAL_DECISION_REPOSITORY = Symbol('CLINICAL_DECISION_REPOSITORY');

/** Minimal visit shape for doctor ownership checks. */
export type ClinicalVisitInfo = { id: string; doctorId: string; status: string };

/** Doctor profile with specialty, used for AI-model defaulting. */
export type ClinicalDoctor = { id: string; specialty: string };

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
  aiDiagnosisId?: string | null;
  finalDiagnosis: string;
  treatmentPlan?: string | null;
  prescription?: string | null;
  followUpNote?: string | null;
  doctorNote?: string | null;
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

  findAiModelById(id: string): Promise<AiModelRegistry | null>;
  findDefaultAiModelForSpecialty(specialty: string): Promise<AiModelRegistry | null>;

  createAiDiagnosis(data: CreateAiDiagnosisData): Promise<unknown>;

  findAiDiagnosisWithVisit(id: string): Promise<{ id: string; visit: { doctorId: string } | null } | null>;
  updateAiDiagnosisReview(id: string, reviewedByDoctorId: string, doctorFeedback: string | null): Promise<unknown>;

  findAiDiagnosisById(id: string): Promise<{ id: string; visitId: string } | null>;
  countPendingMedicalOrders(visitId: string): Promise<number>;

  findConclusionByVisitId(visitId: string): Promise<any | null>;

  /** Atomic: upsert conclusion + transition visit to COMPLETED. */
  upsertConclusionAndCompleteVisit(data: UpsertConclusionData): Promise<unknown>;
}
