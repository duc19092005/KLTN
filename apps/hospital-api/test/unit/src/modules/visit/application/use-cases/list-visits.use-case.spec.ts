import { ListVisitsUseCase } from '../../../../../../../src/modules/visit/application/use-cases/list-visits.use-case';

describe('ListVisitsUseCase integrity pagination', () => {
  it('uses a fixed 10-row page and adds integrity status', async () => {
    const item = { id: 'visit-1' };
    const repo = {
      findManyPaginated: jest.fn().mockResolvedValue({ items: [item], total: 11 }),
      findDoctorStaffByUserId: jest.fn(),
    } as any;
    const integrity = { evaluateMany: jest.fn().mockResolvedValue(new Map([['visit-1', { status: 'VERIFIED' }]])) } as any;
    const useCase = new ListVisitsUseCase(repo, integrity);

    const response = await useCase.execute({ query: { page: 2, limit: 50 } as any, user: { sub: 'admin', role: 'ADMIN' } as any });

    expect(repo.findManyPaginated).toHaveBeenCalledWith(expect.any(Object), 10, 10);
    expect(integrity.evaluateMany).toHaveBeenCalledWith([item]);
    expect(response.items[0].blockchainStatus).toBe('VERIFIED');
    expect(response).toMatchObject({ page: 2, limit: 10, total: 11 });
  });
});


