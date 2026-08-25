import { ConflictException } from '@nestjs/common';
import {
  AppointmentStatus,
  DepartmentType,
  LabSpecialty,
  MedicalOrderStatus,
  MedicalSpecialty,
  OperationalStatus,
  Prisma,
  UserRole,
  UserStatus,
  VisitSource,
  VisitStatus,
} from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPatientSnapshot } from '../../../modules/patient/domain/patient-snapshot';
import { buildDepartmentSnapshot } from '../../../modules/department/domain/department-snapshot';
import { buildStaffSnapshot } from '../../../modules/staff/domain/staff-snapshot';
import { buildUnifiedDoctorSnapshot } from '../../../modules/doctor/domain/doctor-snapshot';
import { buildAiModelSnapshot } from '../../../modules/ai-model/domain/ai-model-snapshot';
import { buildMedicalConclusionSnapshot } from '../../../modules/clinical-decision/domain/medical-conclusion-snapshot';
import { buildAiDiagnosisSnapshot } from '../../../modules/clinical-decision/domain/ai-diagnosis-snapshot';
import { buildVisitSnapshot } from '../../../modules/visit/domain/visit-snapshot';
import { buildMedicalOrderSnapshot } from '../../../modules/medical-order/domain/medical-order-snapshot';
import { buildMedicalResultSnapshot } from '../../../modules/medical-order/domain/medical-result-snapshot';
import { buildAppointmentSnapshot } from '../../../modules/patient-portal/domain/appointment-snapshot';
import { buildAiQualitySnapshot } from '../../../modules/ai-model/domain/ai-quality-snapshot';
import { RecoverableAuditEntity } from './entity-registry.config';

const QR_SECRET = process.env.APPOINTMENT_QR_SECRET || process.env.JWT_SECRET || 'dev-appointment-qr-secret';

type Snapshot = Record<string, unknown>;
type DbClient = PrismaService | Prisma.TransactionClient;

export interface EntityRecreationTarget {
  entity: RecoverableAuditEntity;
  entityId: string;
}

