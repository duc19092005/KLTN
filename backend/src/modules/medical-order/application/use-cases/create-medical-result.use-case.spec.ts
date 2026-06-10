import { BadRequestException } from '@nestjs/common';
import { MedicalOrderStatus } from '@prisma/client';
import { CreateMedicalResultUseCase } from './create-medical-result.use-case';

const baseUser = { sub: 'lab-user-1', role: 'LAB_MANAGER', verified: true } as any;
const baseDto = {
  note: 'Sensitive result note must never be audited raw',
  files: [
    {
      fileName: 'cloudinary-internal-name.pdf',
      originalName: 'patient-xray.pdf',
      mimeType: 'application/pdf',
      size: 2048,
      url: 'https://res.cloudinary.com/demo/patient-xray.pdf',
    },
  ],
} as any;

describe('CreateMedicalResultUseCase audit integrity', () => {
  function makeUseCase(options: { orderStatus?: MedicalOrderStatus; visitTransition?: boolean; auditFails?: boolean } = {}) {
    const order = {
      id: 'order-1',
      targetDepartmentId: 'dept-lab',
      status: options.orderStatus ?? MedicalOrderStatus.ORDERED,
      visitId: 'visit-1',
    };
    const tx = { tx: true } as any;
    const repo = {
      findOrderForManage: jest.fn().mockResolvedValue(order),
      findStaffByUserId: jest.fn().mockResolvedValue({
        id: 'staff-1',
        userId: baseUser.sub,
        departmentId: 'dept-lab',
      }),
      findActiveApprovedShiftForStaffDepartment: jest.fn().mockResolvedValue({
        id: 'shift-1',
        staffId: 'staff-1',
        departmentId: 'dept-lab',
        staff: { userId: baseUser.sub, departmentId: 'dept-lab' },
      }),
      createResultWithTransitions: jest.fn().mockImplementation(async (_command, _visitId, afterWrite) => {
        const result = {
          id: 'result-1',
          resultCode: 'RES-00001',
          orderId: 'order-1',
          performedById: baseUser.sub,
          returnedAt: new Date('2026-06-10T00:00:00.000Z'),
          note: baseDto.note,
          files: baseDto.files,
        };
        const updatedOrder = { id: 'order-1', status: MedicalOrderStatus.RESULT_READY };
        const visitTransition = options.visitTransition === false
          ? null
          : { visitId: 'visit-1', status: 'WAITING_CONCLUSION' };
        await afterWrite?.({ result, order: updatedOrder, visitTransition }, tx);
        return { result, order: updatedOrder };
      }),
    };
    const accessPolicy = { assertCanManageOrder: jest.fn().mockResolvedValue(undefined) };
    const audit = {
      hashSnapshot: jest.fn((snapshot) => ({ salt: `salt-${snapshot.resultId ?? snapshot.orderId ?? snapshot.visitId}`, hash: `hash-${snapshot.resultId ?? snapshot.orderId ?? snapshot.visitId}` })),
      record: jest.fn().mockImplementation(async () => {
        if (options.auditFails) throw new Error('audit failed');
      }),
    };
    const useCase = new CreateMedicalResultUseCase(repo as any, accessPolicy as any, audit as any);
    return { useCase, repo, audit, tx };
  }

  it('writes MedicalResult, MedicalOrder, and Visit audit rows inside the result transaction', async () => {
    const { useCase, repo, audit, tx } = makeUseCase();

    await expect(useCase.execute('order-1', baseDto, baseUser)).resolves.toBeTruthy();

    expect(repo.createResultWithTransitions).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledTimes(3);
    expect(audit.record.mock.calls.map(([params]) => params.entity)).toEqual([
      'MedicalResult',
      'MedicalOrder',
      'Visit',
    ]);
    expect(audit.record.mock.calls.every(([, transaction]) => transaction === tx)).toBe(true);
  });

  it('does not audit raw notes, URLs, or file names in the MedicalResult snapshot', async () => {
    const { useCase, audit } = makeUseCase();

    await useCase.execute('order-1', baseDto, baseUser);

    const medicalResultAudit = audit.record.mock.calls.find(([params]) => params.entity === 'MedicalResult')?.[0];
    const serialized = JSON.stringify(medicalResultAudit.after);
    expect(serialized).toContain('result-1');
    expect(serialized).toContain('application/pdf');
    expect(serialized).not.toContain('Sensitive result note');
    expect(serialized).not.toContain('cloudinary');
    expect(serialized).not.toContain('patient-xray.pdf');
    expect(serialized).not.toContain('cloudinary-internal-name.pdf');
  });

  it('propagates audit failure so the repository transaction can rollback domain writes', async () => {
    const { useCase, repo } = makeUseCase({ auditFails: true });

    await expect(useCase.execute('order-1', baseDto, baseUser)).rejects.toThrow('audit failed');
    expect(repo.createResultWithTransitions).toHaveBeenCalledTimes(1);
  });

  it('does not create Visit audit row when no Visit transition happens', async () => {
    const { useCase, audit } = makeUseCase({ visitTransition: false });

    await useCase.execute('order-1', baseDto, baseUser);

    expect(audit.record.mock.calls.map(([params]) => params.entity)).toEqual([
      'MedicalResult',
      'MedicalOrder',
    ]);
  });

  it('rejects returning a result for an already completed order before audit starts', async () => {
    const { useCase, repo, audit } = makeUseCase({ orderStatus: MedicalOrderStatus.RESULT_READY });

    await expect(useCase.execute('order-1', baseDto, baseUser)).rejects.toThrow(BadRequestException);
    expect(repo.createResultWithTransitions).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
