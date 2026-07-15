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
    const audit = {
      recordV2: jest.fn().mockImplementation(async () => {
        if (auditFails) throw new Error('audit failed');
      }),
    };
    return {
      useCase: new CreateVisitUseCase(repo as never, prisma as never, notifications as never, audit as never),
      repo,
      audit,
      tx,
    };
  }

  it('writes the Visit audit row through the repository transaction callback', async () => {
    const { useCase, audit, tx } = makeUseCase();
    await useCase.execute({ patientId: 'patient-1', departmentId: 'department-1' } as never, {
      sub: 'reception-1',
      role: 'RECEPTIONIST',
    } as never);
    expect(audit.recordV2).toHaveBeenCalledWith(expect.objectContaining({ entity: 'Visit', action: 'CREATE' }), tx);
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
