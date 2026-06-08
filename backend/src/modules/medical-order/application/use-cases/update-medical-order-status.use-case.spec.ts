import { ForbiddenException } from '@nestjs/common';
import { MedicalOrderStatus, UserRole } from '@prisma/client';
import { UpdateMedicalOrderStatusUseCase } from './update-medical-order-status.use-case';
import { MedicalOrderAccessPolicy } from '../policies/medical-order-access.policy';
import { AuthUser } from '../../../../common/types/auth-user.type';

describe('UpdateMedicalOrderStatusUseCase shift enforcement and DEMO_MODE', () => {
  const originalDemoMode = process.env.DEMO_MODE;
  const order = {
    id: 'order-1',
    targetDepartmentId: 'dept-lab-1',
    status: MedicalOrderStatus.ORDERED,
    visitId: 'visit-1',
  };
  const actualStaffUserId = 'actual-staff-user-1';
  const authUser: AuthUser = {
    sub: actualStaffUserId,
    role: UserRole.LAB_MANAGER,
    verified: true,
    staffId: 'staff-1',
    shiftId: 'shift-1',
  };

  afterEach(() => {
    process.env.DEMO_MODE = originalDemoMode;
    jest.restoreAllMocks();
  });

  function makeUseCase(options: { shiftFound: boolean }) {
    const repo = {
      findOrderForManage: jest.fn().mockResolvedValue(order),
      findStaffByUserId: jest.fn().mockResolvedValue({ id: 'staff-1', userId: actualStaffUserId, departmentId: 'dept-lab-1' }),
      findActiveApprovedShiftForStaffDepartment: jest.fn().mockResolvedValue(
        options.shiftFound
          ? {
              id: 'shift-1',
              staffId: 'staff-1',
              departmentId: 'dept-lab-1',
              staff: { userId: actualStaffUserId, departmentId: 'dept-lab-1' },
            }
          : null,
      ),
      updateStatus: jest.fn().mockResolvedValue({ ...order, status: MedicalOrderStatus.IN_PROGRESS }),
    };

    const useCase = new UpdateMedicalOrderStatusUseCase(repo as any, new MedicalOrderAccessPolicy());
    return { useCase, repo };
  }

  it('DEMO_MODE=false: rejects status update outside approved shift time window', async () => {
    process.env.DEMO_MODE = 'false';
    const { useCase, repo } = makeUseCase({ shiftFound: false });

    await expect(useCase.execute(order.id, MedicalOrderStatus.IN_PROGRESS, authUser)).rejects.toThrow(ForbiddenException);

    expect(repo.findActiveApprovedShiftForStaffDepartment).toHaveBeenCalledWith('staff-1', 'dept-lab-1', expect.any(Date), false);
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it('DEMO_MODE=true: bypasses time window constraints and allows approved inactive-time shift to update status', async () => {
    process.env.DEMO_MODE = 'true';
    const { useCase, repo } = makeUseCase({ shiftFound: true });

    await expect(useCase.execute(order.id, MedicalOrderStatus.IN_PROGRESS, authUser)).resolves.toEqual({
      ...order,
      status: MedicalOrderStatus.IN_PROGRESS,
    });

    expect(repo.findActiveApprovedShiftForStaffDepartment).toHaveBeenCalledWith('staff-1', 'dept-lab-1', expect.any(Date), true);
    expect(repo.updateStatus).toHaveBeenCalledWith(order.id, MedicalOrderStatus.IN_PROGRESS, undefined);
  });
});
