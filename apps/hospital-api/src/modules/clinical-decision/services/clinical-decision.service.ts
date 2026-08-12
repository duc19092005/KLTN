import { Injectable } from '@nestjs/common';
import { AuthUser } from '../../../common/types/auth-user.type';
import { CreateMedicalConclusionDto, GenerateAiAnalysisDto, ReviewAiDiagnosisDto } from '../dto/clinical-decision.dto';
import { GetVisitResultsUseCase } from '../application/use-cases/get-visit-results.use-case';
import { GenerateAiAnalysisUseCase } from '../application/use-cases/generate-ai-analysis.use-case';
import { ReviewAiDiagnosisUseCase } from '../application/use-cases/review-ai-diagnosis.use-case';
import { CreateMedicalConclusionUseCase } from '../application/use-cases/create-medical-conclusion.use-case';
import { ListPatientMedicalHistoryUseCase } from '../application/use-cases/list-patient-medical-history.use-case';

/**
 * Facade preserving the controller-facing API. Each method delegates to a
 * single use case; no business logic lives here (Clean Architecture refactor).
 *
 * Note: doctorUserId is the authenticated user's sub. Callers may still pass it
 * directly (controller does `user.sub`).
 */
@Injectable()
export class ClinicalDecisionService {
  constructor(
    private readonly getVisitResultsUseCase: GetVisitResultsUseCase,
    private readonly generateAiAnalysisUseCase: GenerateAiAnalysisUseCase,
    private readonly reviewAiDiagnosisUseCase: ReviewAiDiagnosisUseCase,
    private readonly createConclusionUseCase: CreateMedicalConclusionUseCase,
    private readonly listPatientMedicalHistoryUseCase: ListPatientMedicalHistoryUseCase,
  ) {}

  getVisitResults(visitId: string, doctorUserId: string) {
    return this.getVisitResultsUseCase.execute(visitId, doctorUserId);
  }

  listPatientMedicalHistory(patientId: string, currentVisitId: string, doctorUserId: string) {
    return this.listPatientMedicalHistoryUseCase.execute(patientId, currentVisitId, doctorUserId);
  }

  generateAiAnalysis(dto: GenerateAiAnalysisDto, doctorUserId: string) {
    return this.generateAiAnalysisUseCase.execute(dto, doctorUserId);
  }

  reviewAiDiagnosis(id: string, dto: ReviewAiDiagnosisDto, doctorUserId: string) {
    return this.reviewAiDiagnosisUseCase.execute(id, dto, doctorUserId);
  }

  createConclusion(dto: CreateMedicalConclusionDto, doctorUserId: string) {
    return this.createConclusionUseCase.execute(dto, doctorUserId);
  }
}
