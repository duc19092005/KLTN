import { buildAuditDiff, classifyAuditField, toDisplayAuditDiff } from '../../../../../src/infrastructure/audit/audit-diff.util';

describe('audit-diff.util', () => {
  it('builds a field-level diff for StaffProfile fullName', () => {
    const diff = buildAuditDiff(
      { id: 'staff-1', fullName: 'abc', status: 'ACTIVE' },
      { id: 'staff-1', fullName: 'def', status: 'ACTIVE' },
    );

    expect(diff).toEqual({
      schema: 'KLTN_AUDIT_DIFF_V1',
      fieldsChanged: ['fullName'],
      changes: [
        {
          field: 'fullName',
          label: 'Họ tên',
          before: '[REDACTED]',
          after: '[REDACTED]',
          sensitivity: 'PII',
          storedRedacted: true,
        },
      ],
    });
  });

  it('shows PII values only to ADMIN with face step-up', () => {
    const diff = buildAuditDiff({ fullName: 'abc' }, { fullName: 'def' });

    expect(toDisplayAuditDiff(diff, { role: 'ADMIN', faceVerified: true })).toEqual([
      {
        field: 'fullName',
        label: 'Họ tên',
        before: '[REDACTED]',
        after: '[REDACTED]',
        sensitivity: 'PII',
        storedRedacted: true,
        redacted: true,
        reason: 'PII không được lưu plaintext trong diff; xem snapshot mã hóa qua quy trình break-glass nếu cần.',
        policyCode: 'AUDIT_REDACT_PII_STORED',
        summary: 'Họ tên đã thay đổi',
        changeKind: 'PII',
        entity: undefined,
        entityLabel: 'Đối tượng',
        fieldPath: 'Entity.fullName',
      },
    ]);
    expect(toDisplayAuditDiff(diff, { role: 'RECEPTIONIST', faceVerified: true })[0]).toMatchObject({
      before: '[REDACTED]',
      after: '[REDACTED]',
      redacted: true,
      summary: 'Họ tên đã thay đổi',
    });
  });

  it('never leaks raw avatarUrl values in stored or displayed diff', () => {
    const diff = buildAuditDiff(
      { avatarUrl: 'https://cdn.example/old-avatar.png' },
      { avatarUrl: 'https://cdn.example/new-avatar.png' },
    );

    expect(diff.fieldsChanged).toEqual(['avatarUrl']);
    expect(diff.changes[0]).toMatchObject({
      field: 'avatarUrl',
      label: 'Ảnh đại diện',
      before: '[REDACTED]',
      after: '[REDACTED]',
      sensitivity: 'FILE_URL',
    });
    expect(JSON.stringify(diff)).not.toContain('cdn.example');

    const display = toDisplayAuditDiff(diff, { role: 'ADMIN', faceVerified: true });
    expect(display[0]).toMatchObject({
      before: '[REDACTED]',
      after: '[REDACTED]',
      storedRedacted: true,
      redacted: true,
      policyCode: 'AUDIT_REDACT_FILE_URL',
      summary: 'Ảnh đại diện đã thay đổi',
    });
  });

  it('hides clinical text by default and only shows it for privileged clinical context', () => {
    const diff = buildAuditDiff({ diagnosis: 'old diagnosis' }, { diagnosis: 'new diagnosis' });

    expect(diff.changes[0]).toMatchObject({
      field: 'diagnosis',
      label: 'Chẩn đoán',
      before: '[REDACTED]',
      after: '[REDACTED]',
      sensitivity: 'CLINICAL_TEXT',
      storedRedacted: true,
    });

    expect(toDisplayAuditDiff(diff, { role: 'ADMIN', faceVerified: true })[0]).toMatchObject({
      redacted: true,
      policyCode: 'AUDIT_REDACT_CLINICAL_STORED',
      summary: 'Chẩn đoán đã thay đổi',
    });
  });

  it('classifies unknown url/file fields as FILE_URL defense-in-depth', () => {
    expect(classifyAuditField('downloadUrl')).toBe('FILE_URL');
    expect(classifyAuditField('xrayFileName')).toBe('FILE_URL');
    expect(classifyAuditField('customUrl')).toBe('FILE_URL');
    expect(classifyAuditField('passwordHash')).toBe('REDACTED');
    expect(classifyAuditField('faceEmbedding')).toBe('REDACTED');
  });

  it('keeps safe scalar changes readable', () => {
    const diff = buildAuditDiff({ status: 'PENDING' }, { status: 'ACTIVE' });
    expect(toDisplayAuditDiff(diff, { role: 'RECEPTIONIST' })[0]).toEqual({
      field: 'status',
      label: 'status',
      before: 'PENDING',
      after: 'ACTIVE',
      sensitivity: 'SAFE',
      storedRedacted: false,
      fieldPath: 'Entity.status',
      entity: undefined,
      entityLabel: 'Đối tượng',
      changeKind: 'SAFE',
      redacted: false,
      summary: 'status: PENDING → ACTIVE',
    });
  });
});
