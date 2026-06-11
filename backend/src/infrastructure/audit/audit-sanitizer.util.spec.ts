import { sanitizeAuditPayload } from './audit-sanitizer.util';

describe('audit-sanitizer.util', () => {
  it('redacts patient PII while preserving safe identifiers and status metadata', () => {
    const sanitized = sanitizeAuditPayload('Patient', {
      id: 'patient-1',
      patientId: 'patient-1',
      status: 'ACTIVE',
      fullName: 'Nguyen Van A',
      phone: '0900000000',
      citizenId: '001122334455',
      address: 'secret address',
      hash256: 'a'.repeat(64),
    }) as Record<string, unknown>;

    expect(sanitized.id).toBe('patient-1');
    expect(sanitized.patientId).toBe('patient-1');
    expect(sanitized.status).toBe('ACTIVE');
    expect(sanitized.hash256).toBe('a'.repeat(64));
    expect(sanitized.fullName).toBe('[REDACTED]');
    expect(sanitized.phone).toBe('[REDACTED]');
    expect(sanitized.citizenId).toBe('[REDACTED]');
    expect(sanitized.address).toBe('[REDACTED]');
  });

  it('redacts MedicalConclusion clinical free text', () => {
    const sanitized = sanitizeAuditPayload('MedicalConclusion', {
      id: 'conclusion-1',
      visitId: 'visit-1',
      doctorProfileId: 'doctor-1',
      finalDiagnosis: 'Sensitive diagnosis',
      treatmentPlan: 'Sensitive treatment',
      prescription: 'Sensitive prescription',
      doctorNote: 'Sensitive note',
      dataHash: 'b'.repeat(64),
    }) as Record<string, unknown>;

    expect(sanitized.id).toBe('conclusion-1');
    expect(sanitized.visitId).toBe('visit-1');
    expect(sanitized.doctorProfileId).toBe('doctor-1');
    expect(sanitized.dataHash).toBe('b'.repeat(64));
    expect(sanitized.finalDiagnosis).toBe('[REDACTED]');
    expect(sanitized.treatmentPlan).toBe('[REDACTED]');
    expect(sanitized.prescription).toBe('[REDACTED]');
    expect(sanitized.doctorNote).toBe('[REDACTED]');
  });

  it('redacts MedicalResult file names and URLs', () => {
    const sanitized = sanitizeAuditPayload('MedicalResult', {
      id: 'result-1',
      orderId: 'order-1',
      note: 'Sensitive result note',
      files: [
        {
          id: 'file-1',
          resultId: 'result-1',
          fileName: 'xray.png',
          originalName: 'patient-xray.png',
          url: 'https://res.cloudinary.com/demo/xray.png',
        },
      ],
    }) as Record<string, any>;

    expect(sanitized.id).toBe('result-1');
    expect(sanitized.orderId).toBe('order-1');
    expect(sanitized.note).toBe('[REDACTED]');
    expect(sanitized.files).toBe('[REDACTED]');
  });

  it('applies the global allowlist to non-clinical operational metadata', () => {
    const sanitized = sanitizeAuditPayload('Department', {
      id: 'dept-1',
      name: 'Khoa Tim mạch',
      apiEndpoint: 'https://internal.example/api',
      token: 'secret-token',
    }) as Record<string, unknown>;

    expect(sanitized.id).toBe('dept-1');
    expect(sanitized.name).toBe('[REDACTED]');
    expect(sanitized.apiEndpoint).toBe('[REDACTED]');
    expect(sanitized.token).toBe('[REDACTED]');
  });

  it('redacts staff/user PII under the global allowlist', () => {
    const sanitized = sanitizeAuditPayload('StaffProfile', {
      id: 'staff-1',
      staffProfileId: 'staff-1',
      role: 'LAB_MANAGER',
      email: 'lab@example.com',
      username: 'lab-user',
      dob: '1990-01-01',
      dateOfBirth: '1990-01-01',
      identityNumber: 'ID-123',
    });

    const serialized = JSON.stringify(sanitized);
    expect(serialized).toContain('staff-1');
    expect(serialized).not.toContain('lab@example.com');
    expect(serialized).not.toContain('lab-user');
    expect(serialized).not.toContain('1990-01-01');
    expect(serialized).not.toContain('ID-123');
  });
});
