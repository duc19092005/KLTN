import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OperationalStatus } from '@prisma/client';
import { CreateAiModelUseCase } from '../../../../../../../src/modules/ai-model/application/use-cases/create-ai-model.use-case';
import { UpdateAiModelUseCase } from '../../../../../../../src/modules/ai-model/application/use-cases/update-ai-model.use-case';
import { DeleteAiModelUseCase } from '../../../../../../../src/modules/ai-model/application/use-cases/delete-ai-model.use-case';
import { SetAiModelStatusUseCase } from '../../../../../../../src/modules/ai-model/application/use-cases/set-ai-model-status.use-case';

const apiDto = { modelName: 'Medical AI', modelVersion: 'v1.0', type: 'API', provider: 'gemini', apiEndpoint: undefined, secretOrIpHash: 'secret-value', description: 'test' };
const model = { id: 'model-1', modelName: 'Medical AI', modelVersion: 'v1.0', recommendedSpecialty: null, type: 'API', provider: 'gemini', apiEndpoint: 'https://api.test/v1', ipHashEncrypted: 'ciphertext', ipHashPlain: 'fingerprint', description: 'test', createdBy: 'admin-1', status: OperationalStatus.ACTIVE, isDeleted: false, _count: { diagnoses: 0, aiQualities: 0 } };

