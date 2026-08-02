import request from 'supertest';
import { DepartmentType, UserRole, VisitStatus } from '@prisma/client';
import { createFunctionalApp, FunctionalApp, unwrap } from './support/functional-app';
import { bearer, createAdminA, resetFunctionalDatabase } from './support/database-reset';

type Created = { id: string };

describe('S7 Patient intake and Visit state machine (functional API)', () => {
  let functional: FunctionalApp;
  let adminToken: string;
  let receptionistToken: string;

  beforeAll(async () => {
    functional = await createFunctionalApp();
  });

  beforeEach(async () => {
    await resetFunctionalDatabase(functional.prisma);
    const admin = await createAdminA(functional.prisma);
    adminToken = functional.tokenFor({ ...admin, role: UserRole.ADMIN });
    const receptionist = await functional.prisma.user.create({ data: { username: 'intake-reception', email: 'intake-reception@test.local', role: UserRole.RECEPTIONIST, status: 'ACTIVE', firstLogin: false } });
    receptionistToken = functional.tokenFor({ ...receptionist, role: UserRole.RECEPTIONIST });
  });

  afterAll(async () => {
    await functional.close();
  });

  function patientPayload(suffix: string, overrides: Record<string, unknown> = {}) {
    return {
      fullName: 'Nguyen Van An',
      gender: 'MALE',
      birthDate: '1990-01-15',
      citizenId: `400000000${suffix.padStart(3, '0')}`,
      phone: `0901234${suffix.padStart(3, '0')}`,
      address: `Dia chi ${suffix}`,
      emergencyContact: '0907654321',
      ...overrides,
    };
  }

  async function examinationDepartment(suffix: string, status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE') {
    return functional.prisma.department.create({
      data: { departmentCode: `INTAKE-${suffix}`, name: `Phong kham ${suffix}`, type: DepartmentType.EXAMINATION, status },
    });
  }

  async function createPatient(suffix: string) {
    const response = await request(functional.app.getHttpServer())
      .post('/api/patients')
      .set(bearer(receptionistToken))
      .send(patientPayload(suffix))
      .expect(201);
    return unwrap<Created>(response.body);
  }

  async function createVisitForExistingPatient(suffix: string) {
    const patient = await createPatient(suffix);
    const department = await examinationDepartment(suffix);
    const response = await request(functional.app.getHttpServer())
      .post('/api/visits')
      .set(bearer(receptionistToken))
      .send({ patientId: patient.id, departmentId: department.id })
      .expect(201);
    return { patient, department, visit: unwrap<Created>(response.body) };
  }

  it('[TC7.01] lets a Receptionist create a valid Patient and writes a CREATE audit record', async () => {
    const patient = await createPatient('701');

    await expect(functional.prisma.patient.findUniqueOrThrow({ where: { id: patient.id } }))
      .resolves.toMatchObject({ fullName: 'Nguyen Van An', citizenId: '400000000701' });
    await expect(functional.prisma.blockchainLogger.findFirst({ where: { entity: 'Patient', entityId: patient.id, action: 'CREATE' } })).resolves.not.toBeNull();
  });

  it('[TC7.02] rejects a duplicate Patient citizen ID without creating another Patient', async () => {
    await createPatient('702');
    await request(functional.app.getHttpServer())
      .post('/api/patients')
      .set(bearer(receptionistToken))
      .send(patientPayload('703', { citizenId: '400000000702' }))
      .expect(409);

    await expect(functional.prisma.patient.count({ where: { citizenId: '400000000702' } })).resolves.toBe(1);
  });

  it('[TC7.03] lets a Receptionist update Patient data and writes an UPDATE audit record', async () => {
    const patient = await createPatient('703');
    await request(functional.app.getHttpServer())
      .patch(`/api/patients/${patient.id}`)
      .set(bearer(receptionistToken))
      .send(patientPayload('703', { address: 'Dia chi da cap nhat', phone: '0908888888' }))
      .expect(200);

    await expect(functional.prisma.patient.findUniqueOrThrow({ where: { id: patient.id } })).resolves.toMatchObject({ address: 'Dia chi da cap nhat', phone: '0908888888' });
    await expect(functional.prisma.blockchainLogger.findFirst({ where: { entity: 'Patient', entityId: patient.id, action: 'UPDATE' } })).resolves.not.toBeNull();
  });

  it('[TC7.04] registers a Visit for an existing Patient in an active examination department with WAITING state and audit', async () => {
    const { patient, department, visit } = await createVisitForExistingPatient('704');

    await expect(functional.prisma.visit.findUniqueOrThrow({ where: { id: visit.id } }))
      .resolves.toMatchObject({ patientId: patient.id, departmentId: department.id, status: VisitStatus.WAITING });
    await expect(functional.prisma.blockchainLogger.findFirst({ where: { entity: 'Visit', entityId: visit.id, action: 'CREATE' } })).resolves.not.toBeNull();
  });

  it('[TC7.05] atomically creates a new Patient and its WAITING Visit through quick intake', async () => {
    const department = await examinationDepartment('705');
    const response = await request(functional.app.getHttpServer())
      .post('/api/visits')
      .set(bearer(receptionistToken))
      .send({ patient: patientPayload('705'), departmentId: department.id })
      .expect(201);
    const visit = unwrap<Created>(response.body);
    const stored = await functional.prisma.visit.findUniqueOrThrow({ where: { id: visit.id }, include: { patient: true } });

    expect(stored).toMatchObject({ departmentId: department.id, status: VisitStatus.WAITING, patient: { citizenId: '400000000705' } });
    await expect(functional.prisma.blockchainLogger.count({ where: { entityId: { in: [stored.id, stored.patientId] }, action: 'CREATE' } })).resolves.toBe(2);
  });

  it('[TC7.06] refuses an intake that sends both an existing Patient and new Patient data without partial writes', async () => {
    const patient = await createPatient('706');
    const department = await examinationDepartment('706');
    await request(functional.app.getHttpServer())
      .post('/api/visits')
      .set(bearer(receptionistToken))
      .send({ patientId: patient.id, patient: patientPayload('706X'), departmentId: department.id })
      .expect(400);

    await expect(functional.prisma.patient.count()).resolves.toBe(1);
    await expect(functional.prisma.visit.count()).resolves.toBe(0);
  });

  it('[TC7.07] rejects quick intake with no valid contact or identity and creates no Patient or Visit', async () => {
    const department = await examinationDepartment('707');
    const payload = patientPayload('707', { citizenId: undefined, phone: undefined, emergencyContact: undefined });
    await request(functional.app.getHttpServer())
      .post('/api/visits')
      .set(bearer(receptionistToken))
      .send({ patient: payload, departmentId: department.id })
      .expect(400);

    await expect(functional.prisma.patient.count({ where: { citizenId: '400000000707' } })).resolves.toBe(0);
    await expect(functional.prisma.visit.count({ where: { departmentId: department.id } })).resolves.toBe(0);
  });

  it('[TC7.08] refuses Visit creation in missing, wrong-type, or inactive departments without changing the Patient', async () => {
    const patient = await createPatient('708');
    const inactive = await examinationDepartment('708I', 'INACTIVE');
    const wrongType = await functional.prisma.department.create({ data: { departmentCode: 'INTAKE-708W', name: 'Phong hanh chinh', type: DepartmentType.ADMINISTRATIVE, status: 'ACTIVE' } });

    for (const departmentId of ['00000000-0000-4000-8000-000000000708', inactive.id, wrongType.id]) {
      await request(functional.app.getHttpServer()).post('/api/visits').set(bearer(receptionistToken)).send({ patientId: patient.id, departmentId }).expect(departmentId === inactive.id || departmentId === wrongType.id ? 400 : 404);
    }
    await expect(functional.prisma.visit.count()).resolves.toBe(0);
    await expect(functional.prisma.patient.findUniqueOrThrow({ where: { id: patient.id } })).resolves.toMatchObject({ citizenId: '400000000708' });
  });

  it('[TC7.10] permits the direct Visit state-machine path and writes status audits', async () => {
    const { visit } = await createVisitForExistingPatient('710');
    for (const status of [VisitStatus.IN_PROGRESS, VisitStatus.WAITING_TEST_RESULT, VisitStatus.WAITING_CONCLUSION]) {
      await request(functional.app.getHttpServer()).patch(`/api/visits/${visit.id}/status`).set(bearer(adminToken)).send({ status }).expect(200);
    }

    await expect(functional.prisma.visit.findUniqueOrThrow({ where: { id: visit.id } })).resolves.toMatchObject({ status: VisitStatus.WAITING_CONCLUSION });
    await expect(functional.prisma.blockchainLogger.count({ where: { entity: 'Visit', entityId: visit.id, action: 'UPDATE' } })).resolves.toBe(3);
  });

  it('[TC7.11] rejects invalid or terminal Visit status transitions without changing persisted state', async () => {
    const { visit } = await createVisitForExistingPatient('711');
    await request(functional.app.getHttpServer()).patch(`/api/visits/${visit.id}/status`).set(bearer(adminToken)).send({ status: VisitStatus.COMPLETED }).expect(400);
    await request(functional.app.getHttpServer()).patch(`/api/visits/${visit.id}/status`).set(bearer(adminToken)).send({ status: VisitStatus.CANCELLED }).expect(200);
    await request(functional.app.getHttpServer()).patch(`/api/visits/${visit.id}/status`).set(bearer(adminToken)).send({ status: VisitStatus.IN_PROGRESS }).expect(400);

    await expect(functional.prisma.visit.findUniqueOrThrow({ where: { id: visit.id } })).resolves.toMatchObject({ status: VisitStatus.CANCELLED });
  });
});