export async function createEntitySnapshotData(
  client: Prisma.TransactionClient,
  target: EntityRecreationTarget,
  snapshot: Snapshot,
): Promise<void> {
  if (target.entity === 'Patient') {
    await client.patient.create({ data: {
      id: target.entityId, patientCode: parseString(snapshot, 'patientCode'), fullName: parseString(snapshot, 'fullName'),
      gender: parseString(snapshot, 'gender'), birthDate: parseDate(snapshot, 'birthDate'), citizenId: parseNullableString(snapshot, 'citizenId'),
      phone: parseNullableString(snapshot, 'phone'), address: parseNullableString(snapshot, 'address'),
      insuranceNumber: parseNullableString(snapshot, 'insuranceNumber'), emergencyContact: parseNullableString(snapshot, 'emergencyContact'),
    } });
    return;
  }
  if (target.entity === 'Department') {
    await client.department.create({ data: {
      id: target.entityId, departmentCode: parseString(snapshot, 'departmentCode'), name: parseString(snapshot, 'name'),
      floor: parseNullableString(snapshot, 'floor'), status: parseEnumValue(snapshot, 'status', OperationalStatus),
      type: parseEnumValue(snapshot, 'type', DepartmentType), canReceiveOrders: parseBoolean(snapshot, 'canReceiveOrders'),
      description: parseNullableString(snapshot, 'description'), managerId: parseNullableString(snapshot, 'managerId'),
      deletedAt: null, deletedBy: null, restoredAt: new Date(),
    } });
    return;
  }
  if (target.entity === 'StaffProfile') {
    const envelope = requireRecoveryEnvelope(snapshot);
    const userId = await ensureUserRecord(client, envelope.user, null, target.entityId);
    await client.staffProfile.create({ data: {
      id: target.entityId, userId, ...staffCreateData(snapshot, envelope.staff),
    } });
    return;
  }
  if (target.entity === 'DoctorProfile') {
    const staffProfileId = parseString(snapshot, 'staffProfileId');
    let staff = await client.staffProfile.findUnique({ where: { id: staffProfileId }, select: { id: true } });
    if (!staff) {
      const envelope = requireRecoveryEnvelope(snapshot);
      const userId = await ensureUserRecord(client, envelope.user, UserRole.DOCTOR, staffProfileId);
      staff = await client.staffProfile.create({ data: {
        id: staffProfileId, userId, ...staffCreateData(snapshot, envelope.staff),
      }, select: { id: true } });
    }
    await client.doctorProfile.create({ data: {
      id: target.entityId, staffProfileId: staff.id,
      specialty: parseEnumValue(snapshot, 'specialty', MedicalSpecialty), licenseNumber: parseString(snapshot, 'licenseNumber'),
      qualification: parseString(snapshot, 'qualification'), yearsExperience: parseNullableNumber(snapshot, 'yearsExperience'),
    } });
    return;
  }
  if (target.entity === 'AiModelRegistry') {
    const details = requireRecoveryEnvelope(snapshot).entity;
    await client.aiModelRegistry.create({ data: {
      id: target.entityId, modelId: parseString(details, 'modelId'), modelName: parseString(snapshot, 'modelName'),
      modelVersion: parseString(snapshot, 'modelVersion'), recommendedSpecialty: parseNullableString(snapshot, 'recommendedSpecialty'),
      ipHashEncrypted: parseString(details, 'ipHashEncrypted'), ipHashPlain: parseNullableString(snapshot, 'ipHashPlain'),
      apiEndpoint: parseNullableString(snapshot, 'apiEndpoint'), provider: parseNullableString(snapshot, 'provider'),
      isActiveOnChain: optionalBoolean(details, 'isActiveOnChain', false), description: parseNullableString(snapshot, 'description'),
      createdBy: parseString(snapshot, 'createdBy'), type: parseNullableString(snapshot, 'type'),
      status: parseEnumValue(snapshot, 'status', OperationalStatus), isDeleted: false,
      deletedAt: null, deletedBy: null, restoredAt: new Date(),
    } });
    return;
  }
  if (target.entity === 'Visit') {
    await client.visit.create({ data: {
      id: target.entityId,
      visitCode: parseString(snapshot, 'visitCode'),
      patientId: parseString(snapshot, 'patientId'),
      departmentId: parseString(snapshot, 'departmentId'),
      staffId: parseNullableString(snapshot, 'staffId'),
      status: parseEnumValue(snapshot, 'status', VisitStatus),
      source: parseEnumValue(snapshot, 'source', VisitSource),
      checkInAt: parseDate(snapshot, 'checkInAt'),
      completedAt: parseNullableDate(snapshot, 'completedAt'),
    } });
    return;
  }
  if (target.entity === 'AiDiagnosis') {
    await client.aiDiagnosis.create({ data: {
      id: target.entityId, aiModelId: parseString(snapshot, 'aiModelId'), patientId: parseNullableString(snapshot, 'patientId'),
      visitId: parseNullableString(snapshot, 'visitId'), prompt: parseNullableString(snapshot, 'prompt'),
      result: parseNullableString(snapshot, 'result'), confidence: parseNullableNumber(snapshot, 'confidence'),
      status: parseString(snapshot, 'status'), reviewedByDoctorId: parseNullableString(snapshot, 'reviewedByDoctorId'),
      doctorFeedback: parseNullableString(snapshot, 'doctorFeedback'),
    } });
    return;
  }
  if (target.entity === 'MedicalOrder') {
    await client.medicalOrder.create({ data: {
      id: target.entityId, orderCode: parseString(snapshot, 'orderCode'), visitId: parseString(snapshot, 'visitId'),
      patientId: parseString(snapshot, 'patientId'), doctorId: parseString(snapshot, 'doctorId'),
      targetDepartmentId: parseNullableString(snapshot, 'targetDepartmentId'),
      orderType: parseString(snapshot, 'orderType'), priority: parseNullableString(snapshot, 'priority') ?? 'NORMAL',
      clinicalNote: parseNullableString(snapshot, 'clinicalNote'),
      status: parseEnumValue(snapshot, 'status', MedicalOrderStatus),
    } });
    return;
  }
  if (target.entity === 'MedicalResult') {
    const result = await client.medicalResult.create({ data: {
      id: target.entityId, resultCode: parseString(snapshot, 'resultCode'), orderId: parseString(snapshot, 'orderId'),
      performedById: parseNullableString(snapshot, 'performedById'),
      note: parseNullableString(snapshot, 'note'),
      returnedAt: parseNullableDate(snapshot, 'returnedAt'),
      createdAt: parseNullableDate(snapshot, 'createdAt') ?? new Date(),
    } });
    const files = parseResultFiles(snapshot);
    if (files.length > 0) {
      await client.medicalResultFile.createMany({ data: files.map((file) => ({ ...file, resultId: result.id })) });
    }
    return;
  }
  if (target.entity === 'Appointment') {
    const rawQrToken = crypto.randomBytes(32).toString('base64url');
    const qrTokenHash = crypto.createHmac('sha256', QR_SECRET).update(rawQrToken).digest('hex');
    const scheduledAt = parseDate(snapshot, 'scheduledAt');
    await client.appointment.create({ data: {
      id: target.entityId, appointmentCode: parseString(snapshot, 'appointmentCode'),
      patientId: parseString(snapshot, 'patientId'), departmentId: parseString(snapshot, 'departmentId'),
      doctorId: parseNullableString(snapshot, 'doctorId'), scheduledAt,
      status: parseEnumValue(snapshot, 'status', AppointmentStatus),
      qrTokenHash, qrExpiresAt: new Date(scheduledAt.getTime() + 24 * 60 * 60 * 1000),
      checkedInAt: null, visitId: null, cancelledAt: null, cancelReason: null, createdByUserId: null,
    } });
    return;
  }
  if (target.entity === 'AiQuality') {
    await client.aiQuality.create({ data: {
      id: target.entityId, doctorId: parseString(snapshot, 'doctorId'), aiModelId: parseString(snapshot, 'aiModelId'),
      aiDiagnosisId: parseNullableString(snapshot, 'aiDiagnosisId'),
      doctorConclusionAboutModel: parseString(snapshot, 'doctorConclusionAboutModel'),
      trustablePercent: parseNumber(snapshot, 'trustablePercent'),
    } });
    return;
  }
  await client.medicalConclusion.create({ data: {
    id: target.entityId, visitId: parseString(snapshot, 'visitId'), doctorId: parseString(snapshot, 'doctorId'),
    aiDiagnosisId: parseNullableString(snapshot, 'aiDiagnosisId'), finalDiagnosis: parseString(snapshot, 'finalDiagnosis'),
    treatmentPlan: parseNullableString(snapshot, 'treatmentPlan'), prescription: parseNullableString(snapshot, 'prescription'),
    followUpNote: parseNullableString(snapshot, 'followUpNote'), doctorNote: parseNullableString(snapshot, 'doctorNote'),
  } });
}

