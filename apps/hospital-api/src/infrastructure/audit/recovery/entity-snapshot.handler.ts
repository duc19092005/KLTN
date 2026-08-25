import { ConflictException } from '@nestjs/common';
import {
  AppointmentStatus,
  DepartmentType,
  MedicalOrderStatus,
  MedicalSpecialty,
  OperationalStatus,
  Prisma,
  UserStatus,
  VisitSource,
  VisitStatus,
} from '@prisma/client';
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

type DbClient = PrismaService | Prisma.TransactionClient;
type Snapshot = Record<string, unknown>;

export async function loadLiveEntitySnapshot(client: DbClient, entity: RecoverableAuditEntity, entityId: string): Promise<Snapshot | null> {
  if (entity === 'Patient') {
    const row = await client.patient.findUnique({ where: { id: entityId } });
    return row ? buildPatientSnapshot(row) : null;
  }
  if (entity === 'Department') {
    const row = await client.department.findUnique({ where: { id: entityId } });
    return row ? buildDepartmentSnapshot(row) : null;
  }
  if (entity === 'StaffProfile') {
    const row = await client.staffProfile.findUnique({ where: { id: entityId }, include: { user: true } });
    return row ? buildStaffSnapshot(row) : null;
  }
  if (entity === 'DoctorProfile') {
    const row = await client.doctorProfile.findUnique({
      where: { id: entityId },
      include: { staffProfile: { include: { user: true } } },
    });
    return row ? buildUnifiedDoctorSnapshot(row) : null;
  }
  if (entity === 'AiModelRegistry') {
    const row = await client.aiModelRegistry.findUnique({ where: { id: entityId } });
    return row ? buildAiModelSnapshot(row) : null;
  }
  if (entity === 'Visit') {
    const row = await client.visit.findUnique({ where: { id: entityId } });
    return row ? buildVisitSnapshot(row) : null;
  }
  if (entity === 'AiDiagnosis') {
    const row = await client.aiDiagnosis.findUnique({ where: { id: entityId } });
    return row ? (buildAiDiagnosisSnapshot(row) as Snapshot) : null;
  }
  if (entity === 'MedicalOrder') {
    const row = await client.medicalOrder.findUnique({ where: { id: entityId } });
    return row ? (buildMedicalOrderSnapshot(row) as Snapshot) : null;
  }
  if (entity === 'MedicalResult') {
    const row = await client.medicalResult.findUnique({
      where: { id: entityId },
      include: { files: true, order: { select: { visitId: true, status: true } } },
    });
    if (!row) return null;
    return buildMedicalResultSnapshot(row);
  }
  if (entity === 'Appointment') {
    const row = await client.appointment.findUnique({
      where: { id: entityId },
      include: { doctor: { select: { staffProfileId: true } } },
    });
    return row ? (buildAppointmentSnapshot(row) as Snapshot) : null;
  }
  if (entity === 'AiQuality') {
    const row = await client.aiQuality.findUnique({ where: { id: entityId } });
    return row ? (buildAiQualitySnapshot(row) as Snapshot) : null;
  }
  const row = await client.medicalConclusion.findUnique({
    where: { id: entityId },
    include: { visit: { include: { patient: true } } },
  });
  return row ? (buildMedicalConclusionSnapshot(row) as Snapshot) : null;
}

