import { Injectable } from '@nestjs/common';
import { AiModelRegistry, MedicalOrderStatus, Prisma, VisitStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import {
  ClinicalDecisionRepositoryPort,
  ClinicalDoctor,
  ClinicalVisitAuditSnapshot,
  ClinicalVisitInfo,
  CreateAiDiagnosisData,
  UpsertConclusionData,
} from '../../application/ports/clinical-decision.repository.port';

/**
 * Prisma-backed clinical-decision repository. Preserves the visit include shape
 * and the conclusion upsert + visit COMPLETED transition transaction from the
 * former ClinicalDecisionService.
 */
@Injectable()
export class PrismaClinicalDecisionRepository implements ClinicalDecisionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findDoctorByUserId(userId: string): Promise<ClinicalDoctor | null> {
    const doctor = await this.prisma.doctorProfile.findFirst({
      where: { staffProfile: { userId } },
      include: { staffProfile: { select: { id: true, departmentId: true } } },
    });
    if (!doctor) return null;
    return {
      id: doctor.id,
      staffId: doctor.staffProfile.id,
      departmentId: doctor.staffProfile.departmentId,
      specialty: doctor.specialty,
    };
  }

  async findVisitById(visitId: string): Promise<ClinicalVisitInfo | null> {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      select: { id: true, patientId: true, departmentId: true, staffId: true, status: true },
    });
    return visit;
  }

  async findFullVisit(visitId: string): Promise<any> {
    return this.prisma.visit.findUniqueOrThrow({ where: { id: visitId }, include: this.visitDecisionInclude() });
  }

  async findPatientMedicalHistory(patientId: string, currentVisitId: string): Promise<unknown[]> {
    return this.prisma.visit.findMany({
      where: {
        patientId,
        id: { not: currentVisitId },
        status: VisitStatus.COMPLETED,
      },
      select: {
        id: true,
        visitCode: true,
        status: true,
        source: true,
        checkInAt: true,
        completedAt: true,
        department: { select: { id: true, name: true, type: true } },
        staff: { select: { id: true, fullName: true, doctorProfile: { select: { specialty: true } } } },
        finalConclusion: {
          select: {
            id: true,
            finalDiagnosis: true,
            treatmentPlan: true,
            prescription: true,
            followUpNote: true,
            doctorNote: true,
            concludedAt: true,
            doctor: { select: { staffProfile: { select: { fullName: true } } } },
          },
        },
        medicalOrders: {
          select: {
            id: true,
            orderCode: true,
            orderType: true,
            priority: true,
            clinicalNote: true,
            status: true,
            orderedAt: true,
            completedAt: true,
            targetDepartment: { select: { id: true, name: true, type: true } },
            results: {
              select: {
                id: true,
                resultCode: true,
                note: true,
                returnedAt: true,
                files: { select: { id: true, originalName: true, mimeType: true, size: true, createdAt: true } },
              },
              orderBy: { returnedAt: 'desc' },
            },
          },
          orderBy: { orderedAt: 'desc' },
        },
      },
      orderBy: { checkInAt: 'desc' },
    });
  }

  async findAiModelById(id: string): Promise<AiModelRegistry | null> {
    return this.prisma.aiModelRegistry.findFirst({ where: { id, isDeleted: false } });
  }

  async findDefaultAiModelForSpecialty(specialty: string): Promise<AiModelRegistry | null> {
    return this.prisma.aiModelRegistry.findFirst({
      where: {
        isDeleted: false,
        type: 'API',
        apiEndpoint: { not: null },
        OR: [{ recommendedSpecialty: { contains: specialty, mode: 'insensitive' } }, { recommendedSpecialty: null }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAiDiagnosis(
    data: CreateAiDiagnosisData,
    afterWrite?: (diagnosis: unknown, tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<unknown> {
    return this.prisma.$transaction(async (tx) => {
      const diagnosis = await tx.aiDiagnosis.create({
        data: {
          aiModelId: data.aiModelId,
          patientId: data.patientId,
          visitId: data.visitId,
          prompt: data.prompt,
          result: data.result,
          ...(data.confidence !== undefined ? { confidence: data.confidence } : {}),
          status: 'AI_SUGGESTED',
        },
        include: { aiModel: true },
      });
      await afterWrite?.(diagnosis, tx);
      return diagnosis;
    });
  }

  async findAiDiagnosisWithVisit(id: string) {
    const diagnosis = await this.prisma.aiDiagnosis.findUnique({ where: { id }, include: { visit: true } });
    if (!diagnosis) return null;
    return {
      id: diagnosis.id,
      visit: diagnosis.visit
        ? {
            id: diagnosis.visit.id,
            patientId: diagnosis.visit.patientId,
            departmentId: diagnosis.visit.departmentId,
            staffId: diagnosis.visit.staffId,
            status: diagnosis.visit.status,
          }
        : null,
    };
  }

  async updateAiDiagnosisReview(
    id: string,
    reviewedByDoctorId: string,
    doctorFeedback: string | null,
    afterWrite?: (before: unknown, after: unknown, tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<unknown> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.aiDiagnosis.findUniqueOrThrow({ where: { id } });
      const after = await tx.aiDiagnosis.update({
        where: { id },
        data: { status: 'DOCTOR_REVIEWED', reviewedByDoctorId, doctorFeedback },
        include: { aiModel: true, reviewedByDoctor: { include: { staffProfile: true } } },
      });
      await afterWrite?.(before, after, tx);
      return after;
    });
  }

  async findAiDiagnosisById(id: string) {
    return this.prisma.aiDiagnosis.findUnique({ where: { id }, select: { id: true, visitId: true } });
  }

  async countPendingMedicalOrders(visitId: string): Promise<number> {
    return this.prisma.medicalOrder.count({
      where: {
        visitId,
        status: { notIn: [MedicalOrderStatus.CANCELLED, MedicalOrderStatus.RESULT_READY] },
      },
    });
  }

  async findConclusionByVisitId(visitId: string): Promise<any | null> {
    return this.prisma.medicalConclusion.findUnique({ where: { visitId } });
  }

  async upsertConclusionAndCompleteVisit(
    data: UpsertConclusionData,
    afterWrite?: (
      conclusion: unknown,
      visitAfter: ClinicalVisitAuditSnapshot | null,
      tx: Prisma.TransactionClient,
    ) => Promise<void>,
  ): Promise<unknown> {
    return this.prisma.$transaction(async (tx) => {
      const conclusion = await tx.medicalConclusion.upsert({
        where: { visitId: data.visitId },
        create: {
          visitId: data.visitId,
          doctorId: data.doctorId,
          aiDiagnosisId: data.aiDiagnosisId || null,
          finalDiagnosis: data.finalDiagnosis,
          treatmentPlan: data.treatmentPlan ?? null,
          prescription: data.prescription ?? null,
          followUpNote: data.followUpNote ?? null,
          doctorNote: data.doctorNote ?? null,
        },
        update: {
          aiDiagnosisId: data.aiDiagnosisId || null,
          finalDiagnosis: data.finalDiagnosis,
          treatmentPlan: data.treatmentPlan ?? null,
          prescription: data.prescription ?? null,
          followUpNote: data.followUpNote ?? null,
          doctorNote: data.doctorNote ?? null,
          concludedAt: new Date(),
        },
        include: { aiDiagnosis: { include: { aiModel: true } }, doctor: { include: { staffProfile: true } }, visit: { include: { patient: { select: { patientCode: true } } } } },
      });

      const visitAfter = await tx.visit.update({
        where: { id: data.visitId },
        data: {
          status: VisitStatus.COMPLETED,
          completedAt: new Date(),
          ...(data.staffId ? { staffId: data.staffId } : {}),
        },
        select: this.visitAuditSelect(),
      });

      await afterWrite?.(conclusion, visitAfter, tx);

      return conclusion;
    });
  }

  /** Full Visit fields required by the audit snapshot (REQUIRED_SNAPSHOT_FIELDS.Visit). */
  private visitAuditSelect() {
    return {
      id: true,
      visitCode: true,
      patientId: true,
      departmentId: true,
      staffId: true,
      status: true,
      source: true,
      checkInAt: true,
      completedAt: true,
    } as const;
  }

  private visitDecisionInclude() {
    return {
      patient: true,
      department: true,
      staff: { include: { doctorProfile: true, department: true } },
      medicalOrders: {
        include: {
          targetDepartment: true,
          results: {
            include: {
              files: true,
              performedBy: { select: { id: true, username: true, email: true, role: true } },
            },
          },
        },
        orderBy: { orderedAt: 'desc' },
      },
      aiDiagnoses: { include: { aiModel: true, reviewedByDoctor: { include: { staffProfile: true } } }, orderBy: { createdAt: 'desc' } },
      finalConclusion: { include: { aiDiagnosis: { include: { aiModel: true } } } },
    } as const;
  }
}
