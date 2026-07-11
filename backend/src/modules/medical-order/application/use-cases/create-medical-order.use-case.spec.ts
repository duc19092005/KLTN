import { CreateMedicalOrderUseCase } from './create-medical-order.use-case';

describe('CreateMedicalOrderUseCase audit transaction', () => {
  function makeUseCase(auditFails = false) {
    const tx = { transaction: true };
    const order = {
      id: 'order-1',
      orderCode: 'ORD-00001',
      visitId: 'visit-1',
      patientId: 'patient-1',
      doctorId: 'doctor-1',
      targetDepartmentId: 'lab-1',
      orderType: 'LAB_TEST',
      priority: 'NORMAL',
      status: 'ORDERED',
    };
    const repo = {
      findVisitForOrder: jest.fn().mockResolvedValue({
        id: 'visit-1', patientId: 'patient-1', departmentId: 'exam-1', staffId: 'staff-1', status: 'IN_PROGRESS',
      }),
      findDoctorStaffByUserId: jest.fn().mockResolvedValue({ doctorId: 'doctor-1', staffId: 'staff-1', departmentId: 'exam-1' }),
      findOrderDepartment: jest.fn().mockResolvedValue({ id: 'lab-1', type: 'LABORATORY', status: 'ACTIVE', canReceiveOrders: true }),
      createOrderWithVisitTransition: jest.fn().mockImplementation(async (_command, onCreated) => {
        await onCreated(order, tx);
        return order;
      }),
    };
    const prisma = { staffProfile: { findMany: jest.fn().mockResolvedValue([]) } };
    const notifications = { createNotification: jest.fn() };
    const audit = {
      recordV2: jest.fn().mockImplementation(async () => {
        if (auditFails) throw new Error('audit failed');
      }),
    };
    return {
      useCase: new CreateMedicalOrderUseCase(repo as never, prisma as never, notifications as never, audit as never),
      repo,
      audit,
      tx,
    };
  }

  it('records the order audit through the repository transaction callback', async () => {
    const { useCase, audit, tx } = makeUseCase();
    await useCase.execute({ visitId: 'visit-1', targetDepartmentId: 'lab-1', orderType: 'LAB_TEST' } as never, 'doctor-user-1');
    expect(audit.recordV2).toHaveBeenCalledWith(expect.objectContaining({ entity: 'MedicalOrder', action: 'CREATE' }), tx);
  });

  it('propagates audit failure so order creation can rollback', async () => {
    const { useCase } = makeUseCase(true);
    await expect(
      useCase.execute({ visitId: 'visit-1', targetDepartmentId: 'lab-1', orderType: 'LAB_TEST' } as never, 'doctor-user-1'),
    ).rejects.toThrow('audit failed');
  });
});
