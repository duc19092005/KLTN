import request from 'supertest';
import { DepartmentType, MedicalSpecialty, UserRole } from '@prisma/client';
import { createFunctionalApp, FunctionalApp, unwrap } from './support/functional-app';
import { bearer, createAdminA, resetFunctionalDatabase } from './support/database-reset';

type DoctorResponse = {
  id: string;
  specialty: MedicalSpecialty;
  staffProfile: { id: string; user: { id: string; role: UserRole } };
};

describe('S4 Doctor lifecycle (functional API)', () => {
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

  async function createClinicalDepartment(suffix: string) {
    return functional.prisma.department.create({
      data: {
        departmentCode: `DOC-${suffix}`,
        name: `Khoa Lam Sang ${suffix}`,
        type: DepartmentType.CLINICAL,
        status: 'ACTIVE',
      },
    });
  }

  function doctorPayload(suffix: string, departmentId: string, overrides: Record<string, unknown> = {}) {
    return {
      username: `doctor${suffix}`,
      email: `doctor${suffix}@test.local`,
      fullName: 'Bac Si Functional',
      phone: `0901234${suffix}`,
      gender: 'Nam',
      citizenId: `300000000${suffix}`,
      birthDate: '1988-01-20',
      address: 'Ho Chi Minh City',
      avatarUrl: `https://avatars.test.local/doctor-${suffix}.jpg`,
      departmentId,
      position: 'Bac si',
      specialty: MedicalSpecialty.CARDIOLOGY,
      licenseNumber: `LIC-${suffix}`,
      qualification: 'MD',
      yearsExperience: 10,
      ...overrides,
    };
  }

  async function createDoctorThroughApi(suffix: string, departmentId: string, overrides: Record<string, unknown> = {}) {
    const response = await request(functional.app.getHttpServer())
      .post('/api/doctors/full')
      .set(bearer(adminToken))
      .send(doctorPayload(suffix, departmentId, overrides))
      .expect(201);
    return unwrap<DoctorResponse>(response.body);
  }

  it('[TC4.01] creates a doctor user, staff profile, and doctor profile atomically with a CREATE audit', async () => {
    const department = await createClinicalDepartment('401');
    const created = await createDoctorThroughApi('401', department.id);

    expect(created).toMatchObject({ specialty: MedicalSpecialty.CARDIOLOGY, staffProfile: { user: { role: UserRole.DOCTOR } } });
    await expect(functional.prisma.doctorProfile.findUniqueOrThrow({ where: { id: created.id }, include: { staffProfile: { include: { user: true } } } }))
      .resolves.toMatchObject({ specialty: MedicalSpecialty.CARDIOLOGY, licenseNumber: 'LIC-401', staffProfile: { departmentId: department.id, user: { status: 'ACTIVE', firstLogin: true } } });
    await expect(functional.prisma.blockchainLogger.findFirst({
      where: { entity: 'DoctorProfile', entityId: created.id, action: 'CREATE' },
    })).resolves.not.toBeNull();
  });

  it('[TC4.02] creates a DoctorProfile for an existing DOCTOR staff member', async () => {
    const department = await createClinicalDepartment('402');
    const user = await functional.prisma.user.create({
      data: {
        username: 'doctorstaff', email: 'doctorstaff@test.local', role: UserRole.DOCTOR, status: 'ACTIVE', firstLogin: false,
        staffProfile: { create: { employeeCode: 'BS-0402', fullName: 'Bac Si Existing', phone: '0901234402', gender: 'Nam', citizenId: '300000000402', birthDate: new Date('1980-01-01'), address: 'Ho Chi Minh City', avatarUrl: 'test://doctor-existing', departmentId: department.id, position: 'Bac si' } },
      },
      include: { staffProfile: true },
    });

    const response = await request(functional.app.getHttpServer())
      .post('/api/doctors')
      .set(bearer(adminToken))
      .send({ staffProfileId: user.staffProfile!.id, specialty: MedicalSpecialty.NEUROLOGY, licenseNumber: 'LIC-402', qualification: 'MD', yearsExperience: 8 })
      .expect(201);

    expect(unwrap<DoctorResponse>(response.body)).toMatchObject({ specialty: MedicalSpecialty.NEUROLOGY, staffProfile: { id: user.staffProfile!.id } });
  });

  it('[TC4.03] rejects duplicate doctor identity or license data without partial creation', async () => {
    const department = await createClinicalDepartment('403');
    await createDoctorThroughApi('403', department.id);

    await request(functional.app.getHttpServer())
      .post('/api/doctors/full')
      .set(bearer(adminToken))
      .send(doctorPayload('404', department.id, { licenseNumber: 'LIC-403' }))
      .expect(409);

    await expect(functional.prisma.doctorProfile.count({ where: { licenseNumber: 'LIC-403' } })).resolves.toBe(1);
    await expect(functional.prisma.user.count({ where: { username: 'doctor404' } })).resolves.toBe(0);
  });

  it('[TC4.04] updates medical specialty, qualification, and experience and records UPDATE audit', async () => {
    const department = await createClinicalDepartment('404');
    const created = await createDoctorThroughApi('404', department.id);

    const response = await request(functional.app.getHttpServer())
      .patch(`/api/doctors/${created.id}`)
      .set(bearer(adminToken))
      .send({ specialty: MedicalSpecialty.NEUROLOGY, qualification: 'Specialist II', yearsExperience: 12 })
      .expect(200);

    expect(unwrap<DoctorResponse>(response.body)).toMatchObject({ specialty: MedicalSpecialty.NEUROLOGY });
    await expect(functional.prisma.doctorProfile.findUniqueOrThrow({ where: { id: created.id } }))
      .resolves.toMatchObject({ qualification: 'Specialist II', yearsExperience: 12 });
    await expect(functional.prisma.blockchainLogger.findFirst({
      where: { entity: 'DoctorProfile', entityId: created.id, action: 'UPDATE' },
    })).resolves.not.toBeNull();
  });

  it('[TC4.05] filters doctors by specialty and account status with pagination', async () => {
    const department = await createClinicalDepartment('405');
    const cardiology = await createDoctorThroughApi('405', department.id);
    await createDoctorThroughApi('406', department.id, { specialty: MedicalSpecialty.NEUROLOGY, licenseNumber: 'LIC-406' });
    await functional.prisma.user.update({ where: { id: cardiology.staffProfile.user.id }, data: { status: 'INACTIVE' } });

    const activeNeurology = await request(functional.app.getHttpServer())
      .get(`/api/doctors?specialty=${MedicalSpecialty.NEUROLOGY}&status=ACTIVE&page=1&limit=10`)
      .set(bearer(adminToken))
      .expect(200);
    const body = unwrap<{ items: Array<{ specialty: MedicalSpecialty }>; total: number }>(activeNeurology.body);

    expect(body).toMatchObject({ total: 1, items: [{ specialty: MedicalSpecialty.NEUROLOGY }] });
  });

  it('[TC4.06] soft-deletes an unreferenced Doctor while retaining its profiles and User tombstone', async () => {
    const department = await createClinicalDepartment('406');
    const created = await createDoctorThroughApi('406', department.id);

    await request(functional.app.getHttpServer()).delete(`/api/doctors/${created.id}`).set(bearer(adminToken)).expect(200);

    await expect(functional.prisma.doctorProfile.findUniqueOrThrow({ where: { id: created.id } })).resolves.toMatchObject({ id: created.id });
    await expect(functional.prisma.user.findUniqueOrThrow({ where: { id: created.staffProfile.user.id } }))
      .resolves.toMatchObject({ status: 'DELETE', deletedAt: expect.any(Date), deletedBy: expect.any(String) });
  });

  it('[TC4.07] refuses permanent deletion of a Doctor with an assigned Visit and retains every relation', async () => {
    const department = await createClinicalDepartment('407');
    const created = await createDoctorThroughApi('407', department.id);
    const patient = await functional.prisma.patient.create({
      data: { patientCode: 'BN-DOC-407', fullName: 'Benh Nhan Doctor', gender: 'MALE', birthDate: new Date('1990-01-01') },
    });
    await functional.prisma.visit.create({
      data: { visitCode: 'VISIT-DOC-407', patientId: patient.id, departmentId: department.id, staffId: created.staffProfile.id },
    });
    await request(functional.app.getHttpServer()).delete(`/api/doctors/${created.id}`).set(bearer(adminToken)).expect(200);

    await request(functional.app.getHttpServer()).delete(`/api/doctors/${created.id}/permanent`).set(bearer(adminToken)).expect(409);

    await expect(functional.prisma.doctorProfile.findUniqueOrThrow({ where: { id: created.id } })).resolves.toMatchObject({ staffProfileId: created.staffProfile.id });
    await expect(functional.prisma.visit.findUniqueOrThrow({ where: { visitCode: 'VISIT-DOC-407' } })).resolves.toMatchObject({ staffId: created.staffProfile.id });
  });

  it('[TC4.08] restores a recently soft-deleted Doctor as inactive without losing their department or profiles', async () => {
    const department = await createClinicalDepartment('408');
    const created = await createDoctorThroughApi('408', department.id);
    await request(functional.app.getHttpServer()).delete(`/api/doctors/${created.id}`).set(bearer(adminToken)).expect(200);

    await request(functional.app.getHttpServer()).patch(`/api/doctors/${created.id}/restore`).set(bearer(adminToken)).expect(200);

    await expect(functional.prisma.doctorProfile.findUniqueOrThrow({ where: { id: created.id }, include: { staffProfile: { include: { user: true } } } }))
      .resolves.toMatchObject({ staffProfile: { departmentId: department.id, user: { status: 'INACTIVE', deletedAt: null, restoredAt: expect.any(Date) } } });
  });

  it('[TC4.09] permanently removes an unreferenced deleted Doctor and StaffProfile while retaining the User tombstone', async () => {
    const department = await createClinicalDepartment('409');
    const created = await createDoctorThroughApi('409', department.id);
    await request(functional.app.getHttpServer()).delete(`/api/doctors/${created.id}`).set(bearer(adminToken)).expect(200);

    await request(functional.app.getHttpServer()).delete(`/api/doctors/${created.id}/permanent`).set(bearer(adminToken)).expect(200);

    await expect(functional.prisma.doctorProfile.findUnique({ where: { id: created.id } })).resolves.toBeNull();
    await expect(functional.prisma.staffProfile.findUnique({ where: { id: created.staffProfile.id } })).resolves.toBeNull();
    await expect(functional.prisma.user.findUniqueOrThrow({ where: { id: created.staffProfile.user.id } })).resolves.toMatchObject({ status: 'DELETE' });
  });
});
