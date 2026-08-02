import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CreateDoctorUseCase } from '../../../../../../../src/modules/doctor/application/use-cases/create-doctor.use-case';
import { CreateDoctorWithStaffUseCase } from '../../../../../../../src/modules/doctor/application/use-cases/create-doctor-with-staff.use-case';
import { UpdateDoctorUseCase } from '../../../../../../../src/modules/doctor/application/use-cases/update-doctor.use-case';

const doctorDto = { staffProfileId: 'staff-1', specialty: 'CARDIOLOGY', licenseNumber: 'CCHN-001', qualification: 'BSCKI', yearsExperience: 8 };
const fullDto = { username: 'doctora', email: 'doctora@test.local', fullName: 'Doctor A', phone: '0908000000', gender: 'Nam', citizenId: '012345678901', birthDate: '1985-01-01', address: 'HCM', avatarUrl: 'https://avatar.test/a.png', departmentId: 'dept-clinical', position: 'Bac si', ...doctorDto };
const doctor = { id: 'doctor-1', staffProfileId: 'staff-1', specialty: 'CARDIOLOGY', licenseNumber: 'CCHN-001', qualification: 'BSCKI', yearsExperience: 8, staffProfile: { id: 'staff-1', departmentId: 'dept-clinical', fullName: 'Doctor A', phone: '0908000000', citizenId: '012345678901', user: { status: 'ACTIVE' } } };

