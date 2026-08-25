export const RECOVERABLE_AUDIT_ENTITIES = [
  'Patient',
  'Department',
  'StaffProfile',
  'DoctorProfile',
  'AiModelRegistry',
  'Visit',
  'MedicalConclusion',
  'AiDiagnosis',
  'MedicalOrder',
  'MedicalResult',
  'Appointment',
  'AiQuality',
] as const;

export type RecoverableAuditEntity = (typeof RECOVERABLE_AUDIT_ENTITIES)[number];

export interface EntityRecoveryTarget {
  entity: RecoverableAuditEntity;
  entityId: string;
}

export interface EntityIntegrityWarning {
  entity: RecoverableAuditEntity;
  entityId: string;
  status: 'TAMPERED' | 'AUDIT_UNTRUSTED' | 'MISSING' | 'SNAPSHOT_INCOMPLETE';
  recoverable: boolean;
  latestTrustedSeq: number | null;
  batchId: number | null;
  anchoredAt: Date | null;
  fieldsChanged: string[];
  blockers: string[];
  dependencies: Array<{ entity: string; entityId: string }>;
  recoveryMode: 'DIRECT_ENTITY' | 'DEPENDENCY_CHAIN' | 'AUDIT_BATCH_FIRST' | 'PITR_REQUIRED';
  sensitiveDataHidden: true;
  message: string;
  clusterKey?: string | null;
  clusterLabel?: string | null;
  autoResolvable?: boolean;
}

export const ENTITY_DEPENDENCY_ORDER: Record<RecoverableAuditEntity, number> = {
  Department: 0,
  Patient: 0,
  AiModelRegistry: 0,
  StaffProfile: 1,
  DoctorProfile: 2,
  Visit: 3,
  Appointment: 3,
  MedicalOrder: 4,
  AiDiagnosis: 4,
  MedicalResult: 5,
  MedicalConclusion: 5,
  AiQuality: 6,
};

export const REQUIRED_SNAPSHOT_FIELDS: Record<RecoverableAuditEntity, readonly string[]> = {
  Patient: ['patientCode', 'fullName', 'gender', 'birthDate', 'citizenId', 'phone', 'address', 'insuranceNumber', 'emergencyContact'],
  Department: ['departmentCode', 'name', 'floor', 'status', 'type', 'canReceiveOrders', 'description', 'managerId'],
  StaffProfile: ['employeeCode', 'fullName', 'phone', 'gender', 'citizenId', 'birthDate', 'address', 'avatarUrl', 'departmentId', 'position', 'status'],
  DoctorProfile: ['employeeCode', 'fullName', 'phone', 'gender', 'citizenId', 'birthDate', 'address', 'avatarUrl', 'departmentId', 'position', 'status', 'staffProfileId', 'specialty', 'licenseNumber', 'qualification', 'yearsExperience'],
  AiModelRegistry: ['modelName', 'modelVersion', 'recommendedSpecialty', 'type', 'provider', 'apiEndpoint', 'ipHashPlain', 'description', 'status', 'createdBy'],
  Visit: ['visitCode', 'patientId', 'departmentId', 'staffId', 'status', 'source', 'checkInAt', 'completedAt'],
  MedicalConclusion: ['visitId', 'patientCode', 'doctorId', 'aiDiagnosisId', 'finalDiagnosis', 'treatmentPlan', 'prescription', 'followUpNote', 'doctorNote'],
  AiDiagnosis: ['aiModelId', 'patientId', 'visitId', 'prompt', 'result', 'confidence', 'status', 'reviewedByDoctorId', 'doctorFeedback'],
  MedicalOrder: ['orderId', 'orderCode', 'visitId', 'patientId', 'doctorId', 'targetDepartmentId', 'orderType', 'priority', 'status', 'clinicalNote'],
  MedicalResult: ['resultId', 'resultCode', 'orderId', 'visitId', 'performedById', 'fileCount', 'mimeTypes', 'fileSizes', 'files', 'note', 'returnedAt', 'createdAt'],
  Appointment: ['appointmentCode', 'patientId', 'departmentId', 'doctorId', 'scheduledAt', 'status', 'doctorStaffId'],
  AiQuality: ['doctorId', 'aiModelId', 'aiDiagnosisId', 'doctorConclusionAboutModel', 'trustablePercent'],
};

export const SENSITIVE_FIELDS: Partial<Record<RecoverableAuditEntity, ReadonlySet<string>>> = {
  Patient: new Set(['fullName', 'gender', 'birthDate', 'citizenId', 'phone', 'address', 'insuranceNumber', 'emergencyContact']),
  StaffProfile: new Set(['fullName', 'phone', 'gender', 'citizenId', 'birthDate', 'address', 'avatarUrl']),
  DoctorProfile: new Set(['fullName', 'phone', 'gender', 'citizenId', 'birthDate', 'address', 'avatarUrl']),
  AiModelRegistry: new Set(['apiEndpoint', 'ipHashPlain']),
  Visit: new Set([]),
  MedicalConclusion: new Set(['patientCode', 'finalDiagnosis', 'treatmentPlan', 'prescription', 'followUpNote', 'doctorNote']),
  AiDiagnosis: new Set(['prompt', 'result', 'doctorFeedback']),
  MedicalOrder: new Set(['clinicalNote']),
  MedicalResult: new Set(['note', 'files']),
  Appointment: new Set(['scheduledAt']),
  AiQuality: new Set(['doctorConclusionAboutModel']),
};
