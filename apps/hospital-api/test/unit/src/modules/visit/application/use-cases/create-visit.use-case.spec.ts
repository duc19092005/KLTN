import { CreateVisitUseCase } from '../../../../../../../src/modules/visit/application/use-cases/create-visit.use-case';

describe('CreateVisitUseCase audit transaction', () => {
  function makeUseCase(auditFails = false) {
    const tx = { transaction: true };
    const visit = {
      id: 'visit-1',
      visitCode: 'VIS-0001',
      patientId: 'patient-1',
      departmentId: 'department-1',
      staffId: null,
      status: 'WAITING',
    };
    const repo = {
      findDepartmentForVisit: jest.fn().mockResolvedValue({ id: 'department-1', type: 'EXAMINATION', status: 'ACTIVE' }),
      createVisitWithOptionalPatient: jest.fn().mockImplementation(async (_command, onCreated) => {
        await onCreated(visit, tx);
        return visit;
      }),
    };
    const prisma = { staffProfile: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) } };
    const notifications = { createNotification: jest.fn() };
    const clinicalTrust = { assertTrusted: jest.fn().mockResolvedValue(undefined) };
    const integrity = {
      anchorChange: jest.fn().mockImplementation(async () => {
        if (auditFails) throw new Error('audit failed');
      }),
    };
    const audit = { recordV2: jest.fn().mockResolvedValue(undefined) };
    return {
      useCase: new CreateVisitUseCase(repo as never, integrity as never, prisma as never, notifications as never, audit as never, clinicalTrust as never),
      repo,
      audit,
      integrity,
      tx,
    };
  }

  it('writes the Visit integrity row through the repository transaction callback', async () => {
    const { useCase, integrity, tx } = makeUseCase();
    await useCase.execute({ patientId: 'patient-1', departmentId: 'department-1' } as never, {
      sub: 'reception-1',
      role: 'RECEPTIONIST',
    } as never);
    expect(integrity.anchorChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'visit-1' }), 'CREATE', 'reception-1', null, tx);
  });

  it('registers a Patient audit callback for inline patient creation', async () => {
    const { useCase, repo } = makeUseCase();
    await useCase.execute({
      patient: {
        fullName: 'Nguyễn Văn A', gender: 'MALE', birthDate: '1990-01-01', address: 'TP HCM', phone: '0909123456',
      },
      departmentId: 'department-1',
    } as never);
    expect(repo.createVisitWithOptionalPatient.mock.calls[0][2]).toEqual(expect.any(Function));
  });

  it('propagates audit failure so visit creation can rollback', async () => {
    const { useCase } = makeUseCase(true);
    await expect(
      useCase.execute({ patientId: 'patient-1', departmentId: 'department-1' } as never),
    ).rejects.toThrow('audit failed');
  });
});