describe('Doctor create and update business rules', () => {
  function baseRepo() {
    return {
      findStaffForDoctorCreate: jest.fn().mockResolvedValue({ id: 'staff-1', userRole: UserRole.DOCTOR, hasDoctorProfile: false, departmentId: 'dept-clinical' }),
      findDepartment: jest.fn().mockResolvedValue({ id: 'dept-clinical', type: 'CLINICAL' }), findDoctorByLicense: jest.fn().mockResolvedValue(null),
      createForExistingStaff: jest.fn(async (_dto, hook) => { await hook(doctor, { tx: true }); return doctor; }),
      findUserByUsernameOrEmail: jest.fn().mockResolvedValue(null), findStaffByCitizenId: jest.fn().mockResolvedValue(null), findStaffByEmployeeCode: jest.fn().mockResolvedValue(null),
      generateEmployeeCode: jest.fn().mockResolvedValue('BS-0001'), createWithStaff: jest.fn(async (_dto, _code, _hash, hook) => { await hook(doctor, { tx: true }); return doctor; }),
      findByIdWithRelations: jest.fn().mockResolvedValue(doctor), updateWithRoom: jest.fn(async (_id, _dto, hook) => { const updated = { ...doctor, specialty: 'NEUROLOGY' }; await hook(updated, { tx: true }); return updated; }),
    };
  }

  it('creates a DoctorProfile only for an existing DOCTOR staff in a clinical department and anchors CREATE', async () => {
    const repo = baseRepo(); const integrity = { anchorChange: jest.fn().mockResolvedValue(undefined) };
    const useCase = new CreateDoctorUseCase(repo as never, integrity as never);
    await expect(useCase.execute(doctorDto as never, 'admin-1')).resolves.toEqual(doctor);
    expect(repo.createForExistingStaff).toHaveBeenCalled();
    expect(integrity.anchorChange).toHaveBeenCalledWith(doctor, 'CREATE', 'admin-1', null, { tx: true });
  });

  it.each([
    [null, NotFoundException], [{ id: 'staff-1', userRole: UserRole.RECEPTIONIST, hasDoctorProfile: false, departmentId: null }, BadRequestException],
    [{ id: 'staff-1', userRole: UserRole.DOCTOR, hasDoctorProfile: true, departmentId: null }, ConflictException],
  ])('rejects invalid staff eligibility for doctor profile', async (staff, error) => {
    const repo = baseRepo(); repo.findStaffForDoctorCreate.mockResolvedValueOnce(staff);
    const useCase = new CreateDoctorUseCase(repo as never, { anchorChange: jest.fn() } as never);
    await expect(useCase.execute(doctorDto as never, 'admin-1')).rejects.toBeInstanceOf(error as any);
    expect(repo.createForExistingStaff).not.toHaveBeenCalled();
  });

  it.each([[null, NotFoundException], [{ id: 'dept-x', type: 'LABORATORY' }, BadRequestException]])('rejects missing or non-clinical doctor department', async (department, error) => {
    const repo = baseRepo(); repo.findDepartment.mockResolvedValue(department);
    const useCase = new CreateDoctorUseCase(repo as never, { anchorChange: jest.fn() } as never);
    await expect(useCase.execute(doctorDto as never, 'admin-1')).rejects.toBeInstanceOf(error as any);
  });

  it('rejects duplicate medical license before creating a doctor profile', async () => {
    const repo = baseRepo(); repo.findDoctorByLicense.mockResolvedValueOnce({ id: 'doctor-other' });
    const useCase = new CreateDoctorUseCase(repo as never, { anchorChange: jest.fn() } as never);
    await expect(useCase.execute(doctorDto as never, 'admin-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates user, staff and doctor atomically with BS code, credential email and CREATE audit', async () => {
    const repo = baseRepo(); const integrity = { anchorChange: jest.fn().mockResolvedValue(undefined) }; const mailer = { sendTemporaryPassword: jest.fn().mockResolvedValue(undefined) };
    const useCase = new CreateDoctorWithStaffUseCase(repo as never, integrity as never, mailer as never);
    await useCase.execute(fullDto as never, 'admin-1');
    expect(repo.createWithStaff).toHaveBeenCalledWith(expect.objectContaining({ username: fullDto.username }), 'BS-0001', expect.any(String), expect.any(Function));
    expect(integrity.anchorChange).toHaveBeenCalledWith(doctor, 'CREATE', 'admin-1', null, { tx: true });
    expect(mailer.sendTemporaryPassword).toHaveBeenCalledWith(expect.objectContaining({ to: fullDto.email, username: fullDto.username }));
  });

  it.each(['findUserByUsernameOrEmail', 'findStaffByCitizenId', 'findDoctorByLicense', 'findStaffByEmployeeCode'] as const)('blocks full doctor creation on duplicate %s', async (method) => {
    const repo = baseRepo(); (repo[method] as jest.Mock).mockResolvedValueOnce({ id: 'exists' });
    const useCase = new CreateDoctorWithStaffUseCase(repo as never, { anchorChange: jest.fn() } as never, { sendTemporaryPassword: jest.fn() } as never);
    await expect(useCase.execute(fullDto as never, 'admin-1')).rejects.toBeInstanceOf(ConflictException);
    expect(repo.createWithStaff).not.toHaveBeenCalled();
  });

  it('updates allowed doctor and linked staff fields then anchors the unified doctor snapshot', async () => {
    const repo = baseRepo(); const integrity = { anchorChange: jest.fn().mockResolvedValue(undefined) }; const recovery = { assertTrusted: jest.fn().mockResolvedValue(undefined) };
    const useCase = new UpdateDoctorUseCase(repo as never, integrity as never, recovery as never);
    await useCase.execute('doctor-1', { specialty: 'NEUROLOGY', qualification: 'BSCKII', yearsExperience: 10 } as never, 'admin-1');
    expect(recovery.assertTrusted).toHaveBeenCalledWith('DoctorProfile', 'doctor-1');
    expect(repo.updateWithRoom).toHaveBeenCalled();
    expect(integrity.anchorChange).toHaveBeenCalledWith(expect.objectContaining({ specialty: 'NEUROLOGY' }), 'UPDATE', 'admin-1', expect.any(Object), { tx: true });
  });

  it.each([
    ['missing doctor', (repo: any) => repo.findByIdWithRelations.mockResolvedValueOnce(null), NotFoundException],
    ['duplicate license', (repo: any) => repo.findDoctorByLicense.mockResolvedValueOnce({ id: 'doctor-other' }), ConflictException],
    ['duplicate citizen id', (repo: any) => { repo.findStaffByCitizenId.mockResolvedValueOnce({ id: 'staff-other' }); }, ConflictException],
    ['invalid department', (repo: any) => repo.findDepartment.mockResolvedValueOnce({ id: 'dept-lab', type: 'LABORATORY' }), BadRequestException],
  ])('blocks doctor update for %s', async (_label, arrange, error) => {
    const repo = baseRepo(); arrange(repo); const useCase = new UpdateDoctorUseCase(repo as never, { anchorChange: jest.fn() } as never, { assertTrusted: jest.fn() } as never);
    await expect(useCase.execute('doctor-1', { licenseNumber: 'CCHN-NEW', citizenId: '123456789012', departmentId: 'dept-lab' } as never, 'admin-1')).rejects.toBeInstanceOf(error as any);
    expect(repo.updateWithRoom).not.toHaveBeenCalled();
  });
});
