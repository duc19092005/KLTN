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
});