export async function ensureUserRecord(
  client: Prisma.TransactionClient,
  value: Snapshot | undefined,
  expectedRole: UserRole | null,
  profileId: string,
): Promise<string> {
  if (!value) throw new ConflictException('Snapshot không có bản sao tài khoản đã mã hóa.');
  const id = parseString(value, 'id');
  const existing = await client.user.findUnique({
    where: { id },
    select: { id: true, role: true, staffProfile: { select: { id: true } } },
  });
  if (existing) {
    if (expectedRole ? existing.role !== expectedRole : !isStaffRole(existing.role)) {
      throw new ConflictException('Vai trò tài khoản hiện tại không khớp snapshot phục hồi.');
    }
    if (existing.staffProfile && existing.staffProfile.id !== profileId) {
      throw new ConflictException('Tài khoản hiện tại đã liên kết với hồ sơ nhân sự khác.');
    }
    await client.user.update({
      where: { id },
      data: {
        status: UserStatus.INACTIVE,
        deletedAt: null,
        deletedBy: null,
        restoredAt: new Date(),
        tokenVersion: { increment: 1 },
      },
    });
    return existing.id;
  }
  const role = parseEnumValue(value, 'role', UserRole);
  if (expectedRole ? role !== expectedRole : !isStaffRole(role)) {
    throw new ConflictException('Vai trò tài khoản trong snapshot không hợp lệ với entity.');
  }
  await client.user.create({ data: {
    id,
    username: parseNullableString(value, 'username'), email: parseNullableString(value, 'email'),
    phone: parseNullableString(value, 'phone'), phoneNormalized: parseNullableString(value, 'phoneNormalized'),
    passwordHash: parseNullableString(value, 'passwordHash'), role, status: UserStatus.INACTIVE,
    firstLogin: optionalBoolean(value, 'firstLogin', true), registrationStep: optionalNumber(value, 'registrationStep', 1),
    tokenVersion: optionalNumber(value, 'tokenVersion', 0) + 1, inviteToken: null, inviteTokenExpiry: null,
    faceEmbedding: parseNullableString(value, 'faceEmbedding'), faceHash: parseNullableString(value, 'faceHash'),
    faceModelVersion: parseNullableString(value, 'faceModelVersion'), faceEnrolledAt: parseNullableDate(value, 'faceEnrolledAt'),
    faceSampleCount: parseNullableNumber(value, 'faceSampleCount'), faceChallenge: null, faceChallengeExpiresAt: null,
    failedFaceAttempts: 0, faceLockedUntil: null, deletedAt: null, deletedBy: null, restoredAt: new Date(),
  } });
  return id;
}