export async function restoreEntitySnapshotData(client: Prisma.TransactionClient, entity: RecoverableAuditEntity, entityId: string, snapshot: Snapshot): Promise<void> {
  if (entity === 'Patient') {
    await client.patient.update({ where: { id: entityId }, data: {
      patientCode: parseString(snapshot, 'patientCode'), fullName: parseString(snapshot, 'fullName'),
      gender: parseString(snapshot, 'gender'), birthDate: parseDate(snapshot, 'birthDate'),
      citizenId: parseNullableString(snapshot, 'citizenId'), phone: parseNullableString(snapshot, 'phone'),
      address: parseNullableString(snapshot, 'address'), insuranceNumber: parseNullableString(snapshot, 'insuranceNumber'),
      emergencyContact: parseNullableString(snapshot, 'emergencyContact'),
    } });
    return;
  }
  if (entity === 'Department') {
    const managerId = parseNullableString(snapshot, 'managerId');
    if (managerId) await requireRelation(client.staffProfile.findUnique({ where: { id: managerId }, select: { id: true } }), 'nhân sự quản lý');
    await client.department.update({ where: { id: entityId }, data: {
      departmentCode: parseString(snapshot, 'departmentCode'), name: parseString(snapshot, 'name'),
      floor: parseNullableString(snapshot, 'floor'), status: parseEnumValue(snapshot, 'status', OperationalStatus),
      type: parseEnumValue(snapshot, 'type', DepartmentType), canReceiveOrders: parseBoolean(snapshot, 'canReceiveOrders'),
      description: parseNullableString(snapshot, 'description'), managerId,
    } });
    return;
  }
  if (entity === 'StaffProfile') {
    const departmentId = parseNullableString(snapshot, 'departmentId');
    if (departmentId) await requireRelation(client.department.findUnique({ where: { id: departmentId }, select: { id: true } }), 'phòng ban');
    const current = await client.staffProfile.findUniqueOrThrow({ where: { id: entityId }, select: { userId: true } });
    await client.staffProfile.update({ where: { id: entityId }, data: parseStaffData(snapshot, departmentId) });
    await client.user.update({ where: { id: current.userId }, data: { status: parseEnumValue(snapshot, 'status', UserStatus) } });
    return;
  }
  if (entity === 'DoctorProfile') {
    const departmentId = parseNullableString(snapshot, 'departmentId');
    if (departmentId) await requireRelation(client.department.findUnique({ where: { id: departmentId }, select: { id: true } }), 'phòng ban');
    const doctor = await client.doctorProfile.findUniqueOrThrow({ where: { id: entityId }, select: { staffProfileId: true, staffProfile: { select: { userId: true } } } });
    if (doctor.staffProfileId !== parseString(snapshot, 'staffProfileId')) throw new ConflictException('Snapshot bác sĩ không khớp hồ sơ nhân sự hiện tại.');
    await client.staffProfile.update({ where: { id: doctor.staffProfileId }, data: parseStaffData(snapshot, departmentId) });
    await client.user.update({ where: { id: doctor.staffProfile.userId }, data: { status: parseEnumValue(snapshot, 'status', UserStatus) } });
    await client.doctorProfile.update({ where: { id: entityId }, data: {
      specialty: parseEnumValue(snapshot, 'specialty', MedicalSpecialty),
      licenseNumber: parseString(snapshot, 'licenseNumber'), qualification: parseString(snapshot, 'qualification'),
      yearsExperience: parseNullableNumber(snapshot, 'yearsExperience'),
    } });
    return;
  }
  if (entity === 'AiModelRegistry') {
    const createdBy = parseString(snapshot, 'createdBy');
    await requireRelation(client.user.findUnique({ where: { id: createdBy }, select: { id: true } }), 'người tạo mô hình');
    const status = parseEnumValue(snapshot, 'status', OperationalStatus);
    await client.aiModelRegistry.update({ where: { id: entityId }, data: {
      modelName: parseString(snapshot, 'modelName'), modelVersion: parseString(snapshot, 'modelVersion'),
      recommendedSpecialty: parseNullableString(snapshot, 'recommendedSpecialty'), type: parseNullableString(snapshot, 'type'),
      provider: parseNullableString(snapshot, 'provider'), apiEndpoint: parseNullableString(snapshot, 'apiEndpoint'),
      ipHashPlain: parseNullableString(snapshot, 'ipHashPlain'), description: parseNullableString(snapshot, 'description'),
      status, isDeleted: status === OperationalStatus.DELETE || snapshot.isDeleted === true, createdBy,
    } });
    return;
  }
  if (entity === 'Visit') {
    const patientId = parseString(snapshot, 'patientId');
    const departmentId = parseString(snapshot, 'departmentId');
    const staffId = parseNullableString(snapshot, 'staffId');
    await requireRelation(client.patient.findUnique({ where: { id: patientId }, select: { id: true } }), 'bệnh nhân');
    await requireRelation(client.department.findUnique({ where: { id: departmentId }, select: { id: true } }), 'phòng ban');
    if (staffId) await requireRelation(client.staffProfile.findUnique({ where: { id: staffId }, select: { id: true } }), 'nhân sự phụ trách');
    await client.visit.update({ where: { id: entityId }, data: {
      visitCode: parseString(snapshot, 'visitCode'), patientId, departmentId, staffId,
      status: parseEnumValue(snapshot, 'status', VisitStatus), source: parseEnumValue(snapshot, 'source', VisitSource),
      checkInAt: parseDate(snapshot, 'checkInAt'), completedAt: parseNullableDate(snapshot, 'completedAt'),
    } });
    return;
  }
  if (entity === 'AiDiagnosis') {
    const aiModelId = parseString(snapshot, 'aiModelId');
    const patientId = parseNullableString(snapshot, 'patientId');
    const visitId = parseNullableString(snapshot, 'visitId');
    const reviewedByDoctorId = parseNullableString(snapshot, 'reviewedByDoctorId');
    await requireRelation(client.aiModelRegistry.findUnique({ where: { id: aiModelId }, select: { id: true } }), 'mô hình AI');
    if (patientId) await requireRelation(client.patient.findUnique({ where: { id: patientId }, select: { id: true } }), 'bệnh nhân');
    if (visitId) await requireRelation(client.visit.findUnique({ where: { id: visitId }, select: { id: true } }), 'lượt khám');
    if (reviewedByDoctorId) await requireRelation(client.doctorProfile.findUnique({ where: { id: reviewedByDoctorId }, select: { id: true } }), 'bác sĩ đánh giá');
    await client.aiDiagnosis.update({ where: { id: entityId }, data: {
      aiModelId, patientId, visitId,
      prompt: parseNullableString(snapshot, 'prompt'), result: parseNullableString(snapshot, 'result'),
      confidence: parseNullableNumber(snapshot, 'confidence'), status: parseString(snapshot, 'status'),
      reviewedByDoctorId, doctorFeedback: parseNullableString(snapshot, 'doctorFeedback'),
    } });
    return;
  }
  if (entity === 'MedicalOrder') {
    const visitId = parseString(snapshot, 'visitId');
    const patientId = parseString(snapshot, 'patientId');
    const doctorId = parseString(snapshot, 'doctorId');
    const targetDepartmentId = parseNullableString(snapshot, 'targetDepartmentId');
    await requireRelation(client.visit.findUnique({ where: { id: visitId }, select: { id: true } }), 'lượt khám');
    await requireRelation(client.patient.findUnique({ where: { id: patientId }, select: { id: true } }), 'bệnh nhân');
    await requireRelation(client.doctorProfile.findUnique({ where: { id: doctorId }, select: { id: true } }), 'bác sĩ');
    if (targetDepartmentId) await requireRelation(client.department.findUnique({ where: { id: targetDepartmentId }, select: { id: true } }), 'phòng ban đích');
    await client.medicalOrder.update({ where: { id: entityId }, data: {
      orderCode: parseString(snapshot, 'orderCode'), visitId, patientId, doctorId, targetDepartmentId,
      orderType: parseString(snapshot, 'orderType'), priority: parseString(snapshot, 'priority'),
      status: parseEnumValue(snapshot, 'status', MedicalOrderStatus),
      clinicalNote: parseNullableString(snapshot, 'clinicalNote'),
    } });
    return;
  }
  if (entity === 'MedicalResult') {
    const orderId = parseString(snapshot, 'orderId');
    const performedById = parseNullableString(snapshot, 'performedById');
    await requireRelation(client.medicalOrder.findUnique({ where: { id: orderId }, select: { id: true } }), 'chỉ định');
    if (performedById) await requireRelation(client.user.findUnique({ where: { id: performedById }, select: { id: true } }), 'người thực hiện');
    await client.medicalResult.update({ where: { id: entityId }, data: {
      resultCode: parseString(snapshot, 'resultCode'), orderId, performedById,
      note: parseNullableString(snapshot, 'note'),
      returnedAt: parseNullableDate(snapshot, 'returnedAt'),
    } });
    const files = parseResultFiles(snapshot);
    await client.medicalResultFile.deleteMany({ where: { resultId: entityId } });
    if (files.length > 0) {
      await client.medicalResultFile.createMany({ data: files.map((file) => ({ ...file, resultId: entityId })) });
    }
    return;
  }
  if (entity === 'Appointment') {
    const patientId = parseString(snapshot, 'patientId');
    const departmentId = parseString(snapshot, 'departmentId');
    const doctorId = parseNullableString(snapshot, 'doctorId');
    await requireRelation(client.patient.findUnique({ where: { id: patientId }, select: { id: true } }), 'bệnh nhân');
    await requireRelation(client.department.findUnique({ where: { id: departmentId }, select: { id: true } }), 'phòng ban');
    if (doctorId) await requireRelation(client.doctorProfile.findUnique({ where: { id: doctorId }, select: { id: true } }), 'bác sĩ');
    const current = await client.appointment.findUniqueOrThrow({ where: { id: entityId }, select: { qrTokenHash: true, qrExpiresAt: true } });
    await client.appointment.update({ where: { id: entityId }, data: {
      appointmentCode: parseString(snapshot, 'appointmentCode'), patientId, departmentId, doctorId,
      scheduledAt: parseDate(snapshot, 'scheduledAt'),
      status: parseEnumValue(snapshot, 'status', AppointmentStatus),
      qrTokenHash: current.qrTokenHash, qrExpiresAt: current.qrExpiresAt,
    } });
    return;
  }
  if (entity === 'AiQuality') {
    const doctorId = parseString(snapshot, 'doctorId');
    const aiModelId = parseString(snapshot, 'aiModelId');
    const aiDiagnosisId = parseNullableString(snapshot, 'aiDiagnosisId');
    await requireRelation(client.doctorProfile.findUnique({ where: { id: doctorId }, select: { id: true } }), 'bác sĩ');
    await requireRelation(client.aiModelRegistry.findUnique({ where: { id: aiModelId }, select: { id: true } }), 'mô hình AI');
    if (aiDiagnosisId) await requireRelation(client.aiDiagnosis.findUnique({ where: { id: aiDiagnosisId }, select: { id: true } }), 'chẩn đoán AI');
    await client.aiQuality.update({ where: { id: entityId }, data: {
      doctorId, aiModelId, aiDiagnosisId,
      doctorConclusionAboutModel: parseString(snapshot, 'doctorConclusionAboutModel'),
      trustablePercent: parseNumber(snapshot, 'trustablePercent'),
    } });
    return;
  }

  const visitId = parseString(snapshot, 'visitId');
  const doctorId = parseString(snapshot, 'doctorId');
  const aiDiagnosisId = parseNullableString(snapshot, 'aiDiagnosisId');
  const visit = await client.visit.findUnique({ where: { id: visitId }, select: { patient: { select: { patientCode: true } } } });
  if (!visit || visit.patient.patientCode !== parseNullableString(snapshot, 'patientCode')) throw new ConflictException('Quan hệ lượt khám/bệnh nhân không khớp snapshot nguồn.');
  await requireRelation(client.doctorProfile.findUnique({ where: { id: doctorId }, select: { id: true } }), 'bác sĩ');
  if (aiDiagnosisId) await requireRelation(client.aiDiagnosis.findUnique({ where: { id: aiDiagnosisId }, select: { id: true } }), 'chẩn đoán AI');
  await client.medicalConclusion.update({ where: { id: entityId }, data: {
    visitId, doctorId, aiDiagnosisId, finalDiagnosis: parseString(snapshot, 'finalDiagnosis'),
    treatmentPlan: parseNullableString(snapshot, 'treatmentPlan'), prescription: parseNullableString(snapshot, 'prescription'),
    followUpNote: parseNullableString(snapshot, 'followUpNote'), doctorNote: parseNullableString(snapshot, 'doctorNote'),
  } });
}

