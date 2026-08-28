import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EntityRecreationTarget,
  parseNullableString,
  parseString,
  recoveryEnvelope,
} from './entity-recreation-factory';

type Snapshot = Record<string, unknown>;
type DbClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class EntityRecreationBlockers {
  async inspectBlockers(client: DbClient, target: EntityRecreationTarget, snapshot: Snapshot): Promise<string[]> {
    const blockers: string[] = [];
    const add = (value: string) => { if (!blockers.includes(value)) blockers.push(value); };

    if (target.entity === 'Patient') {
      const duplicate = await client.patient.findFirst({
        where: { OR: [
          { patientCode: parseString(snapshot, 'patientCode') },
          ...(parseNullableString(snapshot, 'citizenId') ? [{ citizenId: parseNullableString(snapshot, 'citizenId')! }] : []),
        ] }, select: { id: true },
      });
      if (duplicate && duplicate.id !== target.entityId) add('PATIENT_UNIQUE_CONFLICT');
    }

    if (target.entity === 'Department') {
      const duplicate = await client.department.findFirst({
        where: { OR: [{ departmentCode: parseString(snapshot, 'departmentCode') }, { name: parseString(snapshot, 'name') }] },
        select: { id: true },
      });
      if (duplicate && duplicate.id !== target.entityId) add('DEPARTMENT_UNIQUE_CONFLICT');
      const managerId = parseNullableString(snapshot, 'managerId');
      if (managerId && !(await client.staffProfile.findUnique({ where: { id: managerId }, select: { id: true } }))) add('MISSING_DEPARTMENT_MANAGER');
    }

    if (target.entity === 'StaffProfile' || target.entity === 'DoctorProfile') {
      const departmentId = parseNullableString(snapshot, 'departmentId');
      if (departmentId && !(await client.department.findUnique({ where: { id: departmentId }, select: { id: true } }))) add('MISSING_DEPARTMENT');
      const profileId = target.entity === 'DoctorProfile' ? parseString(snapshot, 'staffProfileId') : target.entityId;
      const existingStaff = await client.staffProfile.findUnique({ where: { id: profileId }, select: { id: true, userId: true } });
      if (!existingStaff) {
        const envelope = recoveryEnvelope(snapshot);
        if (!envelope?.user || !envelope.staff) add('MISSING_ENCRYPTED_USER_BACKUP');
        else await this.inspectUserBlockers(client, envelope.user, profileId, add);

        const staffDuplicate = await client.staffProfile.findFirst({
          where: { OR: [
            { employeeCode: parseString(snapshot, 'employeeCode') },
            { citizenId: parseString(snapshot, 'citizenId') },
          ] }, select: { id: true },
        });
        if (staffDuplicate && staffDuplicate.id !== profileId) add('STAFF_UNIQUE_CONFLICT');
      }
      if (target.entity === 'DoctorProfile') {
        const doctorDuplicate = await client.doctorProfile.findFirst({
          where: { OR: [
            { staffProfileId: profileId },
            { licenseNumber: parseString(snapshot, 'licenseNumber') },
          ] }, select: { id: true },
        });
        if (doctorDuplicate && doctorDuplicate.id !== target.entityId) add('DOCTOR_UNIQUE_CONFLICT');
      }
    }

    if (target.entity === 'AiModelRegistry') {
      const createdBy = parseString(snapshot, 'createdBy');
      if (!(await client.user.findUnique({ where: { id: createdBy }, select: { id: true } }))) add('MISSING_AI_MODEL_CREATOR');
      const details = recoveryEnvelope(snapshot)?.entity;
      if (!details || typeof details.modelId !== 'string' || typeof details.ipHashEncrypted !== 'string') add('MISSING_ENCRYPTED_AI_MODEL_BACKUP');
      else {
        const duplicate = await client.aiModelRegistry.findUnique({ where: { modelId: details.modelId }, select: { id: true } });
        if (duplicate && duplicate.id !== target.entityId) add('AI_MODEL_UNIQUE_CONFLICT');
      }
    }

    if (target.entity === 'Visit') {
      const duplicate = await client.visit.findUnique({ where: { visitCode: parseString(snapshot, 'visitCode') }, select: { id: true } });
      if (duplicate && duplicate.id !== target.entityId) add('VISIT_CODE_UNIQUE_CONFLICT');
      const patientId = parseString(snapshot, 'patientId');
      if (!(await client.patient.findUnique({ where: { id: patientId }, select: { id: true } }))) add('MISSING_PATIENT');
      const departmentId = parseString(snapshot, 'departmentId');
      if (!(await client.department.findUnique({ where: { id: departmentId }, select: { id: true } }))) add('MISSING_DEPARTMENT');
      const staffId = parseNullableString(snapshot, 'staffId');
      if (staffId && !(await client.staffProfile.findUnique({ where: { id: staffId }, select: { id: true } }))) add('MISSING_VISIT_STAFF');
    }

    if (target.entity === 'AiDiagnosis') {
      const aiModelId = parseString(snapshot, 'aiModelId');
      if (!(await client.aiModelRegistry.findUnique({ where: { id: aiModelId }, select: { id: true } }))) add('MISSING_AI_MODEL');
      const patientId = parseNullableString(snapshot, 'patientId');
      if (patientId && !(await client.patient.findUnique({ where: { id: patientId }, select: { id: true } }))) add('MISSING_PATIENT');
      const visitId = parseNullableString(snapshot, 'visitId');
      if (visitId) {
        const visit = await client.visit.findUnique({ where: { id: visitId }, select: { id: true, patientId: true } });
        if (!visit) add('MISSING_VISIT');
        else if (patientId && visit.patientId !== patientId) add('VISIT_PATIENT_MISMATCH');
      }
      const reviewerId = parseNullableString(snapshot, 'reviewedByDoctorId');
      if (reviewerId && !(await client.doctorProfile.findUnique({ where: { id: reviewerId }, select: { id: true } }))) add('MISSING_REVIEWING_DOCTOR');
    }

    if (target.entity === 'MedicalConclusion') {
      const visitId = parseString(snapshot, 'visitId');
      const visit = await client.visit.findUnique({
        where: { id: visitId },
        select: { id: true, patient: { select: { patientCode: true } }, finalConclusion: { select: { id: true } } },
      });
      if (!visit) add('MISSING_VISIT');
      else {
        if (visit.patient.patientCode !== parseNullableString(snapshot, 'patientCode')) add('VISIT_PATIENT_MISMATCH');
        if (visit.finalConclusion && visit.finalConclusion.id !== target.entityId) add('VISIT_ALREADY_HAS_CONCLUSION');
      }
      const doctorId = parseString(snapshot, 'doctorId');
      if (!(await client.doctorProfile.findUnique({ where: { id: doctorId }, select: { id: true } }))) add('MISSING_DOCTOR');
      const diagnosisId = parseNullableString(snapshot, 'aiDiagnosisId');
      if (diagnosisId) {
        const diagnosis = await client.aiDiagnosis.findUnique({ where: { id: diagnosisId }, select: { id: true, visitId: true } });
        if (!diagnosis) add('MISSING_AI_DIAGNOSIS');
        else if (diagnosis.visitId !== visitId) add('DIAGNOSIS_VISIT_MISMATCH');
      }
    }

    if (target.entity === 'MedicalOrder') {
      const duplicate = await client.medicalOrder.findUnique({ where: { orderCode: parseString(snapshot, 'orderCode') }, select: { id: true } });
      if (duplicate && duplicate.id !== target.entityId) add('ORDER_CODE_UNIQUE_CONFLICT');
      const visitId = parseString(snapshot, 'visitId');
      const visit = await client.visit.findUnique({ where: { id: visitId }, select: { id: true, patientId: true } });
      if (!visit) add('MISSING_VISIT');
      else if (parseNullableString(snapshot, 'patientId') && visit.patientId !== parseNullableString(snapshot, 'patientId')) add('ORDER_VISIT_PATIENT_MISMATCH');
      const doctorId = parseString(snapshot, 'doctorId');
      if (!(await client.doctorProfile.findUnique({ where: { id: doctorId }, select: { id: true } }))) add('MISSING_DOCTOR');
      const targetDepartmentId = parseNullableString(snapshot, 'targetDepartmentId');
      if (targetDepartmentId && !(await client.department.findUnique({ where: { id: targetDepartmentId }, select: { id: true } }))) add('MISSING_TARGET_DEPARTMENT');
    }

    if (target.entity === 'MedicalResult') {
      const duplicate = await client.medicalResult.findUnique({ where: { resultCode: parseString(snapshot, 'resultCode') }, select: { id: true } });
      if (duplicate && duplicate.id !== target.entityId) add('RESULT_CODE_UNIQUE_CONFLICT');
      const orderId = parseString(snapshot, 'orderId');
      if (!(await client.medicalOrder.findUnique({ where: { id: orderId }, select: { id: true } }))) add('MISSING_MEDICAL_ORDER');
      const performedById = parseNullableString(snapshot, 'performedById');
      if (performedById && !(await client.user.findUnique({ where: { id: performedById }, select: { id: true } }))) add('MISSING_PERFORMED_BY');
    }

    if (target.entity === 'Appointment') {
      const duplicate = await client.appointment.findUnique({ where: { appointmentCode: parseString(snapshot, 'appointmentCode') }, select: { id: true } });
      if (duplicate && duplicate.id !== target.entityId) add('APPOINTMENT_CODE_UNIQUE_CONFLICT');
      const patientId = parseString(snapshot, 'patientId');
      if (!(await client.patient.findUnique({ where: { id: patientId }, select: { id: true } }))) add('MISSING_PATIENT');
      const departmentId = parseString(snapshot, 'departmentId');
      if (!(await client.department.findUnique({ where: { id: departmentId }, select: { id: true } }))) add('MISSING_DEPARTMENT');
      const doctorId = parseNullableString(snapshot, 'doctorId');
      if (doctorId && !(await client.doctorProfile.findUnique({ where: { id: doctorId }, select: { id: true } }))) add('MISSING_DOCTOR');
    }

    if (target.entity === 'AiQuality') {
      const doctorId = parseString(snapshot, 'doctorId');
      if (!(await client.doctorProfile.findUnique({ where: { id: doctorId }, select: { id: true } }))) add('MISSING_DOCTOR');
      const aiModelId = parseString(snapshot, 'aiModelId');
      if (!(await client.aiModelRegistry.findUnique({ where: { id: aiModelId }, select: { id: true } }))) add('MISSING_AI_MODEL');
      const aiDiagnosisId = parseNullableString(snapshot, 'aiDiagnosisId');
      if (aiDiagnosisId && !(await client.aiDiagnosis.findUnique({ where: { id: aiDiagnosisId }, select: { id: true } }))) add('MISSING_AI_DIAGNOSIS');
    }

    return blockers;
  }

  private async inspectUserBlockers(client: DbClient, user: Snapshot, profileId: string, add: (value: string) => void) {
    const userId = parseString(user, 'id');
    const existing = await client.user.findUnique({
      where: { id: userId },
      select: { id: true, staffProfile: { select: { id: true } } },
    });
    if (existing) {
      if (existing.staffProfile && existing.staffProfile.id !== profileId) add('USER_ALREADY_HAS_STAFF_PROFILE');
      return;
    }
    const filters: Prisma.UserWhereInput[] = [];
    const username = parseNullableString(user, 'username');
    const email = parseNullableString(user, 'email');
    const phoneNormalized = parseNullableString(user, 'phoneNormalized');
    if (username) filters.push({ username });
    if (email) filters.push({ email });
    if (phoneNormalized) filters.push({ phoneNormalized });
    if (filters.length && await client.user.findFirst({ where: { OR: filters }, select: { id: true } })) add('USER_UNIQUE_CONFLICT');
  }
}