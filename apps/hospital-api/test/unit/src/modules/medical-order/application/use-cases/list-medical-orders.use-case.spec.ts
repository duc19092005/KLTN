import { ListMedicalOrdersUseCase } from '../../../../../../../src/modules/medical-order/application/use-cases/list-medical-orders.use-case';

describe('ListMedicalOrdersUseCase integrity pagination', () => {
  it('limits a page to 10 and exposes order/result integrity states', async () => {
    const orders = [{ id: 'order-1', results: [{ id: 'result-1' }] }];
    const repo = {
      findAll: jest.fn().mockResolvedValue({ items: orders, total: 21 }),
      findDoctorIdByUserId: jest.fn(),
      findStaffByUserId: jest.fn(),
    } as any;
    const policy = { buildListScope: jest.fn().mockResolvedValue({ targetDepartmentId: 'dept-1' }) } as any;
    const orderIntegrity = { evaluateMany: jest.fn().mockResolvedValue(new Map([['order-1', { status: 'VERIFIED' }]])) } as any;
    const resultIntegrity = { evaluateMany: jest.fn().mockResolvedValue(new Map([['result-1', { status: 'PENDING_ANCHOR' }]])) } as any;
    const useCase = new ListMedicalOrdersUseCase(repo, orderIntegrity, resultIntegrity, policy);

    const response = await useCase.execute({ page: 2, limit: 99 } as any, { sub: 'user-1', role: 'LAB_MANAGER' } as any);

    expect(repo.findAll).toHaveBeenCalledWith(expect.objectContaining({ targetDepartmentId: 'dept-1' }), 10, 10);
    expect(orderIntegrity.evaluateMany).toHaveBeenCalledWith(orders);
    expect(resultIntegrity.evaluateMany).toHaveBeenCalledWith(orders[0].results);
    expect(response.items[0]).toMatchObject({ blockchainStatus: 'VERIFIED' });
    expect(response.items[0].results[0]).toMatchObject({ blockchainStatus: 'PENDING_ANCHOR' });
    expect(response).toMatchObject({ page: 2, limit: 10, total: 21 });
  });

  it('preserves neutral VERIFICATION_UNAVAILABLE instead of marking a row tampered', async () => {
    const repo = { findAll: jest.fn().mockResolvedValue({ items: [{ id: 'order-1', results: [] }], total: 1 }) } as any;
    const policy = { buildListScope: jest.fn().mockResolvedValue({}) } as any;
    const unavailable = { status: 'VERIFICATION_UNAVAILABLE', reason: 'CHAIN_READ_FAILED' };
    const orderIntegrity = { evaluateMany: jest.fn().mockResolvedValue(new Map([['order-1', unavailable]])) } as any;
    const resultIntegrity = { evaluateMany: jest.fn().mockResolvedValue(new Map()) } as any;
    const response = await new ListMedicalOrdersUseCase(repo, orderIntegrity, resultIntegrity, policy)
      .execute({} as any, { sub: 'admin', role: 'ADMIN' } as any);

    expect(response.items[0].blockchainStatus).toBe('VERIFICATION_UNAVAILABLE');
  });
});


