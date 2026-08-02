import request from 'supertest';
import { UserRole } from '@prisma/client';
import { hashInviteToken, hashPassword } from '../../src/modules/auth/domain/credential.util';
import { createFunctionalApp, FunctionalApp, unwrap } from './support/functional-app';
import { bearer, createAdminA, resetFunctionalDatabase } from './support/database-reset';

describe('S1 Authentication and authorization (functional API)', () => {
  let functional: FunctionalApp;

  beforeAll(async () => {
    functional = await createFunctionalApp();
  });

  beforeEach(async () => {
    await resetFunctionalDatabase(functional.prisma);
  });

  afterAll(async () => {
    await functional.close();
  });

  async function createStaffUser(role: UserRole, identity: string) {
    return functional.prisma.user.create({
      data: {
        username: identity,
        email: `${identity}@test.local`,
        role,
        status: 'ACTIVE',
        firstLogin: false,
      },
    });
  }

  it('[TC1.01] allows the single Admin A to begin first login with a valid invite token', async () => {
    const inviteToken = 'a'.repeat(32);
    const admin = await functional.prisma.user.create({
      data: {
        username: 'admin-a',
        email: 'admin-a@test.local',
        role: UserRole.ADMIN,
        status: 'ACTIVE',
        firstLogin: true,
        inviteToken: hashInviteToken(inviteToken),
        inviteTokenExpiry: new Date(Date.now() + 60_000),
        adminProfile: { create: { adminUserName: 'Admin A' } },
      },
    });

    const response = await request(functional.app.getHttpServer())
      .post('/api/auth/invite-login')
      .send({ inviteToken })
      .expect(201);

    expect(unwrap<{ firstLogin: boolean; requireRegistration: boolean; user: { id: string; role: string } }>(response.body))
      .toMatchObject({ firstLogin: true, requireRegistration: true, user: { id: admin.id, role: 'ADMIN' } });
    expect(response.headers['set-cookie']).toEqual(expect.arrayContaining([expect.stringContaining('token=')]));
  });

  it('[TC1.02] rejects an invalid invite token without creating an authenticated cookie', async () => {
    await createAdminA(functional.prisma);

    const response = await request(functional.app.getHttpServer())
      .post('/api/auth/invite-login')
      .send({ inviteToken: 'b'.repeat(32) })
      .expect(401);

    expect(response.body).toMatchObject({ success: false, statusCode: 401 });
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('[TC1.06] accepts public invite entry but rejects a token linked to a non-Admin account', async () => {
    const inviteToken = 'c'.repeat(32);
    const staff = await functional.prisma.user.create({
      data: {
        username: 'reception-invite',
        email: 'reception-invite@test.local',
        role: UserRole.RECEPTIONIST,
        status: 'ACTIVE',
        firstLogin: true,
        inviteToken: hashInviteToken(inviteToken),
        inviteTokenExpiry: new Date(Date.now() + 60_000),
      },
    });

    const response = await request(functional.app.getHttpServer())
      .post('/api/auth/invite-login')
      .send({ inviteToken })
      .expect(401);

    expect(response.headers['set-cookie']).toBeUndefined();
    await expect(functional.prisma.user.findUniqueOrThrow({ where: { id: staff.id } }))
      .resolves.toMatchObject({ firstLogin: true });
  });

  it('[TC1.07] rejects an expired or already used invite token', async () => {
    const expiredToken = 'd'.repeat(32);
    const usedToken = 'e'.repeat(32);
    await functional.prisma.user.createMany({
      data: [
        {
          username: 'expired-invite', email: 'expired-invite@test.local', role: UserRole.RECEPTIONIST, status: 'ACTIVE',
          firstLogin: true, inviteToken: hashInviteToken(expiredToken), inviteTokenExpiry: new Date(Date.now() - 1_000),
        },
        {
          username: 'used-invite', email: 'used-invite@test.local', role: UserRole.RECEPTIONIST, status: 'ACTIVE',
          firstLogin: false, inviteToken: hashInviteToken(usedToken), inviteTokenExpiry: new Date(Date.now() + 60_000),
        },
      ],
    });

    await request(functional.app.getHttpServer()).post('/api/auth/invite-login').send({ inviteToken: expiredToken }).expect(401);
    await request(functional.app.getHttpServer()).post('/api/auth/invite-login').send({ inviteToken: usedToken }).expect(401);
  });

  it('[TC1.08] changes a staff password when the current password is correct', async () => {
    const user = await functional.prisma.user.create({
      data: {
        username: 'password-staff',
        email: 'password-staff@test.local',
        role: UserRole.RECEPTIONIST,
        status: 'ACTIVE',
        firstLogin: false,
        passwordHash: hashPassword('Password123!'),
      },
    });
    const token = functional.tokenFor({ id: user.id, role: user.role, tokenVersion: user.tokenVersion });

    const response = await request(functional.app.getHttpServer())
      .post('/api/auth/change-password')
      .set(bearer(token))
      .send({ currentPassword: 'Password123!', newPassword: 'NewPassword123!' })
      .expect(201);

    expect(unwrap<{ passwordChanged: boolean }>(response.body)).toMatchObject({ passwordChanged: true });
    const updated = await functional.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.passwordHash).not.toBe(user.passwordHash);
  });

  it('[TC1.09] rejects a password change when the supplied current password is wrong', async () => {
    const user = await functional.prisma.user.create({
      data: {
        username: 'wrong-password-staff',
        email: 'wrong-password-staff@test.local',
        role: UserRole.RECEPTIONIST,
        status: 'ACTIVE',
        firstLogin: false,
        passwordHash: hashPassword('Password123!'),
      },
    });
    const token = functional.tokenFor({ id: user.id, role: user.role, tokenVersion: user.tokenVersion });

    await request(functional.app.getHttpServer())
      .post('/api/auth/change-password')
      .set(bearer(token))
      .send({ currentPassword: 'WrongPassword123!', newPassword: 'NewPassword123!' })
      .expect(401);

    await expect(functional.prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
      .resolves.toMatchObject({ passwordHash: user.passwordHash });
  });

  it('[TC1.10] denies a receptionist access to department administration without mutation', async () => {
    const receptionist = await createStaffUser(UserRole.RECEPTIONIST, 'rbac-receptionist');
    const token = functional.tokenFor({ id: receptionist.id, role: receptionist.role, tokenVersion: receptionist.tokenVersion });

    await request(functional.app.getHttpServer())
      .post('/api/departments')
      .set(bearer(token))
      .send({ departmentCode: 'DENY-10', name: 'Denied Department', type: 'CLINICAL' })
      .expect(403);

    await expect(functional.prisma.department.count({ where: { departmentCode: 'DENY-10' } })).resolves.toBe(0);
  });

  it('[TC1.11] denies a doctor access to AI model registry administration without mutation', async () => {
    const doctor = await createStaffUser(UserRole.DOCTOR, 'rbac-doctor');
    const token = functional.tokenFor({ id: doctor.id, role: doctor.role, tokenVersion: doctor.tokenVersion });

    await request(functional.app.getHttpServer())
      .post('/api/ai-models')
      .set(bearer(token))
      .send({ modelId: 'DENY-11', modelName: 'Denied Model', modelVersion: '1.0.0' })
      .expect(403);

    await expect(functional.prisma.aiModelRegistry.count({ where: { modelId: 'DENY-11' } })).resolves.toBe(0);
  });

  it('[TC1.12] denies a lab manager from creating a clinical conclusion', async () => {
    const labManager = await createStaffUser(UserRole.LAB_MANAGER, 'rbac-lab-manager');
    const token = functional.tokenFor({ id: labManager.id, role: labManager.role, tokenVersion: labManager.tokenVersion });

    await request(functional.app.getHttpServer())
      .post('/api/clinical-decisions/conclusions')
      .set(bearer(token))
      .send({ visitId: '00000000-0000-4000-8000-000000000012', finalDiagnosis: 'No permission' })
      .expect(403);

    await expect(functional.prisma.medicalConclusion.count()).resolves.toBe(0);
  });
});
