import { BadRequestException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { UpdateStaffUseCase } from './update-staff.use-case';
import { STAFF_REPOSITORY } from '../ports/staff.repository.port';
import { STAFF_INTEGRITY_ANCHOR } from '../ports/staff-integrity-anchor.port';
import { DOCTOR_REANCHOR } from '../../../doctor/application/ports/doctor-reanchor.port';
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
    const doctorReanchor = {
      reanchorSnapshot: jest.fn().mockResolvedValue(undefined),
      reanchorForStaffUpdate: jest.fn().mockResolvedValue(undefined),
    };
    const validator = {
      ensureStaff: jest.fn().mockResolvedValue(staff),
      assertDepartmentRoleCompatible: jest.fn(),
      assertUserUnique: jest.fn(),
      assertCitizenIdUnique: jest.fn(),
    };
    const useCase = new UpdateStaffUseCase(
      repo as any,
      integrity as any,
      doctorReanchor as any,
      validator as any,
    );
    return { useCase, repo, integrity, doctorReanchor, validator };
  }

  it('records encrypted V2 StaffProfile diff inside the update transaction', async () => {
    const { useCase, repo, integrity } = setup();

    await useCase.execute('staff-1', { fullName: 'def', avatarUrl: 'https://cdn.example/new.png' } as any, 'admin-1');

    expect(repo.updateStaffUser).toHaveBeenCalledTimes(1);
    expect(integrity.anchorChange).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: 'def', avatarUrl: 'https://cdn.example/new.png' }),
      'UPDATE',
      'admin-1',
      expect.objectContaining({ fullName: 'abc', avatarUrl: 'https://cdn.example/old.png' }),
      { tx: true },
    );
  });

  it('propagates audit failures so the repository transaction can rollback', async () => {
    const { useCase, integrity } = setup();
    integrity.anchorChange.mockRejectedValueOnce(new Error('audit failed'));

    await expect(useCase.execute('staff-1', { fullName: 'def' } as any, 'admin-1')).rejects.toThrow('audit failed');
  });

  it('does not write StaffProfile V2 audit from this path for doctor profiles', async () => {
    const { useCase, repo, validator, integrity, doctorReanchor } = setup();
    validator.ensureStaff.mockResolvedValueOnce({ ...staff, doctorProfile: { id: 'doctor-1', specialty: 'CARDIOLOGY' }, user: { role: UserRole.DOCTOR } });
    repo.updateStaffUser.mockImplementationOnce(async (_userId, _data, afterUpdate) => {
      const updated = {
        id: 'user-1',
        staffProfile: {
          ...staff,
          fullName: 'def',
          doctorProfile: { id: 'doctor-1', staffProfileId: 'staff-1', specialty: 'CARDIOLOGY' },
        },
      };
      await afterUpdate(updated, { tx: true });
      return updated;
    });

    await useCase.execute('staff-1', { fullName: 'def' } as any, 'admin-1');

    expect(integrity.anchorChange).not.toHaveBeenCalled();
    expect(doctorReanchor.reanchorSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'doctor-1' }),
      'admin-1',
      expect.any(Object),
      'UPDATE',
      { tx: true },
    );
  });

  it('still blocks role escalation to admin before audit write', async () => {
    const { useCase, integrity } = setup();

    await expect(useCase.execute('staff-1', { role: UserRole.ADMIN } as any, 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(integrity.anchorChange).not.toHaveBeenCalled();
  });
});
