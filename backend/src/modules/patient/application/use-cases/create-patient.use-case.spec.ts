import { BadRequestException, ConflictException } from '@nestjs/common';
import { CreatePatientUseCase } from './create-patient.use-case';

const validPatient = {
  fullName: 'Nguyễn Văn A',
  gender: 'MALE',
  birthDate: '1990-01-01',
  address: 'Thành phố Hồ Chí Minh',
  phone: '0909123456',
};

describe('CreatePatientUseCase', () => {
  function makeUseCase(conflict: { id: string; patientCode: string } | null = null, auditFails = false) {
    const tx = { transaction: true };
    const repo = {
      findIdentityConflict: jest.fn().mockResolvedValue(conflict),
      generatePatientCode: jest.fn().mockResolvedValue('BN-0001'),
      create: jest.fn().mockImplementation(async (data, patientCode, afterWrite) => {
        const patient = { id: 'patient-1', patientCode, ...data };
        await afterWrite(patient, tx);
        return patient;
      }),
    };
    const integrity = {
      anchorChange: jest.fn().mockImplementation(async () => {
        if (auditFails) throw new Error('audit failed');
      }),
    };
    return { useCase: new CreatePatientUseCase(repo as never, integrity as never), repo, integrity, tx };
  }

  it('requires at least one contact or identity method', async () => {
    const { useCase, repo } = makeUseCase();
    await expect(useCase.execute({ ...validPatient, phone: undefined } as never)).rejects.toThrow(BadRequestException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate patient identity', async () => {
    const { useCase, repo } = makeUseCase({ id: 'patient-old', patientCode: 'BN-0009' });
    await expect(useCase.execute(validPatient as never)).rejects.toThrow(ConflictException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('propagates audit failure from the patient transaction callback', async () => {
    const { useCase, integrity, tx } = makeUseCase(null, true);
    await expect(useCase.execute(validPatient as never, 'reception-1')).rejects.toThrow('audit failed');
    expect(integrity.anchorChange).toHaveBeenCalledWith(expect.any(Object), 'CREATE', 'reception-1', null, tx);
  });
});
