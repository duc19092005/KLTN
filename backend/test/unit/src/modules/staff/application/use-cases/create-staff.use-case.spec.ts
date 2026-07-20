import { UserRole, UserStatus } from '@prisma/client';
import { CreateStaffUseCase } from '../../../../../../../src/modules/staff/application/use-cases/create-staff.use-case';

describe('CreateStaffUseCase response serialization', () => {
  function setup() {
    const created = {
      id: 'user-1',
      username: 'receptionist1',
      email: 'staff@example.com',
      status: UserStatus.ACTIVE,
      staffProfile: {
        id: 'staff-1',
        employeeCode: 'LT-0001',
        fullName: 'Nhân viên Test',
        phone: '0900000000',
        gender: 'MALE',
        citizenId: '001122334455',
        birthDate: new Date('1990-01-01T00:00:00.000Z'),
        address: null,
        avatarUrl: 'https://cdn.example/avatar.png',
        departmentId: null,
        position: 'Lễ tân',
      },
    };
    const tx = { transaction: true };
    const repo = {
      generateEmployeeCode: jest.fn().mockResolvedValue('LT-0001'),
      createStaffUser: jest.fn(async (_data, afterCreate) => {
        await afterCreate?.(created, tx);
        return created;
      }),
    };
    const integrity = { anchorChange: jest.fn().mockResolvedValue(undefined) };
    const passwordHasher = { hash: jest.fn().mockResolvedValue('password-hash') };
    const mailer = { sendTemporaryPassword: jest.fn().mockResolvedValue(undefined) };
    const validator = {
      ensureDepartment: jest.fn(),
      assertDepartmentRoleCompatible: jest.fn(),
      assertUserUnique: jest.fn(),
      assertCitizenIdUnique: jest.fn(),
      assertPhoneUnique: jest.fn(),
      assertEmployeeCodeUnique: jest.fn(),
    };
    const useCase = new CreateStaffUseCase(
      repo as never,
      integrity as never,
      passwordHasher as never,
      mailer as never,
      validator as never,
    );
    const dto = {
      username: 'receptionist1', email: 'staff@example.com', role: UserRole.RECEPTIONIST,
      fullName: 'Nhân viên Test', phone: '0900000000', gender: 'MALE',
      citizenId: '001122334455', birthDate: '1990-01-01',
      avatarUrl: 'https://cdn.example/avatar.png', position: 'Lễ tân',
    };
    return { useCase, created, dto, integrity, tx };
  }

  it('returns a JSON-serializable user while anchoring a detached profile with status', async () => {
    const { useCase, created, dto, integrity, tx } = setup();
    const result = await useCase.execute(dto as never, 'admin-1');

    expect(() => JSON.stringify(result)).not.toThrow();
    expect(result).toBe(created);
    expect(created.staffProfile).not.toHaveProperty('user');
    expect(integrity.anchorChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'staff-1', user: { status: UserStatus.ACTIVE } }),
      'CREATE', 'admin-1', null, tx,
    );
  });

  it('propagates audit failures so creation and email remain inside rollback semantics', async () => {
    const { useCase, dto, integrity } = setup();
    integrity.anchorChange.mockRejectedValueOnce(new Error('audit failed'));
    await expect(useCase.execute(dto as never, 'admin-1')).rejects.toThrow('audit failed');
  });
});
