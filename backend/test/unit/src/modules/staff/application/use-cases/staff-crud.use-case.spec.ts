import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { CreateStaffUseCase } from '../../../../../../../src/modules/staff/application/use-cases/create-staff.use-case';
import { SetStaffStatusUseCase } from '../../../../../../../src/modules/staff/application/use-cases/set-staff-status.use-case';

const dto = {
  username: 'le.tan'.replace('.', ''), email: 'le.tan@test.local', role: UserRole.RECEPTIONIST,
  fullName: 'Le Tan A', phone: '0909000000', gender: 'Nam', citizenId: '012345678901',
  birthDate: '1990-01-01', address: 'HCM', avatarUrl: 'https://avatar.test/a.png', position: 'Le tan', departmentId: 'dept-admin',
};

function makeStaff(overrides: Record<string, unknown> = {}) {
  return { id: 'staff-1', userId: 'user-1', employeeCode: 'LT-0001', fullName: dto.fullName, phone: dto.phone,
    gender: dto.gender, citizenId: dto.citizenId, birthDate: new Date(dto.birthDate), address: dto.address,
    avatarUrl: dto.avatarUrl, departmentId: dto.departmentId, position: dto.position,
    user: { id: 'user-1', role: UserRole.RECEPTIONIST, status: UserStatus.ACTIVE, tokenVersion: 1 }, doctorProfile: null, ...overrides };
}

describe('Staff create and lifecycle business rules', () => {
  function createSetup() {
    const created = { id: 'user-1', username: dto.username, email: dto.email, staffProfile: makeStaff() };
    const repo = {
      generateEmployeeCode: jest.fn().mockResolvedValue('LT-0001'), createStaffUser: jest.fn(async (_data, hook) => { await hook(created, { tx: true }); return created; }),
    };
    const integrity = { anchorChange: jest.fn().mockResolvedValue(undefined) };
    const passwordHasher = { hash: jest.fn().mockResolvedValue('hash') };
    const mailer = { sendTemporaryPassword: jest.fn().mockResolvedValue(undefined) };
    const validator = {
      ensureDepartment: jest.fn(), assertDepartmentRoleCompatible: jest.fn(), assertUserUnique: jest.fn(), assertCitizenIdUnique: jest.fn(),
      assertPhoneUnique: jest.fn(), assertEmployeeCodeUnique: jest.fn(), ensureStaff: jest.fn(),
    };
    return { useCase: new CreateStaffUseCase(repo as never, integrity as never, passwordHasher as never, mailer as never, validator as never), repo, integrity, passwordHasher, mailer, validator };
  }

  it('creates a valid non-doctor staff account, temporary credential and CREATE audit in one write hook', async () => {
    const { useCase, repo, integrity, passwordHasher, mailer, validator } = createSetup();
    await expect(useCase.execute(dto as never, 'admin-1')).resolves.toEqual(expect.objectContaining({ id: 'user-1' }));
    expect(validator.ensureDepartment).toHaveBeenCalledWith('dept-admin');
    expect(repo.generateEmployeeCode).toHaveBeenCalledWith(UserRole.RECEPTIONIST);
    expect(passwordHasher.hash).toHaveBeenCalledTimes(1);
    expect(integrity.anchorChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'staff-1' }), 'CREATE', 'admin-1', null, { tx: true });
    expect(mailer.sendTemporaryPassword).toHaveBeenCalledWith(expect.objectContaining({ to: dto.email, username: dto.username }));
  });

  it.each([UserRole.ADMIN, UserRole.DOCTOR])('rejects role %s in the staff module', async (role) => {
    const { useCase, repo } = createSetup();
    await expect(useCase.execute({ ...dto, role } as never, 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.createStaffUser).not.toHaveBeenCalled();
  });

  it.each(['assertUserUnique', 'assertCitizenIdUnique', 'assertPhoneUnique', 'assertEmployeeCodeUnique'] as const)('does not create staff when %s reports duplicate data', async (method) => {
    const { useCase, repo, validator } = createSetup();
    validator[method].mockRejectedValueOnce(new ConflictException('duplicate'));
    await expect(useCase.execute(dto as never, 'admin-1')).rejects.toBeInstanceOf(ConflictException);
    expect(repo.createStaffUser).not.toHaveBeenCalled();
  });

  it('rejects a missing department or a department incompatible with the staff role', async () => {
    const { useCase, repo, validator } = createSetup();
    validator.ensureDepartment.mockRejectedValueOnce(new NotFoundException('missing'));
    await expect(useCase.execute(dto as never, 'admin-1')).rejects.toBeInstanceOf(NotFoundException);
    validator.ensureDepartment.mockResolvedValueOnce(undefined);
    validator.assertDepartmentRoleCompatible.mockRejectedValueOnce(new BadRequestException('incompatible'));
    await expect(useCase.execute(dto as never, 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.createStaffUser).not.toHaveBeenCalled();
  });

  function statusSetup(staff = makeStaff()) {
    const repo = { setUserStatus: jest.fn(async (_id, status, hook) => { const { user: _user, ...profile } = staff; const updated = { id: 'user-1', role: staff.user.role, status, tokenVersion: 2, staffProfile: profile }; await hook(updated, { tx: true }); return updated; }) };
    const integrity = { anchorChange: jest.fn().mockResolvedValue(undefined) };
    const doctorReanchor = { reanchorSnapshot: jest.fn().mockResolvedValue(undefined) };
    const validator = { ensureStaff: jest.fn().mockResolvedValue(staff) };
    const entityRecovery = { assertTrusted: jest.fn().mockResolvedValue(undefined) };
    return { useCase: new SetStaffStatusUseCase(repo as never, integrity as never, doctorReanchor as never, validator as never, entityRecovery as never), repo, integrity, doctorReanchor, entityRecovery };
  }

  it.each([[UserStatus.INACTIVE, 'UPDATE'], [UserStatus.ACTIVE, 'UPDATE'], [UserStatus.DELETE, 'DELETE']] as const)('changes staff status to %s and records %s audit', async (status, action) => {
    const { useCase, repo, integrity, entityRecovery } = statusSetup();
    await useCase.execute('staff-1', status, 'admin-1');
    expect(entityRecovery.assertTrusted).toHaveBeenCalledWith('StaffProfile', 'staff-1');
    expect(repo.setUserStatus).toHaveBeenCalledWith('user-1', status, expect.any(Function));
    expect(integrity.anchorChange).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ status }) }), action, 'admin-1', expect.any(Object), { tx: true });
  });

  it('uses DoctorProfile audit instead of StaffProfile audit when status changes on a doctor', async () => {
    const doctor = makeStaff({ doctorProfile: { id: 'doctor-1', staffProfileId: 'staff-1', specialty: 'CARDIOLOGY' }, user: { id: 'user-1', role: UserRole.DOCTOR, status: UserStatus.ACTIVE } });
    const { useCase, integrity, doctorReanchor } = statusSetup(doctor);
    await useCase.execute('staff-1', UserStatus.DELETE, 'admin-1');
    expect(integrity.anchorChange).not.toHaveBeenCalled();
    expect(doctorReanchor.reanchorSnapshot).toHaveBeenCalledWith(expect.objectContaining({ id: 'doctor-1' }), 'admin-1', expect.any(Object), 'DELETE', { tx: true });
  });
});