describe('AI model create, update and lifecycle business rules', () => {
  function setup() {
    const repo = { create: jest.fn(async (_data, hook) => { await hook(model, { tx: true }); return model; }), findById: jest.fn().mockResolvedValue(model), update: jest.fn(async (_id, data, hook) => { const updated = { ...model, ...data }; await hook(updated, { tx: true }); return updated; }), softDelete: jest.fn(async (_id, hook) => { const deleted = { ...model, status: OperationalStatus.DELETE, isDeleted: true }; await hook(deleted, { tx: true }); return deleted; }) };
    const crypto = { encrypt: jest.fn().mockReturnValue('ciphertext'), fingerprint: jest.fn().mockReturnValue('fingerprint') };
    const connectivity = { resolveApiEndpoint: jest.fn().mockReturnValue('https://api.test/v1') };
    const integrity = { anchorChange: jest.fn().mockResolvedValue(undefined) };
    const recovery = { assertTrusted: jest.fn().mockResolvedValue(undefined) };
    return { repo, crypto, connectivity, integrity, recovery };
  }

  it('creates API model, resolves endpoint, encrypts secret and returns no ciphertext', async () => {
    const { repo, crypto, connectivity, integrity } = setup();
    const useCase = new CreateAiModelUseCase(repo as never, crypto as never, connectivity as never, integrity as never);
    const result = await useCase.execute(apiDto as never, 'admin-1');
    expect(connectivity.resolveApiEndpoint).toHaveBeenCalledWith('gemini', undefined, 'v1.0');
    expect(crypto.encrypt).toHaveBeenCalledWith('secret-value');
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ ipHashEncrypted: 'ciphertext', createdBy: 'admin-1' }), expect.any(Function));
    expect(integrity.anchorChange).toHaveBeenCalledWith(model, 'CREATE', 'admin-1', null, { tx: true });
    expect(result).not.toHaveProperty('ipHashEncrypted');
    expect(result).not.toHaveProperty('ipHashPlain');
  });

  it('creates local/IP model without a secret by using model version as identity material', async () => {
    const { repo, crypto, connectivity, integrity } = setup();
    const useCase = new CreateAiModelUseCase(repo as never, crypto as never, connectivity as never, integrity as never);
    await useCase.execute({ ...apiDto, type: 'IP', provider: undefined, secretOrIpHash: undefined } as never, 'admin-1');
    expect(connectivity.resolveApiEndpoint).not.toHaveBeenCalled();
    expect(crypto.encrypt).toHaveBeenCalledWith('v1.0');
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ provider: 'ip', apiEndpoint: null }), expect.any(Function));
  });

  it('rejects an API model without a provider', async () => {
    const { repo, crypto, connectivity, integrity } = setup();
    const useCase = new CreateAiModelUseCase(repo as never, crypto as never, connectivity as never, integrity as never);
    await expect(useCase.execute({ ...apiDto, provider: undefined } as never, 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('updates endpoint and secret, anchors UPDATE, and keeps identity constraints for unused models', async () => {
    const { repo, crypto, connectivity, integrity, recovery } = setup();
    const useCase = new UpdateAiModelUseCase(repo as never, crypto as never, connectivity as never, integrity as never, recovery as never);
    const result = await useCase.execute('model-1', { apiEndpoint: 'https://new.test/v1', secretOrIpHash: 'new-secret', description: 'new' } as never, 'admin-1');
    expect(recovery.assertTrusted).toHaveBeenCalledWith('AiModelRegistry', 'model-1');
    expect(crypto.encrypt).toHaveBeenCalledWith('new-secret');
    expect(repo.update).toHaveBeenCalledWith('model-1', expect.objectContaining({ ipHashEncrypted: 'ciphertext', description: 'new' }), expect.any(Function));
    expect(integrity.anchorChange).toHaveBeenCalledWith(expect.any(Object), 'UPDATE', 'admin-1', expect.any(Object), { tx: true });
    expect(result).not.toHaveProperty('ipHashEncrypted');
  });

  it.each(['modelName', 'modelVersion', 'type', 'provider', 'recommendedSpecialty'] as const)('blocks changing %s after the model has been used', async (field) => {
    const { repo, crypto, connectivity, integrity, recovery } = setup(); repo.findById.mockResolvedValueOnce({ ...model, _count: { diagnoses: 1, aiQualities: 0 } });
    const useCase = new UpdateAiModelUseCase(repo as never, crypto as never, connectivity as never, integrity as never, recovery as never);
    const change = field === 'type' ? { type: 'IP' } : field === 'provider' ? { provider: 'deepseek' } : { [field]: 'changed' };
    await expect(useCase.execute('model-1', change as never, 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it.each([[null, 'missing'], [{ ...model, isDeleted: true }, 'deleted']])('rejects update/delete for %s model', async (existing) => {
    const { repo, crypto, connectivity, integrity, recovery } = setup(); repo.findById.mockResolvedValueOnce(existing);
    const update = new UpdateAiModelUseCase(repo as never, crypto as never, connectivity as never, integrity as never, recovery as never);
    await expect(update.execute('model-1', { description: 'x' } as never, 'admin-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft deletes model with DELETE audit and trusted-data check', async () => {
    const { repo, integrity, recovery } = setup(); const useCase = new DeleteAiModelUseCase(repo as never, integrity as never, recovery as never);
    await expect(useCase.execute('model-1', 'admin-1')).resolves.toEqual({ deleted: true, id: 'model-1' });
    expect(recovery.assertTrusted).toHaveBeenCalledWith('AiModelRegistry', 'model-1');
    expect(repo.softDelete).toHaveBeenCalledWith('model-1', expect.any(Function));
    expect(integrity.anchorChange).toHaveBeenCalledWith(expect.objectContaining({ isDeleted: true }), 'DELETE', 'admin-1', expect.any(Object), { tx: true });
  });

  it('hides an active model and rejects hiding a deleted model', async () => {
    const { repo, integrity, recovery } = setup(); const useCase = new SetAiModelStatusUseCase(repo as never, integrity as never, recovery as never);
    await useCase.execute('model-1', 'INACTIVE', 'admin-1');
    expect(repo.update).toHaveBeenCalledWith('model-1', { status: 'INACTIVE', isDeleted: false }, expect.any(Function));
    expect(integrity.anchorChange).toHaveBeenCalledWith(expect.any(Object), 'UPDATE', 'admin-1', expect.any(Object), { tx: true });
    repo.findById.mockResolvedValueOnce({ ...model, isDeleted: true, status: OperationalStatus.DELETE });
    await expect(useCase.execute('model-1', 'INACTIVE', 'admin-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
