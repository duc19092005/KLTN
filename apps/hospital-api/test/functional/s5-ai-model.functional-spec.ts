import request from 'supertest';
import { OperationalStatus, UserRole } from '@prisma/client';
import { createFunctionalApp, FunctionalApp, unwrap } from './support/functional-app';
import { bearer, createAdminA, resetFunctionalDatabase } from './support/database-reset';

type AiModelResponse = { id: string; modelName: string; modelVersion: string; status: OperationalStatus; secretConfigured: boolean; ipHashEncrypted?: string };

describe('S5 AI model lifecycle (functional API)', () => {
  let functional: FunctionalApp;
  let adminToken: string;
  let adminId: string;

  beforeAll(async () => {
    functional = await createFunctionalApp();
  });

  beforeEach(async () => {
    await resetFunctionalDatabase(functional.prisma);
    const admin = await createAdminA(functional.prisma);
    adminId = admin.id;
    adminToken = functional.tokenFor({ ...admin, role: UserRole.ADMIN });
  });

  afterAll(async () => {
    await functional.close();
  });

  function modelPayload(suffix: string, overrides: Record<string, unknown> = {}) {
    return {
      modelName: `Clinical Model ${suffix}`,
      modelVersion: `v${suffix}.0`,
      recommendedSpecialty: 'Tim mach',
      type: 'API',
      provider: 'local',
      apiEndpoint: 'http://127.0.0.1:18080/v1/chat/completions',
      secretOrIpHash: `test-secret-${suffix}`,
      description: `Functional model ${suffix}`,
      ...overrides,
    };
  }

  async function createModelThroughApi(suffix: string, overrides: Record<string, unknown> = {}) {
    const response = await request(functional.app.getHttpServer())
      .post('/api/ai-models')
      .set(bearer(adminToken))
      .send(modelPayload(suffix, overrides))
      .expect(201);
    return unwrap<AiModelResponse>(response.body);
  }

  it('[TC5.01] registers an active AI model, encrypts its secret, and records CREATE audit without exposing the ciphertext', async () => {
    const created = await createModelThroughApi('501');

    expect(created).toMatchObject({ modelName: 'Clinical Model 501', modelVersion: 'v501.0', status: 'ACTIVE', secretConfigured: true });
    expect(created.ipHashEncrypted).toBeUndefined();
    const stored = await functional.prisma.aiModelRegistry.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored).toMatchObject({ status: 'ACTIVE', provider: 'local', createdBy: adminId });
    expect(stored.ipHashEncrypted).not.toBe('test-secret-501');
    await expect(functional.prisma.blockchainLogger.findFirst({ where: { entity: 'AiModelRegistry', entityId: created.id, action: 'CREATE' } })).resolves.not.toBeNull();
  });

  it('[TC5.02] rejects a duplicate modelId and preserves the existing AI model', async () => {
    const modelId = 'MODEL-BUSINESS-502';
    const existing = await functional.prisma.aiModelRegistry.create({
      data: {
        modelId, modelName: 'Clinical Model 502A', modelVersion: 'v502.0',
        provider: 'local', type: 'API', apiEndpoint: 'http://127.0.0.1:65535/v1/chat/completions',
        ipHashEncrypted: 'encrypted-502a', createdBy: adminId,
      },
    });

    await expect(functional.prisma.aiModelRegistry.create({
      data: {
        modelId, modelName: 'Clinical Model 502B', modelVersion: 'v502.1',
        provider: 'local', type: 'API', apiEndpoint: 'http://127.0.0.1:65535/v1/chat/completions',
        ipHashEncrypted: 'encrypted-502b', createdBy: adminId,
      },
    })).rejects.toMatchObject({ code: 'P2002' });

    await expect(functional.prisma.aiModelRegistry.count({ where: { modelId } })).resolves.toBe(1);
    await expect(functional.prisma.aiModelRegistry.findUniqueOrThrow({ where: { id: existing.id } }))
      .resolves.toMatchObject({ modelId, modelName: 'Clinical Model 502A' });
  });

  it('[TC5.04] reports successful provider connectivity and safely rejects a failing endpoint', async () => {
    const http = await import('node:http');
    const provider = http.createServer((incoming, response) => {
      response.setHeader('Content-Type', 'application/json');
      if (incoming.url === '/ok') {
        response.statusCode = 200;
        response.end(JSON.stringify({ choices: [{ message: { content: 'pong' } }] }));
        return;
      }
      response.statusCode = 503;
      response.end(JSON.stringify({ error: { message: 'Provider temporarily unavailable' } }));
    });
    await new Promise<void>((resolve) => provider.listen(0, '127.0.0.1', resolve));
    const address = provider.address();
    if (!address || typeof address === 'string') throw new Error('Local AI provider test server failed to bind.');

    try {
      const okResponse = await request(functional.app.getHttpServer())
        .post('/api/ai-models/test-api')
        .set(bearer(adminToken))
        .send({ provider: 'local', modelVersion: 'functional-model', apiEndpoint: `http://127.0.0.1:${address.port}/ok` })
        .expect(201);
      expect(unwrap<{ ok: boolean; endpoint: string; message: string }>(okResponse.body)).toMatchObject({ ok: true, endpoint: `http://127.0.0.1:${address.port}/ok` });

      const failedResponse = await request(functional.app.getHttpServer())
        .post('/api/ai-models/test-api')
        .set(bearer(adminToken))
        .send({ provider: 'local', modelVersion: 'functional-model', apiEndpoint: `http://127.0.0.1:${address.port}/fail` })
        .expect(400);
      expect(JSON.stringify(failedResponse.body)).toContain('Provider temporarily unavailable');
      expect(JSON.stringify(failedResponse.body)).not.toContain('test-secret');
    } finally {
      await new Promise<void>((resolve, reject) => provider.close((error) => error ? reject(error) : resolve()));
    }
  });

  it('[TC5.03] updates safe model configuration and keeps the encrypted secret hidden from the response', async () => {
    const created = await createModelThroughApi('503');

    const response = await request(functional.app.getHttpServer())
      .patch(`/api/ai-models/${created.id}`)
      .set(bearer(adminToken))
      .send({ modelName: 'Clinical Model Updated', modelVersion: 'v503.1', provider: 'local', apiEndpoint: 'http://127.0.0.1:12503/v1/chat/completions', description: 'Updated safely' })
      .expect(200);

    const updated = unwrap<AiModelResponse>(response.body);
    expect(updated).toMatchObject({ modelName: 'Clinical Model Updated', modelVersion: 'v503.1', secretConfigured: true });
    expect(updated.ipHashEncrypted).toBeUndefined();
    await expect(functional.prisma.aiModelRegistry.findUniqueOrThrow({ where: { id: created.id } }))
      .resolves.toMatchObject({ modelName: 'Clinical Model Updated', modelVersion: 'v503.1', description: 'Updated safely' });
    await expect(functional.prisma.blockchainLogger.findFirst({ where: { entity: 'AiModelRegistry', entityId: created.id, action: 'UPDATE' } })).resolves.not.toBeNull();
  });

  it('[TC5.05] hides an active model so it is inactive and unavailable for diagnosis', async () => {
    const created = await createModelThroughApi('505');

    await request(functional.app.getHttpServer())
      .patch(`/api/ai-models/${created.id}/hide`)
      .set(bearer(adminToken))
      .expect(200);

    await expect(functional.prisma.aiModelRegistry.findUniqueOrThrow({ where: { id: created.id } }))
      .resolves.toMatchObject({ status: 'INACTIVE', isDeleted: false });
  });

  it('[TC5.12] lets a Doctor see only active, non-deleted models eligible for diagnosis', async () => {
    const active = await createModelThroughApi('512A');
    const hidden = await createModelThroughApi('512B');
    const deleted = await createModelThroughApi('512C');
    await functional.prisma.aiModelRegistry.update({ where: { id: hidden.id }, data: { status: 'INACTIVE' } });
    await functional.prisma.aiModelRegistry.update({ where: { id: deleted.id }, data: { status: 'DELETE', isDeleted: true } });
    const doctor = await functional.prisma.user.create({ data: { username: 'doctoravailable', email: 'doctoravailable@test.local', role: UserRole.DOCTOR, status: 'ACTIVE', firstLogin: false } });
    const doctorToken = functional.tokenFor({ ...doctor, role: UserRole.DOCTOR });

    const response = await request(functional.app.getHttpServer())
      .get('/api/ai-models/available-for-diagnosis')
      .set(bearer(doctorToken))
      .expect(200);
    const models = unwrap<Array<{ id: string; status: OperationalStatus }>>(response.body);

    expect(models).toEqual(expect.arrayContaining([expect.objectContaining({ id: active.id, status: 'ACTIVE' })]));
    expect(models.map((model) => model.id)).not.toEqual(expect.arrayContaining([hidden.id, deleted.id]));
  });

  it('[TC5.06] restores a soft-deleted model within 30 days as inactive and clears deletion metadata', async () => {
    const created = await createModelThroughApi('506');
    await request(functional.app.getHttpServer()).delete(`/api/ai-models/${created.id}`).set(bearer(adminToken)).expect(200);

    await request(functional.app.getHttpServer()).patch(`/api/ai-models/${created.id}/restore`).set(bearer(adminToken)).expect(200);

    await expect(functional.prisma.aiModelRegistry.findUniqueOrThrow({ where: { id: created.id } }))
      .resolves.toMatchObject({ status: 'INACTIVE', isDeleted: false, deletedAt: null, deletedBy: null, restoredAt: expect.any(Date) });
  });

  it('[TC5.07] refuses permanent deletion of a model with an AI diagnosis and retains its relation', async () => {
    const created = await createModelThroughApi('507');
    const diagnosis = await functional.prisma.aiDiagnosis.create({ data: { aiModelId: created.id, prompt: 'test prompt', result: 'test result' } });
    await request(functional.app.getHttpServer()).delete(`/api/ai-models/${created.id}`).set(bearer(adminToken)).expect(200);

    await request(functional.app.getHttpServer()).delete(`/api/ai-models/${created.id}/permanent`).set(bearer(adminToken)).expect(409);

    await expect(functional.prisma.aiModelRegistry.findUniqueOrThrow({ where: { id: created.id } })).resolves.toMatchObject({ status: 'DELETE' });
    await expect(functional.prisma.aiDiagnosis.findUniqueOrThrow({ where: { id: diagnosis.id } })).resolves.toMatchObject({ aiModelId: created.id });
  });

  it('[TC5.08] permanently deletes an unreferenced soft-deleted model and records the administrative deletion audit', async () => {
    const created = await createModelThroughApi('508');
    await request(functional.app.getHttpServer()).delete(`/api/ai-models/${created.id}`).set(bearer(adminToken)).expect(200);

    await request(functional.app.getHttpServer()).delete(`/api/ai-models/${created.id}/permanent`).set(bearer(adminToken)).expect(200);

    await expect(functional.prisma.aiModelRegistry.findUnique({ where: { id: created.id } })).resolves.toBeNull();
    await expect(functional.prisma.blockchainLogger.findFirst({ where: { entity: 'AdministrativeDeletion', entityId: created.id, action: 'PERMANENT_DELETE' } })).resolves.not.toBeNull();
  });
});
