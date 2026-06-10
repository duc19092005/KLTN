import { canonicalize } from './audit-hash.util';

export type AuditDiffSensitivity = 'SAFE' | 'PII' | 'CLINICAL_TEXT' | 'FILE_URL' | 'REDACTED';

export interface AuditDiffChange {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
  sensitivity: AuditDiffSensitivity;
  storedRedacted: boolean;
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
  reason?: string;
  policyCode?: string;
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
  finalDiagnosis: 'Chẩn đoán cuối cùng',
  doctorNote: 'Ghi chú bác sĩ',
  birthDate: 'Ngày sinh',
  address: 'Địa chỉ',
  insuranceNumber: 'Số bảo hiểm',
  emergencyContact: 'Liên hệ khẩn cấp',
  licenseNumber: 'Số giấy phép',
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
  'birthDate',
  'address',
  'insuranceNumber',
  'emergencyContact',
  'employeeCode',
  'licenseNumber',
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
  'finalDiagnosis',
  'doctorNote',
  'conclusion',
  'symptoms',
]);

const SENSITIVE_FIELD_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /embedding/i,
  /hash$/i,
  /privateKey/i,
  /wallet/i,
  /citizen/i,
  /insurance/i,
];

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
  if (SENSITIVE_FIELD_PATTERNS.some((pattern) => pattern.test(field))) return 'REDACTED';
  if (FILE_URL_FIELDS.has(field) || /url$/i.test(field) || /file/i.test(field)) return 'FILE_URL';
  if (CLINICAL_TEXT_FIELDS.has(field)) return 'CLINICAL_TEXT';
  if (PII_FIELDS.has(field)) return 'PII';
  return 'SAFE';
}

function shouldRedactStoredValue(sensitivity: AuditDiffSensitivity): boolean {
  return sensitivity !== 'SAFE';
}

function displayValueForStoredDiff(field: string, value: unknown, sensitivity: AuditDiffSensitivity): unknown {
  if (shouldRedactStoredValue(sensitivity)) return '[REDACTED]';
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
        storedRedacted: shouldRedactStoredValue(sensitivity),
      } satisfies AuditDiffChange;
    });

  return {
    schema: 'KLTN_AUDIT_DIFF_V1',
    fieldsChanged: changes.map((change) => change.field),
    changes,
  };
}

function changedSummary(label: string): string {
  return `${label} đã thay đổi`;
}

function buildDisplayBase(change: AuditDiffChange, context: AuditDiffViewerContext) {
  return {
    ...change,
    fieldPath: `${context.entity ?? 'Entity'}.${change.field}`,
    label: getAuditFieldLabel(change.field, context.entity),
    entity: context.entity,
    entityLabel: getAuditEntityLabel(context.entity),
    changeKind: change.sensitivity,
  };
}

function redactedDisplay(change: AuditDiffChange, context: AuditDiffViewerContext, reason: string, policyCode: string): DisplayAuditDiffChange {
  const label = getAuditFieldLabel(change.field, context.entity);
  return {
    ...buildDisplayBase(change, context),
    before: '[REDACTED]',
    after: '[REDACTED]',
    redacted: true,
    reason,
    policyCode,
    summary: changedSummary(label),
  };
}

export function toDisplayAuditDiff(diff: AuditDiffJson, context: AuditDiffViewerContext): DisplayAuditDiffChange[] {
  return diff.changes.map((change) => {
    if (change.sensitivity === 'REDACTED') {
      return redactedDisplay(change, context, 'Trường bảo mật luôn bị ẩn khỏi audit UI.', 'AUDIT_REDACT_ALWAYS');
    }

    if (change.sensitivity === 'FILE_URL') {
      return redactedDisplay(change, context, 'Đường dẫn tệp/Cloudinary không hiển thị trong audit UI.', 'AUDIT_REDACT_FILE_URL');
    }

    if (change.sensitivity === 'CLINICAL_TEXT') {
      return redactedDisplay(change, context, 'Nội dung lâm sàng không được lưu plaintext trong diff; cần quy trình break-glass có kiểm soát nếu cần đối chiếu snapshot.', 'AUDIT_REDACT_CLINICAL_STORED');
    }

    if (change.sensitivity === 'PII') {
      return redactedDisplay(change, context, 'PII không được lưu plaintext trong diff; xem snapshot mã hóa qua quy trình break-glass nếu cần.', 'AUDIT_REDACT_PII_STORED');
    }

    return {
      ...buildDisplayBase(change, context),
      redacted: false,
      summary: `${getAuditFieldLabel(change.field, context.entity)}: ${String(change.before)} → ${String(change.after)}`,
    };
  });
}
