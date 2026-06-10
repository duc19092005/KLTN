import { canonicalize } from './audit-hash.util';

export type AuditDiffSensitivity = 'SAFE' | 'PII' | 'CLINICAL_TEXT' | 'FILE_URL' | 'REDACTED';

export interface AuditDiffChange {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
  sensitivity: AuditDiffSensitivity;
}

export interface AuditDiffJson {
  schema: 'KLTN_AUDIT_DIFF_V1';
  fieldsChanged: string[];
  changes: AuditDiffChange[];
}

export interface AuditDiffViewerContext {
  role?: string | null;
  faceVerified?: boolean;
  clinicalContextAllowed?: boolean;
  entity?: string | null;
}

export interface DisplayAuditDiffChange {
  field: string;
  fieldPath: string;
  label: string;
  entity?: string | null;
  entityLabel?: string;
  changeKind: AuditDiffSensitivity;
  before: unknown;
  after: unknown;
  sensitivity: AuditDiffSensitivity;
  redacted: boolean;
  summary: string;
}

const FIELD_LABELS: Record<string, string> = {
  fullName: 'Họ tên',
  displayName: 'Tên hiển thị',
  phone: 'Số điện thoại',
  email: 'Email',
  identityNumber: 'Số giấy tờ',
  citizenId: 'Số CCCD',
  dateOfBirth: 'Ngày sinh',
  dob: 'Ngày sinh',
  gender: 'Giới tính',
  avatarUrl: 'Ảnh đại diện',
  url: 'Tệp',
  fileUrl: 'Tệp',
  secureUrl: 'Tệp',
  downloadUrl: 'Tệp',
  diagnosis: 'Chẩn đoán',
  treatmentPlan: 'Kế hoạch điều trị',
  prescription: 'Đơn thuốc',
  note: 'Ghi chú',
  clinicalNote: 'Ghi chú lâm sàng',
};

const ENTITY_LABELS: Record<string, string> = {
  StaffProfile: 'Nhân sự',
  DoctorProfile: 'Bác sĩ',
  Patient: 'Bệnh nhân',
  Visit: 'Lượt khám',
  MedicalConclusion: 'Kết luận khám',
  User: 'Người dùng',
  SecurityEvent: 'Sự kiện bảo mật',
  Department: 'Phòng ban',
};

const ENTITY_FIELD_LABELS: Record<string, Record<string, string>> = {
  StaffProfile: { fullName: 'Họ tên nhân sự', phone: 'Số điện thoại nhân sự', avatarUrl: 'Ảnh đại diện nhân sự' },
  Patient: { fullName: 'Họ tên bệnh nhân', phone: 'Số điện thoại bệnh nhân', citizenId: 'Số CCCD bệnh nhân' },
  Visit: { status: 'Trạng thái lượt khám', departmentId: 'Phòng khám', patientId: 'Bệnh nhân' },
  MedicalConclusion: { finalDiagnosis: 'Chẩn đoán cuối cùng', treatmentPlan: 'Kế hoạch điều trị', prescription: 'Đơn thuốc' },
};

const PII_FIELDS = new Set([
  'fullName',
  'displayName',
  'phone',
  'email',
  'identityNumber',
  'citizenId',
  'dateOfBirth',
  'dob',
  'gender',
]);

const FILE_URL_FIELDS = new Set([
  'avatarUrl',
  'url',
  'fileUrl',
  'secureUrl',
  'downloadUrl',
  'cloudinaryUrl',
  'cloudinaryPublicId',
]);

const CLINICAL_TEXT_FIELDS = new Set([
  'diagnosis',
  'treatmentPlan',
  'prescription',
  'note',
  'clinicalNote',
  'conclusion',
  'symptoms',
]);

function isPlainComparable(value: unknown): boolean {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return canonicalize(left ?? null) === canonicalize(right ?? null);
}

export function getAuditFieldLabel(field: string, entity?: string | null): string {
  if (entity && ENTITY_FIELD_LABELS[entity]?.[field]) return ENTITY_FIELD_LABELS[entity][field];
  return FIELD_LABELS[field] ?? field;
}

export function getAuditEntityLabel(entity?: string | null): string {
  return entity ? ENTITY_LABELS[entity] ?? entity : 'Đối tượng';
}

