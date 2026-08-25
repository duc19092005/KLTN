import { ForbiddenException } from '@nestjs/common';
import { MedicalOrderStatus, UserRole } from '@prisma/client';
import { UpdateMedicalOrderStatusUseCase } from '../../../../../../../src/modules/medical-order/application/use-cases/update-medical-order-status.use-case';
import { MedicalOrderAccessPolicy } from '../../../../../../../src/modules/medical-order/application/policies/medical-order-access.policy';
import { AuthUser } from '../../../../../../../src/common/types/auth-user.type';

describe('UpdateMedicalOrderStatusUseCase', () => {
  const order = {
    id: 'order-1',
    targetDepartmentId: 'dept-lab-1',
    status: MedicalOrderStatus.ORDERED,
    visitId: 'visit-1',
    orderType: 'LAB_TEST',
  };
  const actualStaffUserId = 'actual-staff-user-1';
  const authUser: AuthUser = {
    sub: actualStaffUserId,
    role: UserRole.LAB_MANAGER,
    verified: true,
    staffId: 'staff-1',
  };

  function makeUseCase(options: { departmentId: string }) {
    const repo = {
      findOrderForManage: jest.fn().mockResolvedValue(order),
      findStaffByUserId: jest.fn().mockResolvedValue({ id: 'staff-1', userId: actualStaffUserId, departmentId: options.departmentId }),
      updateStatus: jest.fn().mockResolvedValue({ ...order, status: MedicalOrderStatus.IN_PROGRESS }),
    };

    const useCase = new UpdateMedicalOrderStatusUseCase(repo as any, new MedicalOrderAccessPolicy(), { recordV2: jest.fn() } as any, { assertManyTrusted: jest.fn().mockResolvedValue([]), assertTrusted: jest.fn().mockResolvedValue(undefined) } as any);
    return { useCase, repo };
  }

  it('allows status update when staff department matches order target department', async () => {
    const { useCase, repo } = makeUseCase({ departmentId: 'dept-lab-1' });

    await expect(useCase.execute(order.id, MedicalOrderStatus.IN_PROGRESS, authUser)).resolves.toEqual({
      ...order,
      status: MedicalOrderStatus.IN_PROGRESS,
    });

    expect(repo.updateStatus).toHaveBeenCalledWith(
      order.id,
      MedicalOrderStatus.IN_PROGRESS,
      undefined,
      expect.anything(),
      expect.anything(),
    );
  });

  it('rejects status update when staff department does not match order target department', async () => {
    const { useCase, repo } = makeUseCase({ departmentId: 'dept-lab-different' });

    await expect(useCase.execute(order.id, MedicalOrderStatus.IN_PROGRESS, authUser)).rejects.toThrow(ForbiddenException);
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });
});
