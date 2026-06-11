import { BadRequestException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { UpdateStaffUseCase } from './update-staff.use-case';
import { STAFF_REPOSITORY } from '../ports/staff.repository.port';
import { STAFF_INTEGRITY_ANCHOR } from '../ports/staff-integrity-anchor.port';
import { DOCTOR_REANCHOR } from '../../../doctor/application/ports/doctor-reanchor.port';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { StaffValidator } from '../services/staff.validator';

describe('UpdateStaffUseCase audit V2', () => {
  const staff = {
    id: 'staff-1',
    userId: 'user-1',
    employeeCode: 'NV-0001',
    fullName: 'abc',
    phone: '0900000000',
    gender: 'MALE',
    citizenId: '001122334455',
    birthDate: new Date('1990-01-01T00:00:00.000Z'),
    address: 'old address',
    avatarUrl: 'https://cdn.example/old.png',
    departmentId: 'dept-1',
    position: 'Nurse',
    user: { role: UserRole.RECEPTIONIST },
    doctorProfile: null,
  };

  function setup() {
    const repo = {
      updateStaffUser: jest.fn(async (_userId, _data, afterUpdate) => {
        const updated = {
          id: 'user-1',
          staffProfile: {
            ...staff,
            fullName: 'def',
            avatarUrl: 'https://cdn.example/new.png',
          },
        };
        if (afterUpdate) await afterUpdate(updated, { tx: true });
        return updated;
      }),
      findDepartment: jest.fn(),
    };
    const integrity = { anchorChange: jest.fn().mockResolvedValue(undefined) };
    const doctorReanchor = { reanchorForStaffUpdate: jest.fn().mockResolvedValue(undefined) };
    const validator = {
      ensureStaff: jest.fn().mockResolvedValue(staff),
      assertDepartmentRoleCompatible: jest.fn(),
      assertUserUnique: jest.fn(),
      assertCitizenIdUnique: jest.fn(),
    };
    const audit = { recordV2: jest.fn().mockResolvedValue(undefined) };
    const useCase = new UpdateStaffUseCase(
      repo as any,
      integrity as any,
      doctorReanchor as any,
      validator as any,
      audit as unknown as AuditLoggerService,
    );
    return { useCase, repo, integrity, doctorReanchor, validator, audit };
  }

  it('records encrypted V2 StaffProfile diff inside the update transaction', async () => {
    const { useCase, repo, audit, integrity } = setup();

    await useCase.execute('staff-1', { fullName: 'def', avatarUrl: 'https://cdn.example/new.png' } as any, 'admin-1');

    expect(repo.updateStaffUser).toHaveBeenCalledTimes(1);
    expect(audit.recordV2).toHaveBeenCalledWith(
      {
        entity: 'StaffProfile',
        entityId: 'staff-1',
        action: 'UPDATE',
        actorId: 'admin-1',
        before: expect.objectContaining({ fullName: 'abc', avatarUrl: 'https://cdn.example/old.png' }),
        after: expect.objectContaining({ fullName: 'def', avatarUrl: 'https://cdn.example/new.png' }),
        metadata: { source: 'staff.update' },
      },
      { tx: true },
    );
    expect(integrity.anchorChange).toHaveBeenCalledTimes(1);
  });

  it('propagates audit failures so the repository transaction can rollback', async () => {
    const { useCase, audit } = setup();
    audit.recordV2.mockRejectedValueOnce(new Error('audit failed'));

    await expect(useCase.execute('staff-1', { fullName: 'def' } as any, 'admin-1')).rejects.toThrow('audit failed');
  });

  it('does not write StaffProfile V2 audit from this path for doctor profiles', async () => {
    const { useCase, validator, audit, doctorReanchor } = setup();
    validator.ensureStaff.mockResolvedValueOnce({ ...staff, doctorProfile: { id: 'doctor-1', specialty: 'CARDIOLOGY' }, user: { role: UserRole.DOCTOR } });

    await useCase.execute('staff-1', { fullName: 'def' } as any, 'admin-1');

    expect(audit.recordV2).not.toHaveBeenCalled();
    expect(doctorReanchor.reanchorForStaffUpdate).toHaveBeenCalledWith('staff-1', 'admin-1');
  });

  it('still blocks role escalation to admin before audit write', async () => {
    const { useCase, audit } = setup();

    await expect(useCase.execute('staff-1', { role: UserRole.ADMIN } as any, 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(audit.recordV2).not.toHaveBeenCalled();
  });
});
