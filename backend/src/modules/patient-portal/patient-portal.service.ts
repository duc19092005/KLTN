import * as crypto from 'crypto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MedicalSpecialty, Prisma, PrismaClient, VisitSource, VisitStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { S3MedicalResultStorageAdapter } from '../medical-order/infrastructure/adapters/s3-medical-result-storage.adapter';
import { AuditLoggerService } from '../../infrastructure/audit/audit-logger.service';
import { AuthUser } from '../../common/types/auth-user.type';
import { getMedicalSpecialtyLabel, getMedicalSpecialtyOptions } from '../doctor/medical-specialty';
import { CheckInAppointmentDto, CreateAppointmentDto, CreatePatientProfileFromPortalDto } from './patient-booking.dto';

const QR_PREFIX = 'KLTN_APPOINTMENT_CHECKIN:';
const SLOT_MINUTES = 30;
const APPOINTMENT_QR_GRACE_HOURS = 2;
const BOOKING_LOOKAHEAD_DAYS = 60;

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'> | Prisma.TransactionClient;

@Injectable()
export class PatientPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resultStorage: S3MedicalResultStorageAdapter,
    private readonly auditLogger: AuditLoggerService,
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

  async createProfile(userId: string, dto: CreatePatientProfileFromPortalDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, phoneNormalized: true },
    });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản bệnh nhân.');

    if (dto.citizenId) {
      const existingCitizen = await this.prisma.patient.findUnique({
        where: { citizenId: dto.citizenId.trim() },
        select: { id: true, patientCode: true, fullName: true },
      });
      if (existingCitizen) {
        throw new BadRequestException(`CCCD/CMND đã tồn tại trong hệ thống (mã BN: ${existingCitizen.patientCode}).`);
      }
    }

    const patient = await this.prisma.$transaction(async (tx) => {
      const patientCode = await this.generatePatientCode(tx);
      const createdPatient = await tx.patient.create({
        data: {
          patientCode,
          fullName: dto.fullName.trim(),
          gender: dto.gender.trim(),
          birthDate: new Date(dto.birthDate),
          citizenId: dto.citizenId?.trim() || null,
          phone: dto.phone?.trim() || user.phone || this.toLocalPhone(user.phoneNormalized),
          address: dto.address?.trim() || null,
          insuranceNumber: dto.insuranceNumber?.trim() || null,
          emergencyContact: dto.emergencyContact?.trim() || null,
        },
      });

      await tx.patientAccess.create({
        data: {
          userId,
          patientId: createdPatient.id,
          relationship: 'SELF',
          status: 'ACTIVE',
          canViewProfile: true,
          canViewVisits: true,
          canViewResults: true,
          canBookVisit: true,
          verifiedAt: new Date(),
        },
      });

      return createdPatient;
    });

    await this.safeAudit({
      entity: 'Patient',
      entityId: patient.id,
      action: 'CREATE',
      actorId: userId,
      after: {
        patientCode: patient.patientCode,
        phonePresent: Boolean(patient.phone),
        citizenIdPresent: Boolean(patient.citizenId),
      },
      metadata: { schema: 'KLTN_PATIENT_PORTAL_PROFILE_CREATE_V1' },
    });

    return this.toPatientSummary(patient);
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
      source: visit.source,
      checkInAt: visit.checkInAt,
      completedAt: visit.completedAt,
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
      aiDiagnoses: visit.aiDiagnoses.map((item) => this.toAiDiagnosisSummary(item)),
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

  private toAiDiagnosisSummary(aiDiagnosis: any) {
    return {
      id: aiDiagnosis.id,
      result: aiDiagnosis.result,
      confidence: aiDiagnosis.confidence,
      status: aiDiagnosis.status,
      createdAt: aiDiagnosis.createdAt,
      aiModel: aiDiagnosis.aiModel ? {
        id: aiDiagnosis.aiModel.id,
        modelName: aiDiagnosis.aiModel.modelName,
        modelVersion: aiDiagnosis.aiModel.modelVersion,
        provider: aiDiagnosis.aiModel.provider,
      } : null,
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

    const dayStart = this.startOfDay(dateInput);
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

    return this.generateDailySlots(dayStart).map((startAt) => ({
      startAt: startAt.toISOString(),
      available: startAt.getTime() > now.getTime() && !booked.has(startAt.toISOString()),
    }));
  }

  async createAppointment(userId: string, dto: CreateAppointmentDto) {
    await this.requireAccess(userId, dto.patientId, 'booking');
    const scheduledAt = new Date(dto.scheduledAt);
    this.assertBookableScheduledAt(scheduledAt);

    const doctor = await this.prisma.doctorProfile.findUnique({
      where: { id: dto.doctorId },
      include: { staffProfile: { include: { department: true } } },
    });
    if (!doctor || doctor.staffProfile.userId === null || !doctor.staffProfile.departmentId || !doctor.staffProfile.department) {
      throw new BadRequestException('Bác sĩ không hợp lệ để đặt lịch.');
    }
    if (doctor.specialty !== dto.specialty) {
      throw new BadRequestException('Bác sĩ không thuộc chuyên khoa đã chọn.');
    }
    if (doctor.staffProfile.department.status !== 'ACTIVE' || !['EXAMINATION', 'CLINICAL'].includes(doctor.staffProfile.department.type)) {
      throw new BadRequestException('Phòng ban của bác sĩ không hợp lệ để đặt lịch.');
    }
    await this.assertDoctorSlotAvailable(dto.doctorId, scheduledAt);
    const departmentId = doctor.staffProfile.departmentId;
    const doctorStaffId = doctor.staffProfileId;

    const rawQrToken = this.generateQrToken();
    const qrTokenHash = this.hashQrToken(rawQrToken);
    const appointment = await this.prisma.$transaction(async (tx) => {
      const appointmentCode = await this.generateAppointmentCode(tx);
      return tx.appointment.create({
        data: {
          appointmentCode,
          patientId: dto.patientId,
          departmentId,
          doctorId: dto.doctorId ?? null,
          scheduledAt,
          status: 'CONFIRMED',
          qrTokenHash,
          qrExpiresAt: this.getQrExpiry(scheduledAt),
          createdByUserId: userId,
        },
        include: this.appointmentInclude(),
      });
    });

    await this.safeAudit({
      entity: 'Appointment',
      entityId: appointment.id,
      action: 'CREATE',
      actorId: userId,
      after: {
        appointmentCode: appointment.appointmentCode,
        patientId: appointment.patientId,
        departmentId: appointment.departmentId,
        doctorId: appointment.doctorId,
        scheduledAt: appointment.scheduledAt,
        status: appointment.status,
        doctorStaffId,
      },
      metadata: { schema: 'KLTN_APPOINTMENT_CREATE_AUDIT_V1' },
    });

    return { ...this.toAppointmentSummary(appointment), qrPayload: this.buildQrPayload(rawQrToken) };
  }

  async getAppointments(userId: string, patientId?: string) {
    const accesses = await this.prisma.patientAccess.findMany({
      where: { userId, status: 'ACTIVE', ...(patientId ? { patientId } : {}) },
      select: { patientId: true },
    });
    if (patientId && !accesses.length) throw new NotFoundException('Không tìm thấy hồ sơ bệnh nhân được liên kết.');

    const appointments = await this.prisma.appointment.findMany({
      where: { patientId: { in: accesses.map((access) => access.patientId) } },
      include: this.appointmentInclude(),
      orderBy: { scheduledAt: 'desc' },
    });

    return appointments.map((appointment) => this.toAppointmentSummary(appointment));
  }

  async getAppointmentQr(userId: string, appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: this.appointmentInclude(),
    });
    if (!appointment) throw new NotFoundException('Không tìm thấy lịch hẹn.');
    await this.requireAccess(userId, appointment.patientId, 'booking');
    if (!['PENDING', 'CONFIRMED'].includes(appointment.status)) {
      throw new BadRequestException('Lịch hẹn không còn hiệu lực để lấy mã QR.');
    }

    const rawQrToken = this.generateQrToken();
    const updated = await this.prisma.appointment.update({
      where: { id: appointment.id },
      data: { qrTokenHash: this.hashQrToken(rawQrToken), qrExpiresAt: this.getQrExpiry(appointment.scheduledAt) },
      include: this.appointmentInclude(),
    });

    return { ...this.toAppointmentSummary(updated), qrPayload: this.buildQrPayload(rawQrToken) };
  }

  async cancelAppointment(userId: string, appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appointment) throw new NotFoundException('Không tìm thấy lịch hẹn.');
    await this.requireAccess(userId, appointment.patientId, 'booking');
    if (!['PENDING', 'CONFIRMED'].includes(appointment.status)) {
      throw new BadRequestException('Chỉ có thể hủy lịch hẹn chưa check-in.');
    }

    const updated = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'PATIENT_CANCELLED' },
      include: this.appointmentInclude(),
    });

    await this.safeAudit({
      entity: 'Appointment',
      entityId: updated.id,
      action: 'UPDATE',
      actorId: userId,
      after: { appointmentCode: updated.appointmentCode, status: updated.status },
      metadata: { schema: 'KLTN_APPOINTMENT_CANCEL_AUDIT_V1' },
    });

    return this.toAppointmentSummary(updated);
  }

  async verifyAppointmentQr(qrPayload: string) {
    const appointment = await this.findAppointmentByQrPayload(qrPayload);
    this.assertAppointmentCanCheckIn(appointment);
    return this.toAppointmentVerification(appointment);
  }

  async checkInAppointment(dto: CheckInAppointmentDto, user: AuthUser) {
    const tokenHash = this.hashQrToken(this.extractQrToken(dto.qrPayload));
    const result = await this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { qrTokenHash: tokenHash },
        include: this.appointmentInclude(),
      });
      if (!appointment) throw new NotFoundException('Không tìm thấy lịch hẹn từ mã QR.');
      this.assertAppointmentCanCheckIn(appointment);

      const visitCode = await this.generateVisitCode(tx);
      const visit = await tx.visit.create({
        data: {
          visitCode,
          patientId: appointment.patientId,
          departmentId: appointment.departmentId,
          staffId: appointment.doctor?.staffProfileId ?? null,
          source: VisitSource.APPOINTMENT,
          status: VisitStatus.WAITING,
        },
        include: {
          patient: true,
          department: true,
          staff: true,
        },
      });

      const checkedInAppointment = await tx.appointment.update({
        where: { id: appointment.id },
        data: { status: 'CHECKED_IN', checkedInAt: new Date(), visitId: visit.id },
        include: this.appointmentInclude(),
      });

      return { appointment: checkedInAppointment, visit };
    });

    await this.safeAudit({
      entity: 'Appointment',
      entityId: result.appointment.id,
      action: 'UPDATE',
      actorId: user.sub,
      after: {
        appointmentCode: result.appointment.appointmentCode,
        status: result.appointment.status,
        visitId: result.visit.id,
      },
      metadata: { schema: 'KLTN_APPOINTMENT_CHECKIN_AUDIT_V1' },
    });

    await this.safeAudit({
      entity: 'Visit',
      entityId: result.visit.id,
      action: 'CREATE',
      actorId: user.sub,
      after: {
        visitCode: result.visit.visitCode,
        patientId: result.visit.patientId,
        departmentId: result.visit.departmentId,
        staffId: result.visit.staffId,
        status: result.visit.status,
        source: result.visit.source,
      },
      metadata: { schema: 'KLTN_VISIT_FROM_APPOINTMENT_AUDIT_V1' },
    });

    return {
      appointment: this.toAppointmentSummary(result.appointment),
      visit: result.visit,
    };
  }

  private async requireAccess(userId: string, patientId: string, scope: 'profile' | 'visits' | 'booking') {
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
    if (scope === 'booking' && !access.canBookVisit) {
      throw new ForbiddenException('Tài khoản không có quyền đặt lịch cho hồ sơ này.');
    }
    return access;
  }

  private async requireBookableDepartment(departmentId: string) {
    const department = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!department || department.status !== 'ACTIVE' || department.type !== 'EXAMINATION') {
      throw new BadRequestException('Chuyên khoa/phòng khám không hợp lệ để đặt lịch.');
    }
    return department;
  }

  private async assertDoctorSlotAvailable(doctorId: string, scheduledAt: Date) {
    const existing = await this.prisma.appointment.findFirst({
      where: {
        doctorId,
        scheduledAt,
        status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
      },
      select: { id: true },
    });
    if (existing) throw new BadRequestException('Khung giờ này đã có lịch hẹn. Vui lòng chọn giờ khác.');
  }

  private assertBookableScheduledAt(scheduledAt: Date) {
    if (Number.isNaN(scheduledAt.getTime())) throw new BadRequestException('Thời gian đặt lịch không hợp lệ.');
    const now = new Date();
    if (scheduledAt.getTime() <= now.getTime()) throw new BadRequestException('Thời gian đặt lịch phải ở tương lai.');
    const latest = new Date(now);
    latest.setDate(latest.getDate() + BOOKING_LOOKAHEAD_DAYS);
    if (scheduledAt.getTime() > latest.getTime()) throw new BadRequestException(`Chỉ có thể đặt lịch trong ${BOOKING_LOOKAHEAD_DAYS} ngày tới.`);
  }

  private async findAppointmentByQrPayload(qrPayload: string) {
    const qrTokenHash = this.hashQrToken(this.extractQrToken(qrPayload));
    const appointment = await this.prisma.appointment.findUnique({
      where: { qrTokenHash },
      include: this.appointmentInclude(),
    });
    if (!appointment) throw new NotFoundException('Không tìm thấy lịch hẹn từ mã QR.');
    return appointment;
  }

  private assertAppointmentCanCheckIn(appointment: { status: string; qrExpiresAt: Date; visitId: string | null }) {
    if (appointment.visitId || appointment.status === 'CHECKED_IN') throw new BadRequestException('Lịch hẹn đã được check-in.');
    if (!['PENDING', 'CONFIRMED'].includes(appointment.status)) throw new BadRequestException('Lịch hẹn không còn hiệu lực.');
    if (appointment.qrExpiresAt.getTime() < Date.now()) throw new BadRequestException('Mã QR lịch hẹn đã hết hạn.');
  }

  private appointmentInclude() {
    return {
      patient: true,
      department: true,
      doctor: { include: { staffProfile: true } },
      visit: true,
    } as const;
  }

  private toAppointmentSummary(appointment: any) {
    return {
      id: appointment.id,
      appointmentCode: appointment.appointmentCode,
      scheduledAt: appointment.scheduledAt,
      status: appointment.status,
      qrExpiresAt: appointment.qrExpiresAt,
      checkedInAt: appointment.checkedInAt,
      patient: appointment.patient ? this.toPatientSummary(appointment.patient) : null,
      department: appointment.department ? { id: appointment.department.id, name: appointment.department.name, type: appointment.department.type, floor: appointment.department.floor } : null,
      doctor: appointment.doctor ? { id: appointment.doctor.id, fullName: appointment.doctor.staffProfile.fullName, specialty: appointment.doctor.specialty } : null,
      visitId: appointment.visitId,
    };
  }

  private toAppointmentVerification(appointment: any) {
    return {
      appointment: this.toAppointmentSummary(appointment),
      patient: appointment.patient ? this.toPatientSummary(appointment.patient) : null,
      department: appointment.department ? { id: appointment.department.id, name: appointment.department.name, type: appointment.department.type } : null,
      doctor: appointment.doctor ? { id: appointment.doctor.id, fullName: appointment.doctor.staffProfile.fullName, specialty: appointment.doctor.specialty } : null,
    };
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

  private generateDailySlots(dayStart: Date) {
    const slots: Date[] = [];
    for (const hour of [8, 9, 10, 13, 14, 15, 16]) {
      for (const minute of [0, SLOT_MINUTES]) {
        const slot = new Date(dayStart);
        slot.setHours(hour, minute, 0, 0);
        slots.push(slot);
      }
    }
    return slots;
  }

  private startOfDay(dateInput: string) {
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Ngày không hợp lệ.');
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private getQrExpiry(scheduledAt: Date) {
    return new Date(scheduledAt.getTime() + APPOINTMENT_QR_GRACE_HOURS * 60 * 60 * 1000);
  }

  private buildQrPayload(rawToken: string) {
    return `${QR_PREFIX}${rawToken}`;
  }

  private extractQrToken(qrPayload: string) {
    const rawToken = qrPayload.startsWith(QR_PREFIX) ? qrPayload.slice(QR_PREFIX.length) : qrPayload;
    if (!rawToken || rawToken.length < 32) throw new BadRequestException('Mã QR không hợp lệ.');
    return rawToken;
  }

  private generateQrToken() {
    return crypto.randomBytes(32).toString('base64url');
  }

  private hashQrToken(rawToken: string) {
    const secret = process.env.APPOINTMENT_QR_SECRET || process.env.JWT_SECRET || 'dev-appointment-qr-secret';
    return crypto.createHmac('sha256', secret).update(rawToken).digest('hex');
  }

  private async generatePatientCode(tx: TxClient) {
    const latest = await tx.patient.findFirst({ where: { patientCode: { startsWith: 'BN-' } }, orderBy: { patientCode: 'desc' }, select: { patientCode: true } });
    const lastNumber = Number(latest?.patientCode?.replace('BN-', '') || '0');
    return `BN-${String(lastNumber + 1).padStart(4, '0')}`;
  }

  private async generateVisitCode(tx: TxClient) {
    const latest = await tx.visit.findFirst({ where: { visitCode: { startsWith: 'VISIT-' } }, orderBy: { visitCode: 'desc' }, select: { visitCode: true } });
    const lastNumber = Number(latest?.visitCode?.replace('VISIT-', '') || '0');
    return `VISIT-${String(lastNumber + 1).padStart(4, '0')}`;
  }

  private async generateAppointmentCode(tx: TxClient) {
    const prefix = `AP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-`;
    const latest = await tx.appointment.findFirst({ where: { appointmentCode: { startsWith: prefix } }, orderBy: { appointmentCode: 'desc' }, select: { appointmentCode: true } });
    const lastNumber = Number(latest?.appointmentCode?.replace(prefix, '') || '0');
    return `${prefix}${String(lastNumber + 1).padStart(4, '0')}`;
  }

  private toLocalPhone(phoneNormalized: string | null) {
    if (!phoneNormalized) return null;
    return phoneNormalized.startsWith('84') ? `0${phoneNormalized.slice(2)}` : phoneNormalized;
  }

  private async safeAudit(input: {
    entity: string;
    entityId: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    actorId: string | null;
    after: Record<string, unknown> | null;
    metadata: Record<string, unknown>;
  }) {
    try {
      await this.auditLogger.recordV2({
        entity: input.entity,
        entityId: input.entityId,
        action: input.action,
        actorId: input.actorId,
        before: null,
        after: input.after,
        metadata: input.metadata,
      });
    } catch (error) {
      console.error(`Failed to write audit log for ${input.entity}:`, error);
    }
  }
}
