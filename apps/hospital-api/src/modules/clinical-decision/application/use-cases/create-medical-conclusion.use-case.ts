import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CreateMedicalConclusionDto } from '../../dto/clinical-decision.dto';
import { ClinicalDecisionPolicy } from '../policies/clinical-decision.policy';
import {
  CLINICAL_DECISION_REPOSITORY,
  ClinicalDecisionRepositoryPort,
} from '../ports/clinical-decision.repository.port';
import {
  MEDICAL_CONCLUSION_INTEGRITY_ANCHOR,
  MedicalConclusionIntegrityAnchorPort,
} from '../ports/medical-conclusion-integrity-anchor.port';
import { buildMedicalConclusionSnapshot } from '../../domain/medical-conclusion-snapshot';
import { AuditLoggerService } from '../../../../infrastructure/audit';
import { buildVisitSnapshot } from '../../../visit/domain/visit-snapshot';

/**
 * Doctor finalizes a visit with a MedicalConclusion. Behavior copied verbatim
 * from the former ClinicalDecisionService.createConclusion(): doctor ownership,
 * readiness check, optional AI-diagnosis linkage validation, and the atomic
 * conclusion upsert + visit COMPLETED transition.
 *
 * Invariant: only this use case (a DOCTOR action) writes a MedicalConclusion.
 * AI suggestions never finalize a visit.
 */
@Injectable()
export class CreateMedicalConclusionUseCase {
  constructor(
    @Inject(CLINICAL_DECISION_REPOSITORY) private readonly repo: ClinicalDecisionRepositoryPort,
    @Inject(MEDICAL_CONCLUSION_INTEGRITY_ANCHOR) private readonly integrity: MedicalConclusionIntegrityAnchorPort,
    private readonly policy: ClinicalDecisionPolicy,
    private readonly audit: AuditLoggerService,
  ) {}

  async execute(dto: CreateMedicalConclusionDto, doctorUserId: string) {
    const doctor = await this.repo.findDoctorByUserId(doctorUserId);
    if (!doctor) throw new BadRequestException('Tài khoản hiện tại không có hồ sơ bác sĩ.');

    const visit = await this.repo.findVisitById(dto.visitId);
    this.policy.assertDoctorOwnsVisit(visit, doctor);
    this.policy.assertReadyForClinicalDecision(visit!.status);

    const pendingOrders = await this.repo.countPendingMedicalOrders(visit!.id);
    if (pendingOrders > 0) {
      throw new BadRequestException(`Còn ${pendingOrders} phiếu chỉ định chưa có kết quả. Bác sĩ chỉ được kết luận khi tất cả phòng đã trả kết quả.`);
    }

    if (dto.aiDiagnosisId) {
      const aiDiagnosis = await this.repo.findAiDiagnosisById(dto.aiDiagnosisId);
      if (!aiDiagnosis || aiDiagnosis.visitId !== visit!.id) {
        throw new BadRequestException('Phân tích AI không thuộc lượt khám này.');
      }
    }

    const existing = await this.repo.findConclusionByVisitId(dto.visitId);
    if (existing) {
      throw new BadRequestException('Lượt khám này đã có kết luận y khoa, không thể kết luận lại.');
    }

    const conclusion = await this.repo.upsertConclusionAndCompleteVisit(
      {
        visitId: visit!.id,
        doctorId: doctor.id,
        staffId: doctor.staffId,
        aiDiagnosisId: dto.aiDiagnosisId || null,
        finalDiagnosis: dto.finalDiagnosis.trim(),
        treatmentPlan: dto.treatmentPlan?.trim() || null,
        prescription: dto.prescription?.trim() || null,
        followUpNote: dto.followUpNote?.trim() || null,
        doctorNote: dto.doctorNote?.trim() || null,
      },
      async (savedConclusion, visitAfter, tx) => {
        await this.integrity.anchorChange(savedConclusion, 'CREATE', doctorUserId, null, tx);

        if (visitAfter) {
          await this.audit.recordV2(
            {
              entity: 'Visit',
              entityId: visitAfter.id,
              action: 'UPDATE',
              actorId: doctorUserId,
              before: { visitId: visitAfter.id, status: visit!.status },
              after: buildVisitSnapshot(visitAfter),
              metadata: { schema: 'KLTN_VISIT_STATUS_AUDIT_V2' },
              onChainStatus: 'PENDING',
            },
            tx,
          );
        }
      },
    );

    await this.integrity.triggerImmediateAnchor();

    return conclusion;
  }
}
