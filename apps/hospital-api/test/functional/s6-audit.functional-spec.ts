import request from 'supertest';
import { DepartmentType, UserRole } from '@prisma/client';
import { createFunctionalApp, FunctionalApp, unwrap } from './support/functional-app';
import { bearer, createAdminA, resetFunctionalDatabase } from './support/database-reset';

type AuditListResponse = {
  items: Array<{ seq: number; entity: string; entityId: string | null; action: string; actor: { id: string; role: UserRole } | null }>;
  total: number;
  page: number;
  limit: number;
};

describe('S6 Audit viewing and privacy (functional API)', () => {
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

  async function createAuditedDepartment() {
    const response = await request(functional.app.getHttpServer())
      .post('/api/departments')
      .set(bearer(adminToken))
      .send({ departmentCode: 'AUD-601', name: 'Khoa Audit', type: DepartmentType.CLINICAL, floor: '6A', canReceiveOrders: false })
      .expect(201);
    return unwrap<{ id: string }>(response.body);
  }

  it('[TC6.01] filters audit logs by entity, action, actor, time and pagination', async () => {
    const department = await createAuditedDepartment();
    const from = new Date(Date.now() - 60_000).toISOString();
    const to = new Date(Date.now() + 60_000).toISOString();

    const response = await request(functional.app.getHttpServer())
      .get(`/api/audit/logs?entity=Department&entityId=${department.id}&action=CREATE&actorId=${adminId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&page=1&limit=1`)
      .set(bearer(adminToken))
      .expect(200);
    const body = unwrap<AuditListResponse>(response.body);

    expect(body).toMatchObject({ total: 1, page: 1, limit: 1 });
    expect(body.items[0]).toMatchObject({ entity: 'Department', entityId: department.id, action: 'CREATE', actor: { id: adminId, role: UserRole.ADMIN } });
  });

  it('[TC6.02] exposes an audit detail with actor, entity, action, change fields and verification—not snapshots', async () => {
    await createAuditedDepartment();
    const row = await functional.prisma.blockchainLogger.findFirstOrThrow({ where: { entity: 'Department', action: 'CREATE' }, orderBy: { seq: 'desc' } });

    const response = await request(functional.app.getHttpServer())
      .get(`/api/audit/logs/${row.seq}`)
      .set(bearer(adminToken))
      .expect(200);
    const detail = unwrap<Record<string, unknown>>(response.body);

    expect(detail).toMatchObject({ seq: row.seq, entity: 'Department', action: 'CREATE', actor: { id: adminId, role: UserRole.ADMIN } });
    expect(detail).toHaveProperty('fieldsChanged');
    expect(detail).toHaveProperty('verification');
    expect(detail).not.toHaveProperty('beforeEncrypted');
    expect(detail).not.toHaveProperty('afterEncrypted');
    expect(detail).not.toHaveProperty('beforeJson');
    expect(detail).not.toHaveProperty('afterJson');
  });

  it('[TC6.03] redacts sensitive Staff audit data and never returns plaintext or encrypted snapshots', async () => {
    const department = await functional.prisma.department.create({
      data: { departmentCode: 'AUD-STAFF', name: 'Phong Hanh Chinh Audit', type: DepartmentType.ADMINISTRATIVE, status: 'ACTIVE' },
    });
    await request(functional.app.getHttpServer())
      .post('/api/staff')
      .set(bearer(adminToken))
      .send({
        username: 'staffaudit', email: 'staffaudit@test.local', role: UserRole.RECEPTIONIST,
        employeeCode: 'AUD-ST-01', fullName: 'Nguoi Dung Nhay Cam', phone: '0901234567', gender: 'Nam', citizenId: '300000000601',
        birthDate: '1992-01-01', address: 'Dia Chi Mat', avatarUrl: 'https://avatars.test.local/staff-audit.jpg', position: 'Le tan', departmentId: department.id,
      })
      .expect(201);
    const staff = await functional.prisma.staffProfile.findUniqueOrThrow({ where: { employeeCode: 'AUD-ST-01' } });
    await request(functional.app.getHttpServer())
      .patch(`/api/staff/${staff.id}`)
      .set(bearer(adminToken))
      .send({ phone: '0907654321' })
      .expect(200);
    const row = await functional.prisma.blockchainLogger.findFirstOrThrow({ where: { entity: 'StaffProfile', entityId: staff.id, action: 'UPDATE' }, orderBy: { seq: 'desc' } });

    const response = await request(functional.app.getHttpServer())
      .get(`/api/audit/logs/${row.seq}`)
      .set(bearer(adminToken))
      .expect(200);
    const serialized = JSON.stringify(unwrap<Record<string, unknown>>(response.body));

    expect(serialized).not.toContain('0901234567');
    expect(serialized).not.toContain('0907654321');
    expect(serialized).not.toContain('300000000601');
    expect(serialized).not.toContain('Dia Chi Mat');
    expect(serialized).not.toContain('beforeEncrypted');
    expect(serialized).not.toContain('afterEncrypted');
  });

  it('[TC6.04] verifies a valid audited entity chain without creating an unnecessary recovery record', async () => {
    await createAuditedDepartment();

    const response = await request(functional.app.getHttpServer()).get('/api/audit/verify-chain').set(bearer(adminToken)).expect(200);
    const integrity = unwrap<{ ok: boolean; total: number; brokenAtSeq: number | null; reason: string | null }>(response.body);

    expect(integrity).toMatchObject({ ok: true, brokenAtSeq: null, reason: null });
    expect(integrity.total).toBeGreaterThanOrEqual(1);
    await expect(functional.prisma.auditRecovery.count()).resolves.toBe(0);
  });

  it('[TC6.05] shows ARTIFACT_READY sequence-range logs before batchId assignment without false 0/0 or missing hashes', async () => {
    await createAuditedDepartment();
    const rows = await functional.prisma.blockchainLogger.findMany({ where: { batchId: null }, orderBy: { seq: 'asc' } });
    expect(rows.length).toBeGreaterThan(0);
    const fromSeq = rows[0].seq!;
    const toSeq = rows[rows.length - 1].seq!;
    const latestBatch = await functional.prisma.auditBatch.findFirst({ orderBy: { batchId: 'desc' }, select: { batchId: true } });
    const batchId = (latestBatch?.batchId ?? 0) + 1;
    const batch = await functional.prisma.auditBatch.create({
      data: {
        batchId,
        merkleRoot: 'f'.repeat(64),
        leafCount: rows.length,
        fromSeq,
        toSeq,
        status: 'ARTIFACT_READY',
        artifactHash: 'a'.repeat(64),
        artifactUri: 'ipfs://functional-artifact-ready',
      },
    });

    const batches = unwrap<{ items: Array<{ batchId: number; leafCount: number; integrity: { total: number; verified: number; tampered: number } }> }>((await request(functional.app.getHttpServer()).get('/api/audit/batches').set(bearer(adminToken)).expect(200)).body);
    expect(batches.items).toEqual(expect.arrayContaining([expect.objectContaining({ batchId: batch.batchId, leafCount: rows.length, integrity: expect.objectContaining({ total: rows.length, verified: rows.length, tampered: 0 }) })]));
    const detail = unwrap<{ batchId: number; logs: Array<{ seq: number; hashes: { entryHash: string } }>; integrity: { total: number; verified: number; tampered: number } }>((await request(functional.app.getHttpServer()).get(`/api/audit/batches/${batch.batchId}`).set(bearer(adminToken)).expect(200)).body);
    expect(detail).toMatchObject({ batchId: batch.batchId, integrity: expect.objectContaining({ total: rows.length, verified: rows.length, tampered: 0 }) });
    expect(detail.logs.map((row) => row.seq)).toEqual(rows.map((row) => row.seq));
    expect(detail.logs.every((row) => typeof row.hashes.entryHash === 'string' && row.hashes.entryHash.length > 0)).toBe(true);
  });

  it('[TC6.06] anchors pending audit logs and exposes matching batch, log, and checkpoint state', async () => {
    await createAuditedDepartment();
    const pending = await functional.prisma.blockchainLogger.findMany({ where: { batchId: null }, orderBy: { seq: 'asc' } });
    expect(pending.length).toBeGreaterThan(0);

    const response = await request(functional.app.getHttpServer()).post('/api/audit/anchor-now').set(bearer(adminToken)).expect(201);
    const anchored = unwrap<{ committed: boolean; batchId: number; leafCount: number }>(response.body);
    expect(anchored).toMatchObject({ committed: true, leafCount: pending.length });
    const batch = await functional.prisma.auditBatch.findUniqueOrThrow({ where: { batchId: anchored.batchId } });
    expect(batch).toMatchObject({ status: 'ANCHORED', leafCount: pending.length });
    expect(batch.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(batch.blockNumber).toBeGreaterThan(0);
    const anchoredLogs = await functional.prisma.blockchainLogger.findMany({ where: { batchId: anchored.batchId }, orderBy: { seq: 'asc' } });
    expect(anchoredLogs).toHaveLength(pending.length);
    expect(anchoredLogs.every((row) => row.onChainStatus === 'ANCHORED' && row.txHash === batch.txHash)).toBe(true);
    const listed = unwrap<{ items: Array<{ batchId: number; status: string; integrity: { total: number; verified: number; tampered: number } }> }>((await request(functional.app.getHttpServer()).get('/api/audit/batches').set(bearer(adminToken)).expect(200)).body);
    expect(listed.items).toEqual(expect.arrayContaining([expect.objectContaining({ batchId: anchored.batchId, status: 'ANCHORED', integrity: expect.objectContaining({ total: pending.length, verified: pending.length, tampered: 0 }) })]));
  });
});
