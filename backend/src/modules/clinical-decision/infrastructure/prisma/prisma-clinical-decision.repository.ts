import { Injectable } from '@nestjs/common';
import { AiModelRegistry, VisitStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import {
  ClinicalDecisionRepositoryPort,
  ClinicalDoctor,
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
    const doctor = await this.prisma.doctorProfile.findFirst({ where: { staffProfile: { userId } } });
    if (!doctor) return null;
    return { id: doctor.id, specialty: doctor.specialty };
  }

  async findVisitById(visitId: string): Promise<ClinicalVisitInfo | null> {
    const visit = await this.prisma.visit.findUnique({ where: { id: visitId }, select: { id: true, doctorId: true, status: true } });
    return visit;
  }

  async findFullVisit(visitId: string): Promise<any> {
    return this.prisma.visit.findUniqueOrThrow({ where: { id: visitId }, include: this.visitDecisionInclude() });
  }

  async findAiModelById(id: string): Promise<AiModelRegistry | null> {
    return this.prisma.aiModelRegistry.findUnique({ where: { id } });
  }

  async findDefaultAiModelForSpecialty(specialty: string): Promise<AiModelRegistry | null> {
    return this.prisma.aiModelRegistry.findFirst({
      where: {
        type: 'API',
        apiEndpoint: { not: null },
        OR: [{ recommendedSpecialty: { contains: specialty, mode: 'insensitive' } }, { recommendedSpecialty: null }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAiDiagnosis(data: CreateAiDiagnosisData): Promise<unknown> {
    return this.prisma.aiDiagnosis.create({
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
  }

  async findAiDiagnosisWithVisit(id: string) {
    const diagnosis = await this.prisma.aiDiagnosis.findUnique({ where: { id }, include: { visit: true } });
    if (!diagnosis) return null;
    return { id: diagnosis.id, visit: diagnosis.visit ? { doctorId: diagnosis.visit.doctorId } : null };
  }

  async updateAiDiagnosisReview(id: string, reviewedByDoctorId: string, doctorFeedback: string | null): Promise<unknown> {
    return this.prisma.aiDiagnosis.update({
      where: { id },
      data: {
        status: 'DOCTOR_REVIEWED',
        reviewedByDoctorId,
        doctorFeedback,
      },
      include: { aiModel: true, reviewedByDoctor: { include: { staffProfile: true } } },
    });
  }

  async findAiDiagnosisById(id: string) {
    return this.prisma.aiDiagnosis.findUnique({ where: { id }, select: { id: true, visitId: true } });
  }

  async findConclusionByVisitId(visitId: string): Promise<any | null> {
    return this.prisma.medicalConclusion.findUnique({ where: { visitId } });
  }

  async upsertConclusionAndCompleteVisit(data: UpsertConclusionData): Promise<unknown> {
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

      await tx.visit.update({
        where: { id: data.visitId },
        data: { status: VisitStatus.COMPLETED, completedAt: new Date() },
      });

      return conclusion;
    });
  }

  private visitDecisionInclude() {
    return {
      patient: true,
      doctor: { include: { staffProfile: { include: { department: true } } } },
      clinicalRoom: true,
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
