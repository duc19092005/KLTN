import { BadRequestException } from '@nestjs/common';
import { UpdateDepartmentUseCase } from './update-department.use-case';

describe('UpdateDepartmentUseCase structural rules', () => {
  function makeUseCase(referenceCount: number) {
    const existing = {
      id: 'department-1',
      departmentCode: 'PB-LAB',
      name: 'Xét nghiệm',
      type: 'LABORATORY',
      canReceiveOrders: true,
      status: 'ACTIVE',
      staffs: [],
    };
    const repo = {
      findByIdOrThrow: jest.fn().mockResolvedValue(existing),
      countBusinessReferences: jest.fn().mockResolvedValue(referenceCount),
      update: jest.fn().mockImplementation(async (_id, data) => ({ ...existing, ...data })),
    };
    const integrity = { anchorChange: jest.fn().mockResolvedValue(undefined) };
    const validator = {
      assertNameUnique: jest.fn(),
      assertDepartmentCodeUnique: jest.fn(),
    };
    const entityRecovery = { assertTrusted: jest.fn().mockResolvedValue(undefined) };
    return { useCase: new UpdateDepartmentUseCase(repo as never, integrity as never, validator as never, entityRecovery as never), repo };
  }

  it('blocks changing structural fields after business data exists', async () => {
    const { useCase, repo } = makeUseCase(2);
    await expect(useCase.execute('department-1', { type: 'IMAGING' } as never)).rejects.toThrow(BadRequestException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('still allows description updates when business data exists', async () => {
    const { useCase, repo } = makeUseCase(2);
    await expect(useCase.execute('department-1', { description: 'Mô tả mới' } as never)).resolves.toBeTruthy();
    expect(repo.update).toHaveBeenCalled();
  });
});