function parseStaffData(snapshot: Snapshot, departmentId: string | null) {
  return {
    employeeCode: parseString(snapshot, 'employeeCode'), fullName: parseString(snapshot, 'fullName'),
    phone: parseString(snapshot, 'phone'), gender: parseString(snapshot, 'gender'), citizenId: parseString(snapshot, 'citizenId'),
    birthDate: parseDate(snapshot, 'birthDate'), address: parseNullableString(snapshot, 'address'),
    avatarUrl: parseString(snapshot, 'avatarUrl'), departmentId, position: parseNullableString(snapshot, 'position'),
  };
}

function parseString(snapshot: Snapshot, field: string): string {
  const value = snapshot[field];
  if (typeof value !== 'string' || !value.trim()) throw new ConflictException(`Snapshot thiếu trường bắt buộc: ${field}.`);
  return value;
}

function parseNullableString(snapshot: Snapshot, field: string): string | null {
  const value = snapshot[field];
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new ConflictException(`Snapshot có kiểu dữ liệu không hợp lệ: ${field}.`);
  return value;
}

function parseNullableNumber(snapshot: Snapshot, field: string): number | null {
  const value = snapshot[field];
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ConflictException(`Snapshot có số không hợp lệ: ${field}.`);
  return value;
}

function parseNumber(snapshot: Snapshot, field: string): number {
  const value = snapshot[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ConflictException(`Snapshot có số không hợp lệ: ${field}.`);
  return value;
}

function parseBoolean(snapshot: Snapshot, field: string): boolean {
  const value = snapshot[field];
  if (typeof value !== 'boolean') throw new ConflictException(`Snapshot có boolean không hợp lệ: ${field}.`);
  return value;
}

function parseDate(snapshot: Snapshot, field: string): Date {
  const value = snapshot[field];
  const date = typeof value === 'string' || value instanceof Date ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) throw new ConflictException(`Snapshot có ngày không hợp lệ: ${field}.`);
  return date;
}

