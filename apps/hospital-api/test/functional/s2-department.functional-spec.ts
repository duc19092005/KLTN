import request from 'supertest';
import { DepartmentType, UserRole } from '@prisma/client';
import { createFunctionalApp, FunctionalApp, unwrap } from './support/functional-app';
import { bearer, createAdminA, resetFunctionalDatabase } from './support/database-reset';

describe('S2 Department lifecycle (functional API)', () => {
  let functional: FunctionalApp;
  let adminToken: string;

  const clinicalDepartment = (suffix: string) => ({
    departmentCode: `CLN-${suffix}`,
    name: `Khoa Noi ${suffix}`,
    floor: '2A',
    type: DepartmentType.CLINICAL,
    canReceiveOrders: false,
    description: `Functional fixture ${suffix}`,
  });

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

  it('[TC2.01] creates a valid active clinical department and records its audit change', async () => {
    const response = await request(functional.app.getHttpServer())
      .post('/api/departments')
      .set(bearer(adminToken))
      .send(clinicalDepartment('01'))
      .expect(201);

    const created = unwrap<{ id: string; status: string; departmentCode: string }>(response.body);
    expect(created).toMatchObject({ departmentCode: 'CLN-01', status: 'ACTIVE' });

    const audit = await functional.prisma.blockchainLogger.findFirst({
      where: { entity: 'Department', entityId: created.id, action: 'CREATE' },
    });
    expect(audit).not.toBeNull();
  });

  it('[TC2.02] rejects a duplicate department code without creating a second department', async () => {
    await functional.prisma.department.create({ data: clinicalDepartment('02') });

    await request(functional.app.getHttpServer())
      .post('/api/departments')
      .set(bearer(adminToken))
      .send({ ...clinicalDepartment('02X'), departmentCode: 'CLN-02' })
      .expect(400);

    await expect(
      functional.prisma.department.count({ where: { departmentCode: 'CLN-02' } }),
    ).resolves.toBe(1);
  });

  it('[TC2.03] updates floor, description and order capability within valid type rules', async () => {
    const department = await functional.prisma.department.create({
      data: { ...clinicalDepartment('03'), type: DepartmentType.LABORATORY },
    });

    const response = await request(functional.app.getHttpServer())
      .patch(`/api/departments/${department.id}`)
      .set(bearer(adminToken))
      .send({ floor: '3B', description: 'Da cap nhat', canReceiveOrders: true })
      .expect(200);

    const updated = unwrap<{ floor: string; description: string; canReceiveOrders: boolean }>(response.body);
    expect(updated).toMatchObject({ floor: '3B', description: 'Da cap nhat', canReceiveOrders: true });
  });

  it('[TC2.04] assigns a compatible staff member from the same department as manager', async () => {
    const department = await functional.prisma.department.create({ data: clinicalDepartment('04') });
    const staffUser = await functional.prisma.user.create({
      data: {
        username: 'doctor-manager',
        email: 'doctor-manager@test.local',
        role: UserRole.DOCTOR,
        status: 'ACTIVE',
        firstLogin: false,
        staffProfile: {
          create: {
            departmentId: department.id,
            fullName: 'Doctor Manager',
            phone: '0900000004',
            gender: 'MALE',
            citizenId: '100000000004',
            birthDate: new Date('1985-01-01'),
            avatarUrl: 'test://avatar/doctor-manager',
            employeeCode: 'DR-MGR-04',
          },
        },
      },
      include: { staffProfile: true },
    });

    const response = await request(functional.app.getHttpServer())
      .patch(`/api/departments/${department.id}/manager`)
      .set(bearer(adminToken))
      .send({ managerId: staffUser.staffProfile!.id })
      .expect(200);

    expect(unwrap<{ managerId: string }>(response.body).managerId).toBe(staffUser.staffProfile!.id);
  });

  it('[TC2.05] rejects assignment of a non-existent manager without changing the current manager', async () => {
    const department = await functional.prisma.department.create({ data: clinicalDepartment('05') });

    await request(functional.app.getHttpServer())
      .patch(`/api/departments/${department.id}/manager`)
      .set(bearer(adminToken))
      .send({ managerId: '00000000-0000-4000-8000-000000000005' })
      .expect(404);

    await expect(functional.prisma.department.findUniqueOrThrow({ where: { id: department.id } }))
      .resolves.toMatchObject({ managerId: null });
  });

  it('[TC2.06] filters departments by status and excludes deleted departments by default', async () => {
    await functional.prisma.department.createMany({
      data: [
        clinicalDepartment('06A'),
        { ...clinicalDepartment('06I'), name: 'Khoa Noi 06I', status: 'INACTIVE' },
        { ...clinicalDepartment('06D'), name: 'Khoa Noi 06D', status: 'DELETE', deletedAt: new Date() },
      ],
    });

    const active = await request(functional.app.getHttpServer())
      .get('/api/departments?status=ACTIVE&page=1&limit=10')
      .set(bearer(adminToken))
      .expect(200);
    const activeBody = unwrap<{ items: Array<{ departmentCode: string }>; total: number }>(active.body);
    expect(activeBody.total).toBe(1);
    expect(activeBody.items.map((item) => item.departmentCode)).toEqual(['CLN-06A']);

    const defaultList = await request(functional.app.getHttpServer())
      .get('/api/departments?page=1&limit=10')
      .set(bearer(adminToken))
      .expect(200);
    const defaultBody = unwrap<{ items: Array<{ departmentCode: string }> }>(defaultList.body);
    expect(defaultBody.items.map((item) => item.departmentCode)).not.toContain('CLN-06D');
  });

  it('[TC2.07] soft-deletes an empty department and records deletion metadata', async () => {
    const department = await functional.prisma.department.create({ data: clinicalDepartment('07') });

    const response = await request(functional.app.getHttpServer())
      .delete(`/api/departments/${department.id}`)
      .set(bearer(adminToken))
      .expect(200);

    expect(unwrap<{ deleted: boolean; status: string }>(response.body)).toMatchObject({
      deleted: true,
      status: 'DELETE',
    });
    await expect(functional.prisma.department.findUniqueOrThrow({ where: { id: department.id } }))
      .resolves.toMatchObject({ status: 'DELETE', deletedBy: expect.any(String), deletedAt: expect.any(Date) });
  });

  it('[TC2.08] refuses to delete an active department that still has staff data', async () => {
    const department = await functional.prisma.department.create({ data: clinicalDepartment('08') });
    await functional.prisma.user.create({
      data: {
        username: 'staff-reference-08',
        email: 'staff-reference-08@test.local',
        role: UserRole.RECEPTIONIST,
        status: 'ACTIVE',
        firstLogin: false,
        staffProfile: {
          create: {
            departmentId: department.id,
            fullName: 'Staff Reference',
            phone: '0900000008',
            gender: 'FEMALE',
            citizenId: '100000000008',
            birthDate: new Date('1990-01-01'),
            avatarUrl: 'test://avatar/staff-reference',
            employeeCode: 'RC-REF-08',
          },
        },
      },
    });

    await request(functional.app.getHttpServer())
      .delete(`/api/departments/${department.id}`)
      .set(bearer(adminToken))
      .expect(409);

    await expect(functional.prisma.department.findUniqueOrThrow({ where: { id: department.id } }))
      .resolves.toMatchObject({ status: 'ACTIVE', deletedAt: null });
  });

  it('[TC2.09] soft-deletes an inactive department with business references without removing them', async () => {
    const department = await functional.prisma.department.create({
      data: { ...clinicalDepartment('09'), status: 'INACTIVE' },
    });
    const staff = await functional.prisma.user.create({
      data: {
        username: 'staff-reference-09',
        email: 'staff-reference-09@test.local',
        role: UserRole.RECEPTIONIST,
        status: 'ACTIVE',
        firstLogin: false,
        staffProfile: {
          create: {
            departmentId: department.id,
            fullName: 'Staff Reference Nine',
            phone: '0900000009',
            gender: 'FEMALE',
            citizenId: '100000000009',
            birthDate: new Date('1990-01-01'),
            avatarUrl: 'test://avatar/staff-reference-nine',
            employeeCode: 'RC-REF-09',
          },
        },
      },
      include: { staffProfile: true },
    });

    await request(functional.app.getHttpServer())
      .delete(`/api/departments/${department.id}`)
      .set(bearer(adminToken))
      .expect(200);

    await expect(functional.prisma.staffProfile.findUniqueOrThrow({ where: { id: staff.staffProfile!.id } }))
      .resolves.toMatchObject({ departmentId: department.id });
  });

  it('[TC2.10] restores a recently deleted department as inactive and clears deletion metadata', async () => {
    const department = await functional.prisma.department.create({ data: clinicalDepartment('10') });
    await request(functional.app.getHttpServer())
      .delete(`/api/departments/${department.id}`)
      .set(bearer(adminToken))
      .expect(200);

    const response = await request(functional.app.getHttpServer())
      .patch(`/api/departments/${department.id}/restore`)
      .set(bearer(adminToken))
      .expect(200);

    expect(unwrap<{ restored: boolean; status: string }>(response.body)).toMatchObject({
      restored: true,
      status: 'INACTIVE',
    });
    await expect(functional.prisma.department.findUniqueOrThrow({ where: { id: department.id } }))
      .resolves.toMatchObject({ status: 'INACTIVE', deletedAt: null, deletedBy: null, restoredAt: expect.any(Date) });
  });

  it('[TC2.11] refuses restoration after the 30-day recovery window', async () => {
    const department = await functional.prisma.department.create({
      data: {
        ...clinicalDepartment('11'),
        status: 'DELETE',
        deletedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      },
    });

    await request(functional.app.getHttpServer())
      .patch(`/api/departments/${department.id}/restore`)
      .set(bearer(adminToken))
      .expect(409);

    await expect(functional.prisma.department.findUniqueOrThrow({ where: { id: department.id } }))
      .resolves.toMatchObject({ status: 'DELETE' });
  });
});