export function staffCreateData(snapshot: Snapshot, details: Snapshot | undefined) {
  return {
    employeeCode: parseString(snapshot, 'employeeCode'), fullName: parseString(snapshot, 'fullName'),
    phone: parseString(snapshot, 'phone'), gender: parseString(snapshot, 'gender'), citizenId: parseString(snapshot, 'citizenId'),
    birthDate: parseDate(snapshot, 'birthDate'), address: parseNullableString(snapshot, 'address'), avatarUrl: parseString(snapshot, 'avatarUrl'),
    departmentId: parseNullableString(snapshot, 'departmentId'), position: parseNullableString(snapshot, 'position'),
    labSpecialty: details?.labSpecialty == null ? null : parseEnumValue(details, 'labSpecialty', LabSpecialty),
  };
}

export function isStaffRole(role: UserRole): boolean {
  return role === UserRole.RECEPTIONIST || role === UserRole.LAB_MANAGER;
}

export async function loadRecreationSnapshot(client: DbClient, target: EntityRecreationTarget): Promise<Snapshot | null> {
  if (target.entity === 'Patient') {
    const row = await client.patient.findUnique({ where: { id: target.entityId } });
    return row ? buildPatientSnapshot(row) : null;
  }
  if (target.entity === 'Department') {
    const row = await client.department.findUnique({ where: { id: target.entityId } });
    return row ? buildDepartmentSnapshot(row) : null;
  }
  if (target.entity === 'StaffProfile') {
    const row = await client.staffProfile.findUnique({ where: { id: target.entityId }, include: { user: true } });
    return row ? buildStaffSnapshot(row) : null;
  }
  if (target.entity === 'DoctorProfile') {
    const row = await client.doctorProfile.findUnique({ where: { id: target.entityId }, include: { staffProfile: { include: { user: true } } } });
    return row ? buildUnifiedDoctorSnapshot(row) : null;
  }
  if (target.entity === 'AiModelRegistry') {
    const row = await client.aiModelRegistry.findUnique({ where: { id: target.entityId } });
    return row ? buildAiModelSnapshot(row) : null;
  }
  if (target.entity === 'Visit') {
    const row = await client.visit.findUnique({ where: { id: target.entityId } });
    return row ? buildVisitSnapshot(row) : null;
  }
  if (target.entity === 'AiDiagnosis') {
    const row = await client.aiDiagnosis.findUnique({ where: { id: target.entityId } });
    return row ? buildAiDiagnosisSnapshot(row) as Snapshot : null;
  }
  if (target.entity === 'MedicalOrder') {
    const row = await client.medicalOrder.findUnique({ where: { id: target.entityId } });
    return row ? buildMedicalOrderSnapshot(row) as Snapshot : null;
  }
  if (target.entity === 'MedicalResult') {
    const row = await client.medicalResult.findUnique({
      where: { id: target.entityId },
      include: { files: true, order: { select: { visitId: true } } },
    });
    if (!row) return null;
    return buildMedicalResultSnapshot({ ...row, visitId: row.order?.visitId ?? null }) as Snapshot;
  }
  if (target.entity === 'Appointment') {
    const row = await client.appointment.findUnique({
      where: { id: target.entityId },
      include: { doctor: { select: { staffProfileId: true } } },
    });
    return row ? buildAppointmentSnapshot(row) as Snapshot : null;
  }
  if (target.entity === 'AiQuality') {
    const row = await client.aiQuality.findUnique({ where: { id: target.entityId } });
    return row ? buildAiQualitySnapshot(row) as Snapshot : null;
  }
  const row = await client.medicalConclusion.findUnique({ where: { id: target.entityId }, include: { visit: { include: { patient: true } } } });
  return row ? buildMedicalConclusionSnapshot(row) as Snapshot : null;
}