export function classifyAuditField(field: string): AuditDiffSensitivity {
  if (FILE_URL_FIELDS.has(field) || /url$/i.test(field) || /file/i.test(field)) return 'FILE_URL';
  if (CLINICAL_TEXT_FIELDS.has(field)) return 'CLINICAL_TEXT';
  if (PII_FIELDS.has(field)) return 'PII';
  return 'SAFE';
}

function displayValueForStoredDiff(field: string, value: unknown, sensitivity: AuditDiffSensitivity): unknown {
  if (sensitivity === 'FILE_URL') return '[REDACTED]';
  if (sensitivity === 'CLINICAL_TEXT') return '[REDACTED]';
  if (sensitivity === 'REDACTED') return '[REDACTED]';
  if (isPlainComparable(value)) return value;
  return `[${field} changed]`;
}

export function buildAuditDiff(before: Record<string, unknown> | null | undefined, after: Record<string, unknown> | null | undefined): AuditDiffJson {
  const beforeSnapshot = before ?? {};
  const afterSnapshot = after ?? {};
  const fields = Array.from(new Set([...Object.keys(beforeSnapshot), ...Object.keys(afterSnapshot)])).sort();
  const changes = fields
    .filter((field) => !valuesEqual(beforeSnapshot[field], afterSnapshot[field]))
    .map((field) => {
      const sensitivity = classifyAuditField(field);
      return {
        field,
        label: getAuditFieldLabel(field),
        before: displayValueForStoredDiff(field, beforeSnapshot[field] ?? null, sensitivity),
        after: displayValueForStoredDiff(field, afterSnapshot[field] ?? null, sensitivity),
        sensitivity,
      } satisfies AuditDiffChange;
    });

  return {
    schema: 'KLTN_AUDIT_DIFF_V1',
    fieldsChanged: changes.map((change) => change.field),
    changes,
  };
}

function canViewPii(context: AuditDiffViewerContext): boolean {
  return context.role === 'ADMIN' && context.faceVerified === true;
}

function canViewClinicalText(context: AuditDiffViewerContext): boolean {
  return ['ADMIN', 'DOCTOR'].includes(context.role ?? '') && context.faceVerified === true && context.clinicalContextAllowed === true;
}

function changedSummary(label: string): string {
  return `${label} đã thay đổi`;
}

export function toDisplayAuditDiff(diff: AuditDiffJson, context: AuditDiffViewerContext): DisplayAuditDiffChange[] {
  return diff.changes.map((change) => {
    if (change.sensitivity === 'FILE_URL') {
      return {
        ...change,
        fieldPath: `${context.entity ?? 'Entity'}.${change.field}`,
        label: getAuditFieldLabel(change.field, context.entity),
        entity: context.entity,
        entityLabel: getAuditEntityLabel(context.entity),
        changeKind: change.sensitivity,
        before: '[REDACTED]',
        after: '[REDACTED]',
        redacted: true,
        summary: changedSummary(change.label),
      };
    }

    if (change.sensitivity === 'CLINICAL_TEXT' && !canViewClinicalText(context)) {
      return {
        ...change,
        fieldPath: `${context.entity ?? 'Entity'}.${change.field}`,
        label: getAuditFieldLabel(change.field, context.entity),
        entity: context.entity,
        entityLabel: getAuditEntityLabel(context.entity),
        changeKind: change.sensitivity,
        before: '[REDACTED]',
        after: '[REDACTED]',
        redacted: true,
        summary: changedSummary(change.label),
      };
    }

    if (change.sensitivity === 'PII' && !canViewPii(context)) {
      return {
        ...change,
        fieldPath: `${context.entity ?? 'Entity'}.${change.field}`,
        label: getAuditFieldLabel(change.field, context.entity),
        entity: context.entity,
        entityLabel: getAuditEntityLabel(context.entity),
        changeKind: change.sensitivity,
        before: '[REDACTED]',
        after: '[REDACTED]',
        redacted: true,
        summary: changedSummary(change.label),
      };
    }

    return {
      ...change,
      fieldPath: `${context.entity ?? 'Entity'}.${change.field}`,
      label: getAuditFieldLabel(change.field, context.entity),
      entity: context.entity,
      entityLabel: getAuditEntityLabel(context.entity),
      changeKind: change.sensitivity,
      redacted: false,
      summary: `${getAuditFieldLabel(change.field, context.entity)}: ${String(change.before)} → ${String(change.after)}`,
    };
  });
}
