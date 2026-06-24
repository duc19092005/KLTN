import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PATIENT_REPOSITORY, PatientRepositoryPort } from '../ports/patient.repository.port';
import { PATIENT_INTEGRITY_ANCHOR, PatientIntegrityAnchorPort } from '../ports/patient-integrity-anchor.port';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AuditAnchorService } from '../../../../infrastructure/audit/audit-anchor.service';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { buildMedicalConclusionSnapshot } from '../../../clinical-decision/domain/medical-conclusion-snapshot';

/**
 * Public use case: patient enters their patientCode from their physical
 * medical book, and the system returns their full visit history with
 * blockchain verification status for each medical conclusion.
 */
@Injectable()
export class VerifyPatientPublicUseCase {
  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly repo: PatientRepositoryPort,
    @Inject(PATIENT_INTEGRITY_ANCHOR) private readonly integrity: PatientIntegrityAnchorPort,
    private readonly prisma: PrismaService,
    private readonly auditAnchor: AuditAnchorService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async execute(patientCode: string) {
    const patient = await this.repo.findByPatientCode(patientCode.trim().toUpperCase());
    if (!patient) throw new NotFoundException('Không tìm thấy hồ sơ bệnh nhân với mã sổ này');

    // 1. Verify patient record integrity (fast DB-only check)
    const patientIntegrity = await this.integrity.evaluate(patient, true);

    // 2. Batch query BlockchainLogger entries for all conclusions to avoid N+1 queries
    const conclusionIds = (patient.visits || [])
      .map((v: any) => v.finalConclusion?.id)
      .filter(Boolean);

    const logs = conclusionIds.length
      ? await this.prisma.blockchainLogger.findMany({
          where: { entity: 'MedicalConclusion', entityId: { in: conclusionIds } },
          select: { entityId: true, batchId: true, seq: true },
        })
      : [];

    const logMap = new Map(logs.map((l) => [l.entityId, l]));

    // 3. Map visits with fast local check status
    const visits = (patient.visits || []).map((visit: any) => {
      const conclusion = visit.finalConclusion;
      let blockchainVerification: any = null;

      if (conclusion) {
        const log = logMap.get(conclusion.id);
        if (!log || !log.batchId) {
          blockchainVerification = { status: 'unanchored' };
        } else {
          blockchainVerification = { status: 'unverified', seq: log.seq };
        }
      }

      return {
        id: visit.id,
        visitCode: visit.visitCode,
        checkInAt: visit.checkInAt,
        completedAt: visit.completedAt,
        status: visit.status,
        department: visit.department
          ? { name: visit.department.name, departmentCode: visit.department.departmentCode }
          : null,
        doctor: visit.staff?.doctorProfile
          ? { fullName: visit.staff.fullName, employeeCode: visit.staff.employeeCode }
          : null,
        conclusion: conclusion
          ? {
              id: conclusion.id,
              finalDiagnosis: conclusion.finalDiagnosis,
              treatmentPlan: conclusion.treatmentPlan,
              prescription: conclusion.prescription,
              followUpNote: conclusion.followUpNote,
              doctorNote: conclusion.doctorNote,
              concludedAt: conclusion.concludedAt,
              hash256: conclusion.hash256,
            }
          : null,
        aiDiagnosis: this.mapAiDiagnosis(conclusion?.aiDiagnosis || visit.aiDiagnoses?.[0] || null),
        blockchainVerification,
      };
    });

    return {
      patient: {
        patientCode: patient.patientCode,
        fullName: patient.fullName,
        gender: patient.gender,
        birthDate: patient.birthDate,
      },
      patientIntegrity: {
        status: patientIntegrity.status,
        dbMatches: patientIntegrity.dbMatches,
        chainMatches: patientIntegrity.chainMatches,
      },
      totalVisits: visits.length,
      visits,
    };
  }

  private mapAiDiagnosis(aiDiagnosis: any) {
    if (!aiDiagnosis) return null;
    return {
      id: aiDiagnosis.id,
      result: aiDiagnosis.result,
      confidence: aiDiagnosis.confidence,
      status: aiDiagnosis.status,
      createdAt: aiDiagnosis.createdAt,
      aiModel: aiDiagnosis.aiModel
        ? {
            id: aiDiagnosis.aiModel.id,
            modelName: aiDiagnosis.aiModel.modelName,
            modelVersion: aiDiagnosis.aiModel.modelVersion,
            provider: aiDiagnosis.aiModel.provider,
          }
        : null,
    };
  }

  async verifyConclusion(conclusionId: string) {
    const conclusion = await this.prisma.medicalConclusion.findUnique({
      where: { id: conclusionId },
      include: {
        visit: {
          include: {
            patient: true,
          },
        },
      },
    });
    if (!conclusion) throw new NotFoundException('Không tìm thấy kết luận khám.');
    return this.verifyConclusionOnChain(conclusion);
  }

  /**
   * Verify a single MedicalConclusion against the blockchain audit trail.
   * 1. Recompute hash from current data
   * 2. Find the BlockchainLogger entry for this conclusion
   * 3. Get Merkle Proof and verify against on-chain root
   */
  private async verifyConclusionOnChain(conclusion: any) {
    try {
      const snapshot = buildMedicalConclusionSnapshot(conclusion);
      const recomputed = conclusion.dataSalt
        ? this.auditLogger.recompute(snapshot, conclusion.dataSalt)
        : null;
      const dbHash = conclusion.hash256 || null;
      const dbMatches = recomputed !== null && recomputed === dbHash;

      // Find the latest anchored log entry for this conclusion
      const latestLog = await this.prisma.blockchainLogger.findFirst({
        where: { entity: 'MedicalConclusion', entityId: conclusion.id, batchId: { not: null } },
        orderBy: { seq: 'desc' },
        select: { seq: true, dataHash: true, batchId: true, txHash: true, createdAt: true },
      });

      let chainMatches = false;
      let batchId: number | null = null;
      let txHash: string | null = null;
      let anchoredAt: Date | null = null;
      let proofDetails: any = null;

      if (latestLog?.seq) {
        batchId = latestLog.batchId;
        txHash = latestLog.txHash;
        anchoredAt = latestLog.createdAt;

        try {
          const proof = await this.auditAnchor.getInclusionProof(latestLog.seq);
          if (proof && proof.verified) {
            chainMatches = latestLog.dataHash === recomputed;
            proofDetails = {
              seq: latestLog.seq,
              batchId: latestLog.batchId,
              entryHash: latestLog.dataHash,
              onChainRoot: proof.onChainRoot,
              proof: proof.proof,
            };
          }
        } catch { /* proof verification failed */ }
      }

      let status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED';
      if (!latestLog || !latestLog.batchId) status = 'UNANCHORED';
      else if (dbMatches && chainMatches) status = 'VERIFIED';
      else status = 'TAMPERED';

      return {
        status,
        dbMatches,
        chainMatches,
        batchId,
        txHash,
        anchoredAt,
        seq: latestLog?.seq || null,
        proofDetails,
      };
    } catch {
      return { status: 'UNANCHORED', dbMatches: false, chainMatches: false, batchId: null, txHash: null, anchoredAt: null, seq: null, proofDetails: null };
    }
  }
}
