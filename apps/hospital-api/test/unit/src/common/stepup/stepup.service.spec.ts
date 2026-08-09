import { ForbiddenException } from '@nestjs/common';
import { StepUpService } from '../../../../../src/common/stepup/stepup.service';

describe('StepUpService (RAM & Redis Store)', () => {
  let service: StepUpService;

  beforeEach(() => {
    service = new StepUpService();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('mints a single-use ticket and consumes it successfully', async () => {
    const userId = 'user-123';
    const action = 'RECOVER_AUDIT_BATCH';
    const resourceId = 'batch-1';

    const issued = await service.issue(userId, action, resourceId);
    expect(issued.ticket).toBeDefined();
    expect(issued.action).toBe(action);
    expect(issued.resourceId).toBe(resourceId);

    // Consume first time -> should succeed
    await expect(
      service.consume({ userId, action, token: issued.ticket, resourceId })
    ).resolves.not.toThrow();

    // Consume second time (single-use) -> should throw ForbiddenException
    await expect(
      service.consume({ userId, action, token: issued.ticket, resourceId })
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects tickets used for a different action or resource', async () => {
    const userId = 'user-123';
    const action = 'DELETE_DOCTOR';
    const issued = await service.issue(userId, action, 'doctor-99');

    // Mismatched action
    await expect(
      service.consume({ userId, action: 'OTHER_ACTION', token: issued.ticket, resourceId: 'doctor-99' })
    ).rejects.toThrow(ForbiddenException);

    // Mismatched resourceId
    await expect(
      service.consume({ userId, action, token: issued.ticket, resourceId: 'doctor-100' })
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects missing or empty token', async () => {
    await expect(
      service.consume({ userId: 'u1', action: 'ACT', token: null })
    ).rejects.toThrow(ForbiddenException);
  });
});
