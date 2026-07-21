import { ConflictException } from '@nestjs/common';
import { AdministrativeLifecycleService } from '../../../../../src/common/lifecycle/administrative-lifecycle.service';

describe('AdministrativeLifecycleService', () => {
  function makeService(overrides: {
    deletedAt?: Date | null;
    references?: number;
  } = {}) {
    const department = {
      id: 'dept-1',
      status: 'DELETE',
      deletedAt: overrides.deletedAt ?? new Date(),
      departmentCode: 'PB-LAB',
      _count: {
        staffs: overrides.references ?? 0,
        visits: 0,
        medicalOrders: 0,
        appointments: 0,
        blockchainLogs: 5,
      },
    };
    const prisma = {
      department: {
        findUnique: jest.fn().mockResolvedValue(department),
        delete: jest.fn().mockResolvedValue(department),
        update: jest.fn().mockResolvedValue({ ...department, status: 'INACTIVE' }),
      },
      $transaction: jest.fn().mockImplementation(async (fn) => fn({
        $executeRaw: jest.fn().mockResolvedValue(1),
        department: {
          update: jest.fn().mockResolvedValue({ ...department, status: 'INACTIVE', deletedAt: null }),
          delete: jest.fn().mockResolvedValue(department),
        },
      })),
    };
    const audit = { recordV2: jest.fn().mockResolvedValue(undefined) };
    const entityRecovery = { assertTrusted: jest.fn().mockResolvedValue(undefined) };
    return {
      service: new AdministrativeLifecycleService(prisma as never, audit as never, entityRecovery as never),
      prisma,
      audit,
      entityRecovery,
    };
  }

  it('rejects restore after the 30-day window', async () => {
    const deletedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const { service } = makeService({ deletedAt });

    await expect(service.restore('departments', 'dept-1', 'admin-1')).rejects.toThrow(ConflictException);
  });

  it('rejects permanent delete when business references remain', async () => {
    const { service } = makeService({ references: 2 });

    await expect(service.permanentDelete('departments', 'dept-1', 'admin-1')).rejects.toThrow(
      /dữ liệu nghiệp vụ liên quan/,
    );
  });

  it('allows permanent delete when only audit logs remain', async () => {
    const { service, audit } = makeService({ references: 0 });

    await expect(service.permanentDelete('departments', 'dept-1', 'admin-1')).resolves.toEqual({
      permanentlyDeleted: true,
      id: 'dept-1',
    });
    expect(audit.recordV2).toHaveBeenCalled();
  });

  it('builds a versioned encrypted-recovery payload for a cascaded staff user', () => {
    const { service } = makeService();
    const staff = {
      id: 'staff-1', userId: 'user-1', employeeCode: 'NV-0001', fullName: 'Nhan Vien A',
      phone: '0900000001', gender: 'MALE', citizenId: '001122334455', birthDate: new Date('1990-01-01'),
      address: null, avatarUrl: '/avatar.png', departmentId: null, position: 'Receptionist', labSpecialty: null,
      user: {
        id: 'user-1', username: 'nhanviena', email: 'staff@example.test', phone: '0900000001',
        phoneNormalized: '84900000001', passwordHash: '$argon2id$trusted-hash', role: 'RECEPTIONIST', status: 'DELETE',
        firstLogin: false, registrationStep: 2, tokenVersion: 4,
      },
    };

    const snapshot = (service as any).permanentDeletionSnapshot('staff', staff);
    expect(snapshot._recovery).toMatchObject({
      schema: 'KLTN_ENTITY_RECOVERY_V1', targetEntity: 'StaffProfile',
      user: { id: 'user-1', passwordHash: '$argon2id$trusted-hash', role: 'RECEPTIONIST' },
      staff: { userId: 'user-1' },
    });
  });

  it('keeps the audit-actor User tombstone and deletes only StaffProfile', async () => {
    const staff = {
      id: 'staff-1', userId: 'user-1', employeeCode: 'NV-0001', fullName: 'Nhan Vien A', phone: '0900000001',
      gender: 'MALE', citizenId: '001122334455', birthDate: new Date('1990-01-01'), address: null,
      avatarUrl: '/avatar.png', departmentId: null, position: 'Receptionist', labSpecialty: null,
      user: { id: 'user-1', role: 'RECEPTIONIST', status: 'DELETE', tokenVersion: 2 },
      doctorProfile: null, managedDepartment: null, _count: { assignedVisits: 0, blockchainLogs: 4 },
    };
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      staffProfile: { delete: jest.fn().mockResolvedValue(staff) },
      user: { delete: jest.fn() },
    };
    const prisma = {
      staffProfile: { findUnique: jest.fn().mockResolvedValue(staff) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const audit = { recordV2: jest.fn().mockResolvedValue(undefined) };
    const entityRecovery = { assertTrusted: jest.fn().mockResolvedValue(undefined) };
    const service = new AdministrativeLifecycleService(prisma as never, audit as never, entityRecovery as never);

    await service.permanentDelete('staff', 'staff-1', 'admin-1');

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.staffProfile.delete).toHaveBeenCalledWith({ where: { id: 'staff-1' } });
    expect(tx.user.delete).not.toHaveBeenCalled();
  });
});
