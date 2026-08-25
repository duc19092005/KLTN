import { CreateMedicalOrderUseCase } from '../../../../../../../src/modules/medical-order/application/use-cases/create-medical-order.use-case';

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
        const visitTransition = {
          visit: {
            id: 'visit-1',
            visitCode: 'V-00001',
            patientId: 'patient-1',
            departmentId: 'exam-1',
            staffId: 'staff-1',
            status: 'WAITING_TEST_RESULT',
            source: 'DIRECT',
            checkInAt: new Date().toISOString(),
            completedAt: null,
          },
          previousStatus: 'IN_PROGRESS',
        };
        await onCreated(order, visitTransition, tx);
        return order;
      }),
    };
    const prisma = { staffProfile: { findMany: jest.fn().mockResolvedValue([]) } };
    const notifications = { createNotification: jest.fn() };
    const orderIntegrity = { anchorChange: jest.fn().mockImplementation(async () => { if (auditFails) throw new Error('audit failed'); }) };
    const visitIntegrity = { anchorChange: jest.fn().mockResolvedValue(undefined) };
    return {
      useCase: new CreateMedicalOrderUseCase(repo as never, orderIntegrity as never, visitIntegrity as never, prisma as never, notifications as never, { assertManyTrusted: jest.fn().mockResolvedValue([]), assertTrusted: jest.fn().mockResolvedValue(undefined) } as any),
      repo,
      orderIntegrity,
      tx,
    };
  }

  it('records the order audit through the repository transaction callback', async () => {
    const { useCase, orderIntegrity, tx } = makeUseCase();
    await useCase.execute({ visitId: 'visit-1', targetDepartmentId: 'lab-1', orderType: 'LAB_TEST' } as never, 'doctor-user-1');
    expect(orderIntegrity.anchorChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'order-1' }), 'CREATE', 'doctor-user-1', null, tx);
  });

  it('propagates audit failure so order creation can rollback', async () => {
    const { useCase } = makeUseCase(true);
    await expect(
      useCase.execute({ visitId: 'visit-1', targetDepartmentId: 'lab-1', orderType: 'LAB_TEST' } as never, 'doctor-user-1'),
    ).rejects.toThrow('audit failed');
  });
});