export function entityRecordExists(client: DbClient, target: EntityRecreationTarget): Promise<unknown> {
  if (target.entity === 'Patient') return client.patient.findUnique({ where: { id: target.entityId }, select: { id: true } });
  if (target.entity === 'Department') return client.department.findUnique({ where: { id: target.entityId }, select: { id: true } });
  if (target.entity === 'StaffProfile') return client.staffProfile.findUnique({ where: { id: target.entityId }, select: { id: true } });
  if (target.entity === 'DoctorProfile') return client.doctorProfile.findUnique({ where: { id: target.entityId }, select: { id: true } });
  if (target.entity === 'AiModelRegistry') return client.aiModelRegistry.findUnique({ where: { id: target.entityId }, select: { id: true } });
  if (target.entity === 'Visit') return client.visit.findUnique({ where: { id: target.entityId }, select: { id: true } });
  if (target.entity === 'AiDiagnosis') return client.aiDiagnosis.findUnique({ where: { id: target.entityId }, select: { id: true } });
  if (target.entity === 'MedicalOrder') return client.medicalOrder.findUnique({ where: { id: target.entityId }, select: { id: true } });
  if (target.entity === 'MedicalResult') return client.medicalResult.findUnique({ where: { id: target.entityId }, select: { id: true } });
  if (target.entity === 'Appointment') return client.appointment.findUnique({ where: { id: target.entityId }, select: { id: true } });
  if (target.entity === 'AiQuality') return client.aiQuality.findUnique({ where: { id: target.entityId }, select: { id: true } });
  return client.medicalConclusion.findUnique({ where: { id: target.entityId }, select: { id: true } });
}

export function businessSnapshot(snapshot: Snapshot): Snapshot {
  const { _recovery: _ignored, ...business } = snapshot;
  return business;
}

export function recoveryEnvelope(snapshot: Snapshot): { targetEntity?: string; user?: Snapshot; staff?: Snapshot; entity?: Snapshot } | null {
  const value = asObject(snapshot._recovery);
  if (!value || value.schema !== 'KLTN_ENTITY_RECOVERY_V1') return null;
  return {
    targetEntity: typeof value.targetEntity === 'string' ? value.targetEntity : undefined,
    user: asObject(value.user) ?? undefined,
    staff: asObject(value.staff) ?? undefined,
    entity: asObject(value.entity) ?? undefined,
  };
}

export function requireRecoveryEnvelope(snapshot: Snapshot) {
  const envelope = recoveryEnvelope(snapshot);
  if (!envelope) throw new ConflictException('Snapshot không có recovery envelope đã mã hóa.');
  return envelope;
}

export function asObject(value: unknown): Snapshot | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Snapshot : null;
}

