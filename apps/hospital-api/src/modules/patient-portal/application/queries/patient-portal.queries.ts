import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MedicalSpecialty } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { S3MedicalResultStorageAdapter } from '../../../medical-order/infrastructure/adapters/s3-medical-result-storage.adapter';
import { getMedicalSpecialtyLabel, getMedicalSpecialtyOptions } from '../../../doctor/medical-specialty';
import {
  appointmentInclude,
  toAiDiagnosisSummary,
  toAppointmentSummary,
  toAppointmentVerification,
  toPatientSummary,
} from '../../domain/patient-portal.mapper';
import {
  buildQrPayload,
  extractQrToken,
  generateDailySlots,
  generateQrToken,
  getQrExpiry,
  hashQrToken,
  startOfDay,
} from '../../domain/appointment-qr.util';
import { PatientPortalAccessService } from '../services/patient-portal-access.service';

@Injectable()
export class PatientPortalQueries {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resultStorage: S3MedicalResultStorageAdapter,
    private readonly accessService: PatientPortalAccessService,
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
      patient: toPatientSummary(access.patient),
    }));
  }

  async getProfile(userId: string, patientId: string) {
    const access = await this.accessService.requireAccess(userId, patientId, 'profile');
    return {
      relationship: access.relationship,
      permissions: {
        canViewProfile: access.canViewProfile,
        canViewVisits: access.canViewVisits,
        canViewResults: access.canViewResults,
        canBookVisit: access.canBookVisit,
      },
      patient: toPatientSummary(access.patient),
    };
  }

  async getVisits(userId: string, patientId: string) {
    const access = await this.accessService.requireAccess(userId, patientId, 'visits');
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
      source: visit.source,
      checkInAt: visit.checkInAt,
      completedAt: visit.completedAt,
      department: visit.department ? { id: visit.department.id, name: visit.department.name, type: visit.department.type } : null,
      doctor: visit.staff ? { id: visit.staff.id, fullName: visit.staff.fullName } : null,
      finalDiagnosis: visit.finalConclusion?.finalDiagnosis ?? null,
    }));
  }

  async getVisitDetail(userId: string, patientId: string, visitId: string) {
    const access = await this.accessService.requireAccess(userId, patientId, 'visits');
    if (!access.canViewVisits) throw new ForbiddenException('Tài khoản không có quyền xem lịch sử khám của hồ sơ này.');

    const visit = await this.prisma.visit.findFirst({
      where: { id: visitId, patientId },
      include: {
        patient: true,
        department: true,
        staff: { include: { doctorProfile: true } },
        finalConclusion: { include: { doctor: { include: { staffProfile: true } } } },
        aiDiagnoses: { include: { aiModel: true }, orderBy: { createdAt: 'desc' } },
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
      source: visit.source,
      checkInAt: visit.checkInAt,
      completedAt: visit.completedAt,
      patient: toPatientSummary(visit.patient),
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
      aiDiagnoses: visit.aiDiagnoses.map((item) => toAiDiagnosisSummary(item)),
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
    const access = await this.accessService.requireAccess(userId, patientId, 'visits');
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

  async getBookableSpecialties() {
    const grouped = await this.prisma.doctorProfile.groupBy({
      by: ['specialty'],
      where: {
        staffProfile: {
          departmentId: { not: null },
          user: { role: 'DOCTOR', status: 'ACTIVE' },
          department: { status: 'ACTIVE', type: { in: ['EXAMINATION', 'CLINICAL'] } },
        },
      },
      _count: { _all: true },
      orderBy: { specialty: 'asc' },
    });
    const counts = new Map(grouped.map((item) => [item.specialty, item._count._all]));
    return getMedicalSpecialtyOptions()
      .filter((option) => counts.has(option.value))
      .map((option) => ({ ...option, doctorCount: counts.get(option.value) ?? 0 }));
  }

  async getSpecialtyDoctors(specialty: MedicalSpecialty) {
    const doctors = await this.prisma.doctorProfile.findMany({
      where: {
        specialty,
        staffProfile: {
          departmentId: { not: null },
          user: { role: 'DOCTOR', status: 'ACTIVE' },
          department: { status: 'ACTIVE', type: { in: ['EXAMINATION', 'CLINICAL'] } },
        },
      },
      include: { staffProfile: { include: { department: true } } },
      orderBy: { staffProfile: { fullName: 'asc' } },
    });

    return doctors.map((doctor) => ({
      id: doctor.id,
      staffProfileId: doctor.staffProfileId,
      fullName: doctor.staffProfile.fullName,
      specialty: doctor.specialty,
      specialtyLabel: getMedicalSpecialtyLabel(doctor.specialty),
      qualification: doctor.qualification,
      yearsExperience: doctor.yearsExperience,
      department: doctor.staffProfile.department ? {
        id: doctor.staffProfile.department.id,
        departmentCode: doctor.staffProfile.department.departmentCode,
        name: doctor.staffProfile.department.name,
        floor: doctor.staffProfile.department.floor,
      } : null,
    }));
  }

  async getDoctorSlots(doctorId: string, dateInput: string) {
    const doctor = await this.prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      include: { staffProfile: true },
    });
    if (!doctor || !doctor.staffProfile.departmentId) throw new NotFoundException('Không tìm thấy bác sĩ có thể đặt lịch.');

    const dayStart = startOfDay(dateInput);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        scheduledAt: { gte: dayStart, lt: dayEnd },
        status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
      },
      select: { scheduledAt: true },
    });
    const booked = new Set(appointments.map((appointment) => appointment.scheduledAt.toISOString()));
    const now = new Date();

    return generateDailySlots(dayStart).map((startAt) => ({
      startAt: startAt.toISOString(),
      available: startAt.getTime() > now.getTime() && !booked.has(startAt.toISOString()),
    }));
  }

  async getAppointments(userId: string, patientId?: string) {
    const accesses = await this.prisma.patientAccess.findMany({
      where: { userId, status: 'ACTIVE', ...(patientId ? { patientId } : {}) },
      select: { patientId: true },
    });
    if (patientId && !accesses.length) throw new NotFoundException('Không tìm thấy hồ sơ bệnh nhân được liên kết.');

    const appointments = await this.prisma.appointment.findMany({
      where: { patientId: { in: accesses.map((access) => access.patientId) } },
      include: appointmentInclude(),
      orderBy: { scheduledAt: 'desc' },
    });

    return appointments.map((appointment) => toAppointmentSummary(appointment));
  }

  async getAppointmentQr(userId: string, appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: appointmentInclude(),
    });
    if (!appointment) throw new NotFoundException('Không tìm thấy lịch hẹn.');
    await this.accessService.requireAccess(userId, appointment.patientId, 'booking');
    if (!['PENDING', 'CONFIRMED'].includes(appointment.status)) {
      throw new BadRequestException('Lịch hẹn không còn hiệu lực để lấy mã QR.');
    }

    const rawQrToken = generateQrToken();
    const updated = await this.prisma.appointment.update({
      where: { id: appointment.id },
      data: { qrTokenHash: hashQrToken(rawQrToken), qrExpiresAt: getQrExpiry(appointment.scheduledAt) },
      include: appointmentInclude(),
    });

    return { ...toAppointmentSummary(updated), qrPayload: buildQrPayload(rawQrToken) };
  }

  async verifyAppointmentQr(qrPayload: string) {
    const qrTokenHash = hashQrToken(extractQrToken(qrPayload));
    const appointment = await this.prisma.appointment.findUnique({
      where: { qrTokenHash },
      include: appointmentInclude(),
    });
    if (!appointment) throw new NotFoundException('Không tìm thấy lịch hẹn từ mã QR.');
    this.accessService.assertAppointmentCanCheckIn(appointment);
    return toAppointmentVerification(appointment);
  }
}