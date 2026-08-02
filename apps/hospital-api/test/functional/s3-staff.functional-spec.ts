import request from 'supertest';
import { DepartmentType, UserRole } from '@prisma/client';
import { createFunctionalApp, FunctionalApp, unwrap } from './support/functional-app';
import { bearer, createAdminA, resetFunctionalDatabase } from './support/database-reset';

type StaffResponse = {
  id: string;
  staffProfile?: { id: string; employeeCode: string };
};

describe('S3 Staff lifecycle (functional API)', () => {
  let functional: FunctionalApp;
  let adminToken: string;

  beforeAll(async () => {
    functional = await createFunctionalApp();
  });

  beforeEach(async () => {
    await resetFunctionalDatabase(functional.prisma);
    const admin = await createAdminA(functional.prisma);
    adminToken = functional.tokenFor({ ...admin, role: UserRole.ADMIN });
  });

  afterAll(async () => {
    await functional.close();
  });

  async function createCompatibleDepartment(suffix: string) {
    return functional.prisma.department.create({
      data: {
        departmentCode: `STAFF-${suffix}`,
        name: `Nhan su ${suffix}`,
        type: DepartmentType.ADMINISTRATIVE,
        status: 'ACTIVE',
      },
    });
  }

  function receptionistPayload(suffix: string, departmentId?: string) {
    return {
      username: `reception${suffix}`,
      email: `reception${suffix}@test.local`,
      role: UserRole.RECEPTIONIST,
      fullName: 'Le Tan Functional',
      phone: `0901234${suffix.padStart(3, '0')}`,
      gender: 'Nam',
      citizenId: `200000000${suffix.padStart(3, '0')}`,
      birthDate: '1995-01-15',
      address: 'Ho Chi Minh City',
      avatarUrl: `https://avatars.test.local/reception-${suffix}.jpg`,
      employeeCode: `NV-${suffix.padStart(4, '0')}`,
      position: 'Le tan',
      ...(departmentId ? { departmentId } : {}),
    };
  }

  async function createStaffThroughApi(suffix: string, departmentId?: string) {
    const response = await request(functional.app.getHttpServer())
      .post('/api/staff')
      .set(bearer(adminToken))
      .send(receptionistPayload(suffix, departmentId))
      .expect(201);
    const created = unwrap<StaffResponse>(response.body);
    const profile = await functional.prisma.staffProfile.findUniqueOrThrow({
      where: { employeeCode: `NV-${suffix.padStart(4, '0')}` },
      include: { user: true },
    });
    return { created, profile };
  }

  it('[TC3.01] creates a valid receptionist linked to an active compatible department and audit record', async () => {
    const department = await createCompatibleDepartment('301');
    const { created, profile } = await createStaffThroughApi('301', department.id);

    expect(created.id).toBe(profile.userId);
    expect(profile).toMatchObject({ departmentId: department.id, employeeCode: 'NV-0301' });
    expect(profile.user).toMatchObject({ role: 'RECEPTIONIST', status: 'ACTIVE', firstLogin: true });
    await expect(functional.prisma.blockchainLogger.findFirst({
      where: { entity: 'StaffProfile', entityId: profile.id, action: 'CREATE' },
    })).resolves.not.toBeNull();
  });

  it('[TC3.02] rejects duplicated staff identity data without creating another user or profile', async () => {
    const department = await createCompatibleDepartment('302');
    await createStaffThroughApi('302', department.id);

    await request(functional.app.getHttpServer())
      .post('/api/staff')
      .set(bearer(adminToken))
      .send({ ...receptionistPayload('303', department.id), email: 'reception302@test.local' })
      .expect(409);

    await expect(functional.prisma.user.count({ where: { email: 'reception302@test.local' } })).resolves.toBe(1);
    await expect(functional.prisma.staffProfile.count({ where: { employeeCode: 'NV-0303' } })).resolves.toBe(0);
  });

  it('[TC3.03] refuses creation of a second Admin from the staff module', async () => {
    const payload = receptionistPayload('303');
    await request(functional.app.getHttpServer())
      .post('/api/staff')
      .set(bearer(adminToken))
      .send({ ...payload, role: UserRole.ADMIN })
      .expect(400);

    await expect(functional.prisma.user.count({ where: { role: UserRole.ADMIN } })).resolves.toBe(1);
  });

  it('[TC3.04] refuses Doctor creation from the staff module', async () => {
    const payload = receptionistPayload('304');
    await request(functional.app.getHttpServer())
      .post('/api/staff')
      .set(bearer(adminToken))
      .send({ ...payload, role: UserRole.DOCTOR })
      .expect(400);

    await expect(functional.prisma.user.count({ where: { username: payload.username } })).resolves.toBe(0);
  });

  it('[TC3.05] updates staff contact, position, and compatible department while retaining the linked user', async () => {
    const sourceDepartment = await createCompatibleDepartment('305A');
    const targetDepartment = await createCompatibleDepartment('305B');
    const { profile } = await createStaffThroughApi('305', sourceDepartment.id);

    const response = await request(functional.app.getHttpServer())
      .patch(`/api/staff/${profile.id}`)
      .set(bearer(adminToken))
      .send({ phone: '0901234999', position: 'Truong ca le tan', departmentId: targetDepartment.id })
      .expect(200);

    expect(unwrap<{ id: string }>(response.body).id).toBe(profile.userId);
    await expect(functional.prisma.staffProfile.findUniqueOrThrow({ where: { id: profile.id }, include: { user: true } }))
      .resolves.toMatchObject({ departmentId: targetDepartment.id, phone: '0901234999', position: 'Truong ca le tan', user: { id: profile.userId } });
    await expect(functional.prisma.blockchainLogger.findFirst({
      where: { entity: 'StaffProfile', entityId: profile.id, action: 'UPDATE' },
    })).resolves.not.toBeNull();
  });

  it('[TC3.06] rejects changes to username, role, or status in a staff profile update', async () => {
    const { profile } = await createStaffThroughApi('306');

    await request(functional.app.getHttpServer())
      .patch(`/api/staff/${profile.id}`)
      .set(bearer(adminToken))
      .send({ username: 'mutatedname', role: UserRole.LAB_MANAGER, status: 'INACTIVE' })
      .expect(400);

    await expect(functional.prisma.user.findUniqueOrThrow({ where: { id: profile.userId } }))
      .resolves.toMatchObject({ username: 'reception306', role: UserRole.RECEPTIONIST, status: 'ACTIVE' });
  });

  it('[TC3.07] rejects assigning a receptionist to an examination department', async () => {
    const examinationDepartment = await functional.prisma.department.create({
      data: { departmentCode: 'STAFF-307', name: 'Phong kham 307', type: DepartmentType.EXAMINATION, status: 'ACTIVE' },
    });
    const { profile } = await createStaffThroughApi('307');

    await request(functional.app.getHttpServer())
      .patch(`/api/staff/${profile.id}`)
      .set(bearer(adminToken))
      .send({ departmentId: examinationDepartment.id })
      .expect(400);

    await expect(functional.prisma.staffProfile.findUniqueOrThrow({ where: { id: profile.id } }))
      .resolves.toMatchObject({ departmentId: null });
  });

  it('[TC3.08] locks then unlocks a staff account and increments its token version', async () => {
    const { profile } = await createStaffThroughApi('308');
    const before = await functional.prisma.user.findUniqueOrThrow({ where: { id: profile.userId } });

    await request(functional.app.getHttpServer())
      .patch(`/api/staff/${profile.id}/lock`)
      .set(bearer(adminToken))
      .expect(200);
    const locked = await functional.prisma.user.findUniqueOrThrow({ where: { id: profile.userId } });
    expect(locked).toMatchObject({ status: 'INACTIVE', tokenVersion: before.tokenVersion + 1 });

    await request(functional.app.getHttpServer())
      .patch(`/api/staff/${profile.id}/unlock`)
      .set(bearer(adminToken))
      .expect(200);
    await expect(functional.prisma.user.findUniqueOrThrow({ where: { id: profile.userId } }))
      .resolves.toMatchObject({ status: 'ACTIVE', tokenVersion: before.tokenVersion + 2 });
  });

  it('[TC3.11] soft-deletes staff without assigned visits, doctor profile, or managed department', async () => {
    const { profile } = await createStaffThroughApi('311');

    const response = await request(functional.app.getHttpServer())
      .delete(`/api/staff/${profile.id}`)
      .set(bearer(adminToken))
      .expect(200);

    expect(unwrap<{ deleted: boolean; status: string }>(response.body)).toMatchObject({ deleted: true, status: 'DELETE' });
    await expect(functional.prisma.user.findUniqueOrThrow({ where: { id: profile.userId } }))
      .resolves.toMatchObject({ status: 'DELETE', deletedAt: expect.any(Date), deletedBy: expect.any(String) });
    await expect(functional.prisma.staffProfile.findUniqueOrThrow({ where: { id: profile.id } }))
      .resolves.toMatchObject({ userId: profile.userId });
  });

  it('[TC3.12] refuses permanent deletion when the staff member manages a department', async () => {
    const department = await createCompatibleDepartment('312');
    const { profile } = await createStaffThroughApi('312', department.id);
    await functional.prisma.department.update({ where: { id: department.id }, data: { managerId: profile.id } });
    await functional.prisma.user.update({ where: { id: profile.userId }, data: { status: 'DELETE', deletedAt: new Date() } });

    await request(functional.app.getHttpServer())
      .delete(`/api/staff/${profile.id}/permanent`)
      .set(bearer(adminToken))
      .expect(409);

    await expect(functional.prisma.staffProfile.findUniqueOrThrow({ where: { id: profile.id } }))
      .resolves.toMatchObject({ id: profile.id });
    await expect(functional.prisma.department.findUniqueOrThrow({ where: { id: department.id } }))
      .resolves.toMatchObject({ managerId: profile.id });
  });

  it('[TC3.13] restores a recently soft-deleted staff account as inactive and retains the profile', async () => {
    const { profile } = await createStaffThroughApi('313');
    await request(functional.app.getHttpServer()).delete(`/api/staff/${profile.id}`).set(bearer(adminToken)).expect(200);

    const response = await request(functional.app.getHttpServer())
      .patch(`/api/staff/${profile.id}/restore`)
      .set(bearer(adminToken))
      .expect(200);

    expect(unwrap<{ restored: boolean; status: string }>(response.body)).toMatchObject({ restored: true, status: 'INACTIVE' });
    await expect(functional.prisma.user.findUniqueOrThrow({ where: { id: profile.userId } }))
      .resolves.toMatchObject({ status: 'INACTIVE', deletedAt: null, deletedBy: null, restoredAt: expect.any(Date) });
    await expect(functional.prisma.staffProfile.findUniqueOrThrow({ where: { id: profile.id } }))
      .resolves.toMatchObject({ userId: profile.userId });
  });

  it('[TC3.14] permanently removes an unreferenced deleted StaffProfile and retains its User tombstone', async () => {
    const { profile } = await createStaffThroughApi('314');
    await request(functional.app.getHttpServer()).delete(`/api/staff/${profile.id}`).set(bearer(adminToken)).expect(200);

    await request(functional.app.getHttpServer())
      .delete(`/api/staff/${profile.id}/permanent`)
      .set(bearer(adminToken))
      .expect(200);

    await expect(functional.prisma.staffProfile.findUnique({ where: { id: profile.id } })).resolves.toBeNull();
    await expect(functional.prisma.user.findUniqueOrThrow({ where: { id: profile.userId } }))
      .resolves.toMatchObject({ id: profile.userId, status: 'DELETE' });
  });
});
