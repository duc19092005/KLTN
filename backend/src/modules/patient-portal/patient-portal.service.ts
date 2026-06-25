import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { S3MedicalResultStorageAdapter } from '../medical-order/infrastructure/adapters/s3-medical-result-storage.adapter';

@Injectable()
export class PatientPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resultStorage: S3MedicalResultStorageAdapter,
  ) {}

  async getProfiles(userId: string) {
    const accesses = await this.prisma.patientAccess.findMany({
      where: { userId, status: 'ACTIVE', canViewProfile: true },
      include: { patient: true },
      orderBy: { createdAt: 'asc' },
    });

    return accesses.map((access) => ({
      accessId: access.id,
      relationship: access.relationship,
      permissions: {
        canViewProfile: access.canViewProfile,
        canViewVisits: access.canViewVisits,
        canViewResults: access.canViewResults,
        canBookVisit: access.canBookVisit,
      },
      patient: this.toPatientSummary(access.patient),
    }));
  }

  async getProfile(userId: string, patientId: string) {
    const access = await this.requireAccess(userId, patientId, 'profile');
    return {
      relationship: access.relationship,
      permissions: {
        canViewProfile: access.canViewProfile,
        canViewVisits: access.canViewVisits,
        canViewResults: access.canViewResults,
        canBookVisit: access.canBookVisit,
      },
      patient: this.toPatientSummary(access.patient),
    };
  }

  async getVisits(userId: string, patientId: string) {
    const access = await this.requireAccess(userId, patientId, 'visits');
    if (!access.canViewVisits) throw new ForbiddenException('Tài khoản không có quyền xem lịch sử khám của hồ sơ này.');

    const visits = await this.prisma.visit.findMany({
      where: { patientId },
      include: {
        department: true,
        staff: { include: { doctorProfile: true } },
        finalConclusion: {
          select: { id: true, finalDiagnosis: true, concludedAt: true },
        },
      },
      orderBy: { checkInAt: 'desc' },
    });

    return visits.map((visit) => ({
      id: visit.id,
      visitCode: visit.visitCode,
      status: visit.status,
      checkInAt: visit.checkInAt,
      completedAt: visit.completedAt,
      reason: visit.reason,
      symptoms: visit.symptoms,
      department: visit.department ? { id: visit.department.id, name: visit.department.name, type: visit.department.type } : null,
      doctor: visit.staff ? { id: visit.staff.id, fullName: visit.staff.fullName } : null,
      finalDiagnosis: visit.finalConclusion?.finalDiagnosis ?? null,
    }));
  }

  async getVisitDetail(userId: string, patientId: string, visitId: string) {
    const access = await this.requireAccess(userId, patientId, 'visits');
    if (!access.canViewVisits) throw new ForbiddenException('Tài khoản không có quyền xem lịch sử khám của hồ sơ này.');

    const visit = await this.prisma.visit.findFirst({
      where: { id: visitId, patientId },
      include: {
        patient: true,
        department: true,
        staff: { include: { doctorProfile: true } },
        finalConclusion: { include: { doctor: { include: { staffProfile: true } } } },
        medicalOrders: {
          include: {
            targetDepartment: true,
            results: {
              include: { files: true, performedBy: { select: { id: true, username: true, role: true } } },
              orderBy: { returnedAt: 'desc' },
            },
          },
          orderBy: { orderedAt: 'desc' },
        },
      },
    });

    if (!visit) throw new NotFoundException('Không tìm thấy hồ sơ khám.');

    return {
      id: visit.id,
      visitCode: visit.visitCode,
      status: visit.status,
      checkInAt: visit.checkInAt,
      completedAt: visit.completedAt,
      reason: visit.reason,
      symptoms: visit.symptoms,
      initialDiagnosis: visit.initialDiagnosis,
      note: visit.note,
      patient: this.toPatientSummary(visit.patient),
      department: visit.department ? { id: visit.department.id, name: visit.department.name, type: visit.department.type } : null,
      doctor: visit.staff ? { id: visit.staff.id, fullName: visit.staff.fullName } : null,
      conclusion: visit.finalConclusion ? {
        id: visit.finalConclusion.id,
        finalDiagnosis: visit.finalConclusion.finalDiagnosis,
        treatmentPlan: visit.finalConclusion.treatmentPlan,
        prescription: visit.finalConclusion.prescription,
        followUpNote: visit.finalConclusion.followUpNote,
        doctorNote: visit.finalConclusion.doctorNote,
        concludedAt: visit.finalConclusion.concludedAt,
        doctor: visit.finalConclusion.doctor?.staffProfile?.fullName ?? null,
      } : null,
      orders: visit.medicalOrders.map((order) => ({
        id: order.id,
        orderCode: order.orderCode,
        orderType: order.orderType,
        priority: order.priority,
        clinicalNote: order.clinicalNote,
        status: order.status,
        orderedAt: order.orderedAt,
        completedAt: order.completedAt,
        targetDepartment: order.targetDepartment ? { id: order.targetDepartment.id, name: order.targetDepartment.name } : null,
        results: access.canViewResults ? order.results.map((result) => ({
          id: result.id,
          resultCode: result.resultCode,
          note: result.note,
          returnedAt: result.returnedAt,
          files: result.files.map((file) => ({
            id: file.id,
            originalName: file.originalName,
            mimeType: file.mimeType,
            size: file.size,
            storageProvider: file.storageProvider,
            isImage: file.mimeType.startsWith('image/'),
            downloadPath: `/patient/me/profiles/${patientId}/files/${file.id}/download`,
          })),
        })) : [],
      })),
    };
  }

  async getResultFileDownloadUrl(userId: string, patientId: string, fileId: string) {
    const access = await this.requireAccess(userId, patientId, 'visits');
    if (!access.canViewResults) throw new ForbiddenException('Tài khoản không có quyền xem kết quả của hồ sơ này.');

    const file = await this.prisma.medicalResultFile.findFirst({
      where: {
        id: fileId,
        result: {
          order: {
            patientId,
            visit: {
              patientId,
            },
          },
        },
      },
      include: {
        result: {
          include: {
            order: {
              include: { visit: true },
            },
          },
        },
      },
    });

    if (!file) throw new NotFoundException('Không tìm thấy file kết quả.');

    return this.resultStorage.buildSignedDownloadUrl({
      fileName: file.fileName,
      originalName: file.originalName,
      mimeType: file.mimeType,
      url: file.url,
      storageProvider: file.storageProvider,
      bucket: file.bucket,
      objectKey: file.objectKey,
    });
  }

  private async requireAccess(userId: string, patientId: string, scope: 'profile' | 'visits') {
    const access = await this.prisma.patientAccess.findUnique({
      where: { userId_patientId: { userId, patientId } },
      include: { patient: true },
    });

    if (!access || access.status !== 'ACTIVE') {
      throw new NotFoundException('Không tìm thấy hồ sơ bệnh nhân được liên kết.');
    }
    if (scope === 'profile' && !access.canViewProfile) {
      throw new ForbiddenException('Tài khoản không có quyền xem hồ sơ này.');
    }
    return access;
  }

  private toPatientSummary(patient: {
    id: string;
    patientCode: string;
    fullName: string;
    gender: string;
    birthDate: Date;
    citizenId: string | null;
    phone: string | null;
    address: string | null;
    insuranceNumber: string | null;
    emergencyContact: string | null;
  }) {
    return {
      id: patient.id,
      patientCode: patient.patientCode,
      fullName: patient.fullName,
      gender: patient.gender,
      birthDate: patient.birthDate,
      citizenId: patient.citizenId,
      contactPhone: patient.phone,
      address: patient.address,
      insuranceNumber: patient.insuranceNumber,
      emergencyContact: patient.emergencyContact,
    };
  }
}