function parseNullableDate(snapshot: Snapshot, field: string): Date | null {
  if (snapshot[field] == null) return null;
  return parseDate(snapshot, field);
}

function parseEnumValue<T extends Record<string, string>>(snapshot: Snapshot, field: string, values: T): T[keyof T] {
  const value = snapshot[field];
  if (typeof value !== 'string' || !Object.values(values).includes(value)) throw new ConflictException(`Snapshot có enum không hợp lệ: ${field}.`);
  return value as T[keyof T];
}

async function requireRelation<T>(promise: Promise<T | null>, label: string): Promise<T> {
  const relation = await promise;
  if (!relation) throw new ConflictException(`Không tìm thấy ${label} được tham chiếu trong snapshot.`);
  return relation;
}

function parseResultFiles(snapshot: Snapshot): Array<{
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string | null;
  storageProvider: string;
  bucket: string | null;
  objectKey: string | null;
  sha256: string | null;
  etag: string | null;
}> {
  const files = snapshot.files;
  if (!Array.isArray(files)) throw new ConflictException('Snapshot thiếu danh sách files của kết quả xét nghiệm.');
  return files.map((file, index) => {
    if (!file || typeof file !== 'object' || Array.isArray(file)) throw new ConflictException(`File kết quả #${index + 1} không hợp lệ.`);
    const entry = file as Record<string, unknown>;
    const fileName = typeof entry.fileName === 'string' && entry.fileName ? entry.fileName : `file-${index + 1}`;
    const originalName = typeof entry.originalName === 'string' && entry.originalName ? entry.originalName : fileName;
    const mimeType = typeof entry.mimeType === 'string' && entry.mimeType ? entry.mimeType : 'application/octet-stream';
    const size = typeof entry.size === 'number' && Number.isFinite(entry.size) ? entry.size : 0;
    const storageProvider = typeof entry.storageProvider === 'string' && entry.storageProvider ? entry.storageProvider : 'CLOUDINARY';
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