export function parseString(snapshot: Snapshot, field: string): string {
  const value = snapshot[field];
  if (typeof value !== 'string' || !value.trim()) throw new ConflictException(`Snapshot thiếu trường bắt buộc: ${field}.`);
  return value;
}

export function parseNullableString(snapshot: Snapshot, field: string): string | null {
  const value = snapshot[field];
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new ConflictException(`Snapshot có kiểu dữ liệu không hợp lệ: ${field}.`);
  return value;
}

export function parseNullableNumber(snapshot: Snapshot, field: string): number | null {
  const value = snapshot[field];
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ConflictException(`Snapshot có số không hợp lệ: ${field}.`);
  return value;
}

export function parseNumber(snapshot: Snapshot, field: string): number {
  const value = snapshot[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ConflictException(`Snapshot có số không hợp lệ: ${field}.`);
  return value;
}

export function parseBoolean(snapshot: Snapshot, field: string): boolean {
  const value = snapshot[field];
  if (typeof value !== 'boolean') throw new ConflictException(`Snapshot có boolean không hợp lệ: ${field}.`);
  return value;
}

export function optionalBoolean(snapshot: Snapshot, field: string, fallback: boolean): boolean {
  const value = snapshot[field];
  if (value == null) return fallback;
  if (typeof value !== 'boolean') throw new ConflictException(`Snapshot có boolean không hợp lệ: ${field}.`);
  return value;
}

export function optionalNumber(snapshot: Snapshot, field: string, fallback: number): number {
  return parseNullableNumber(snapshot, field) ?? fallback;
}

export function parseDate(snapshot: Snapshot, field: string): Date {
  const value = snapshot[field];
  const date = typeof value === 'string' || value instanceof Date ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) throw new ConflictException(`Snapshot có ngày không hợp lệ: ${field}.`);
  return date;
}

export function parseNullableDate(snapshot: Snapshot, field: string): Date | null {
  if (snapshot[field] == null) return null;
  return parseDate(snapshot, field);
}

export function parseEnumValue<T extends Record<string, string>>(snapshot: Snapshot, field: string, values: T): T[keyof T] {
  const value = snapshot[field];
  if (typeof value !== 'string' || !Object.values(values).includes(value)) throw new ConflictException(`Snapshot có enum không hợp lệ: ${field}.`);
  return value as T[keyof T];
}

export function parseResultFiles(snapshot: Snapshot): Array<{
  fileName: string;
  originalName: string;
  mimeType: string | null;
  size: number;
  url: string | null;
  storageProvider: string | null;
  bucket: string | null;
  objectKey: string | null;
  sha256: string | null;
  etag: string | null;
}> {
  const files = snapshot.files;
  if (!Array.isArray(files)) return [];
  return files.map((file, index) => {
    if (!file || typeof file !== 'object' || Array.isArray(file)) throw new ConflictException(`File kết quả #${index + 1} không hợp lệ.`);
    const entry = file as Record<string, unknown>;
    const fileName = typeof entry.fileName === 'string' && entry.fileName ? entry.fileName : `file-${index + 1}`;
    const originalName = typeof entry.originalName === 'string' && entry.originalName ? entry.originalName : fileName;
    const mimeType = typeof entry.mimeType === 'string' && entry.mimeType ? entry.mimeType : null;
    const size = typeof entry.size === 'number' && Number.isFinite(entry.size) ? entry.size : 0;
    const storageProvider = typeof entry.storageProvider === 'string' && entry.storageProvider ? entry.storageProvider : null;
    return {
      fileName,
      originalName,
      mimeType,
      size,
      url: typeof entry.url === 'string' ? entry.url : null,
      storageProvider,
      bucket: typeof entry.bucket === 'string' ? entry.bucket : null,
      objectKey: typeof entry.objectKey === 'string' ? entry.objectKey : null,
      sha256: typeof entry.sha256 === 'string' ? entry.sha256 : null,
      etag: typeof entry.etag === 'string' ? entry.etag : null,
    };
  });
}
