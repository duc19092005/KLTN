import request from 'supertest';
import { DepartmentType, MedicalOrderStatus, MedicalSpecialty, UserRole, VisitStatus } from '@prisma/client';
import { createFunctionalApp, FunctionalApp, unwrap } from './support/functional-app';
import { bearer, createAdminA, resetFunctionalDatabase } from './support/database-reset';

type Created = { id: string };

type ClinicalFixture = {
  doctorToken: string;
  labToken: string;
  doctor: { id: string; staffId: string; departmentId: string; userId: string };
  visit: { id: string; patientId: string };
  laboratoryId: string;
};

describe('S7 Clinical orders, results, and conclusion (functional API)', () => {
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

  async function createClinicalFixture(suffix: string): Promise<ClinicalFixture> {
    const examination = await functional.prisma.department.create({
      data: { departmentCode: `CLINIC-${suffix}`, name: `Phong kham ${suffix}`, type: DepartmentType.CLINICAL, status: 'ACTIVE' },
    });
    const laboratory = await functional.prisma.department.create({
      data: { departmentCode: `LAB-${suffix}`, name: `Xet nghiem ${suffix}`, type: DepartmentType.LABORATORY, status: 'ACTIVE', canReceiveOrders: true },
    });
    const doctorUser = await functional.prisma.user.create({
      data: {
        username: `doctor-order-${suffix}`,
        email: `doctor-order-${suffix}@test.local`,
        role: UserRole.DOCTOR,
        status: 'ACTIVE',
        firstLogin: false,
        staffProfile: {
          create: {
            employeeCode: `BS-${suffix}`,
            fullName: 'Bac Si Order',
            phone: `0912345${suffix}`,
            gender: 'Nam',
            citizenId: `310000000${suffix}`,
            birthDate: new Date('1982-01-01'),
            address: 'HCM',
            avatarUrl: 'test://doctor',
            departmentId: examination.id,
            position: 'Bac si',
            doctorProfile: {
              create: { specialty: MedicalSpecialty.CARDIOLOGY, licenseNumber: `LIC-ORDER-${suffix}`, qualification: 'MD', yearsExperience: 8 },
            },
          },
        },
      },
      include: { staffProfile: { include: { doctorProfile: true } } },
    });
    const labUser = await functional.prisma.user.create({
      data: {
        username: `lab-order-${suffix}`, email: `lab-order-${suffix}@test.local`, role: UserRole.LAB_MANAGER, status: 'ACTIVE', firstLogin: false,
        staffProfile: { create: { employeeCode: `LABM-${suffix}`, fullName: 'Truong Lab', phone: `0922345${suffix}`, gender: 'Nu', citizenId: `320000000${suffix}`, birthDate: new Date('1984-02-02'), address: 'HCM', avatarUrl: 'test://lab', departmentId: laboratory.id, position: 'Truong khoa' } },
      },
    });
    const patient = await functional.prisma.patient.create({
      data: { patientCode: `BN-ORDER-${suffix}`, fullName: 'Benh Nhan Order', gender: 'MALE', birthDate: new Date('1990-01-01'), citizenId: `410000000${suffix}`, phone: `0932345${suffix}` },
    });
    const visit = await functional.prisma.visit.create({
      data: { visitCode: `VISIT-ORDER-${suffix}`, patientId: patient.id, departmentId: examination.id, staffId: doctorUser.staffProfile!.id, status: VisitStatus.IN_PROGRESS },
    });

    return {
      doctorToken: functional.tokenFor({ id: doctorUser.id, role: UserRole.DOCTOR, tokenVersion: doctorUser.tokenVersion }),
      labToken: functional.tokenFor({ id: labUser.id, role: UserRole.LAB_MANAGER, tokenVersion: labUser.tokenVersion }),
      doctor: { id: doctorUser.staffProfile!.doctorProfile!.id, staffId: doctorUser.staffProfile!.id, departmentId: examination.id, userId: doctorUser.id },
      visit: { id: visit.id, patientId: patient.id },
      laboratoryId: laboratory.id,
    };
  }

  async function createOrder(fixture: ClinicalFixture, orderType = 'Xet nghiem mau') {
    const response = await request(functional.app.getHttpServer())
      .post('/api/medical-orders')
      .set(bearer(fixture.doctorToken))
      .send({ visitId: fixture.visit.id, targetDepartmentId: fixture.laboratoryId, orderType, priority: 'URGENT', clinicalNote: 'Theo doi chi so' })
      .expect(201);
    return unwrap<Created>(response.body);
  }

  function privatePdfMetadata() {
    return [{ fileName: 'result.pdf', originalName: 'result.pdf', mimeType: 'application/pdf', size: 1234, storageProvider: 'S3', bucket: 'kltn-private-test', objectKey: 'results/result.pdf', sha256: 'a'.repeat(64), etag: 'etag-test' }];
  }

  it('[TC7.09] refuses a Doctor order for another department/Doctor visit without changing the Visit', async () => {
    const owner = await createClinicalFixture('709');
    const outsiderDepartment = await functional.prisma.department.create({ data: { departmentCode: 'CLINIC-709X', name: 'Phong kham khac', type: DepartmentType.CLINICAL, status: 'ACTIVE' } });
    const outsider = await functional.prisma.user.create({
      data: { username: 'doctor-outsider', email: 'doctor-outsider@test.local', role: UserRole.DOCTOR, status: 'ACTIVE', firstLogin: false, staffProfile: { create: { employeeCode: 'BS-709X', fullName: 'Bac Si Khac', phone: '0941234709', gender: 'Nam', citizenId: '330000000709', birthDate: new Date('1980-01-01'), avatarUrl: 'test://outsider', departmentId: outsiderDepartment.id, doctorProfile: { create: { specialty: MedicalSpecialty.NEUROLOGY, licenseNumber: 'LIC-709X', qualification: 'MD' } } } } },
    });
    const outsiderToken = functional.tokenFor({ id: outsider.id, role: UserRole.DOCTOR, tokenVersion: outsider.tokenVersion });

    await request(functional.app.getHttpServer()).post('/api/medical-orders').set(bearer(outsiderToken)).send({ visitId: owner.visit.id, targetDepartmentId: owner.laboratoryId, orderType: 'Xet nghiem mau' }).expect(400);
    await expect(functional.prisma.medicalOrder.count({ where: { visitId: owner.visit.id } })).resolves.toBe(0);
    await expect(functional.prisma.visit.findUniqueOrThrow({ where: { id: owner.visit.id } })).resolves.toMatchObject({ status: VisitStatus.IN_PROGRESS, staffId: owner.doctor.staffId });
  });

  it('[TC7.12] lets the responsible Doctor create an order, transitions the Visit, and audits the order', async () => {
    const fixture = await createClinicalFixture('712');
    const order = await createOrder(fixture);

    await expect(functional.prisma.medicalOrder.findUniqueOrThrow({ where: { id: order.id } })).resolves.toMatchObject({ visitId: fixture.visit.id, patientId: fixture.visit.patientId, doctorId: fixture.doctor.id, targetDepartmentId: fixture.laboratoryId, status: MedicalOrderStatus.ORDERED });
    await expect(functional.prisma.visit.findUniqueOrThrow({ where: { id: fixture.visit.id } })).resolves.toMatchObject({ status: VisitStatus.WAITING_TEST_RESULT });
    await expect(functional.prisma.blockchainLogger.findFirst({ where: { entity: 'MedicalOrder', entityId: order.id, action: 'CREATE' } })).resolves.not.toBeNull();
  });

  it('[TC7.13] lets the target Lab Manager return a private-S3 result, updates order/Visit, and audits all writes', async () => {
    const fixture = await createClinicalFixture('713');
    const order = await createOrder(fixture);
    await request(functional.app.getHttpServer()).post(`/api/medical-orders/${order.id}/results`).set(bearer(fixture.labToken)).send({ note: 'Da kiem tra', files: privatePdfMetadata() }).expect(201);
    const result = await functional.prisma.medicalResult.findFirstOrThrow({ where: { orderId: order.id }, include: { files: true } });

    expect(result).toMatchObject({ orderId: order.id, files: [{ storageProvider: 'S3', url: null, bucket: 'kltn-private-test', objectKey: 'results/result.pdf' }] });
    await expect(functional.prisma.medicalOrder.findUniqueOrThrow({ where: { id: order.id } })).resolves.toMatchObject({ status: MedicalOrderStatus.RESULT_READY });
    await expect(functional.prisma.visit.findUniqueOrThrow({ where: { id: fixture.visit.id } })).resolves.toMatchObject({ status: VisitStatus.WAITING_CONCLUSION });
    await expect(functional.prisma.blockchainLogger.count({ where: { entityId: { in: [result.id, order.id, fixture.visit.id] }, action: { in: ['CREATE', 'UPDATE'] } } })).resolves.toBeGreaterThanOrEqual(3);
  });

  it('[TC7.14] rejects a second result for a RESULT_READY order and retains the first result', async () => {
    const fixture = await createClinicalFixture('714');
    const order = await createOrder(fixture);
    await request(functional.app.getHttpServer()).post(`/api/medical-orders/${order.id}/results`).set(bearer(fixture.labToken)).send({ files: privatePdfMetadata() }).expect(201);
    await request(functional.app.getHttpServer()).post(`/api/medical-orders/${order.id}/results`).set(bearer(fixture.labToken)).send({ files: privatePdfMetadata() }).expect(400);

    await expect(functional.prisma.medicalResult.count({ where: { orderId: order.id } })).resolves.toBe(1);
  });

  it('[TC7.16] rejects public URLs or incomplete private-storage result metadata without creating a result', async () => {
    const fixture = await createClinicalFixture('716');
    const order = await createOrder(fixture);
    const unsafe = { ...privatePdfMetadata()[0], url: 'https://public.example/result.pdf' };
    await request(functional.app.getHttpServer()).post(`/api/medical-orders/${order.id}/results`).set(bearer(fixture.labToken)).send({ files: [unsafe] }).expect(400);
    await request(functional.app.getHttpServer()).post(`/api/medical-orders/${order.id}/results`).set(bearer(fixture.labToken)).send({ files: [{ ...privatePdfMetadata()[0], bucket: '' }] }).expect(400);

    await expect(functional.prisma.medicalResult.count({ where: { orderId: order.id } })).resolves.toBe(0);
    await expect(functional.prisma.medicalOrder.findUniqueOrThrow({ where: { id: order.id } })).resolves.toMatchObject({ status: MedicalOrderStatus.ORDERED });
  });

  it('[TC7.17] lets the responsible Doctor view returned results and reach the conclusion-ready workflow state', async () => {
    const fixture = await createClinicalFixture('717');
    const order = await createOrder(fixture);
    await request(functional.app.getHttpServer()).post(`/api/medical-orders/${order.id}/results`).set(bearer(fixture.labToken)).send({ files: privatePdfMetadata() }).expect(201);

    const results = await request(functional.app.getHttpServer()).get(`/api/clinical-decisions/visits/${fixture.visit.id}/results`).set(bearer(fixture.doctorToken)).expect(200);
    expect(JSON.stringify(unwrap(results.body))).toContain(order.id);
    await expect(functional.prisma.visit.findUniqueOrThrow({ where: { id: fixture.visit.id } }))
      .resolves.toMatchObject({ status: VisitStatus.WAITING_CONCLUSION });
  });

  it('[TC8.05] lets the responsible Doctor create a MedicalConclusion, completes the Visit, and records audit evidence', async () => {
    const fixture = await createClinicalFixture('805');
    const order = await createOrder(fixture);
    await request(functional.app.getHttpServer())
      .post(`/api/medical-orders/${order.id}/results`)
      .set(bearer(fixture.labToken))
      .send({ files: privatePdfMetadata() })
      .expect(201);

    const response = await request(functional.app.getHttpServer())
      .post('/api/clinical-decisions/conclusions')
      .set(bearer(fixture.doctorToken))
      .send({ visitId: fixture.visit.id, finalDiagnosis: 'Theo doi tim mach', treatmentPlan: 'Tai kham sau bay ngay' })
      .expect(201);
    const conclusion = unwrap<{ id: string }>(response.body);

    await expect(functional.prisma.medicalConclusion.findUniqueOrThrow({ where: { id: conclusion.id } }))
      .resolves.toMatchObject({ visitId: fixture.visit.id, doctorId: fixture.doctor.id, finalDiagnosis: 'Theo doi tim mach' });
    await expect(functional.prisma.visit.findUniqueOrThrow({ where: { id: fixture.visit.id } }))
      .resolves.toMatchObject({ status: VisitStatus.COMPLETED, staffId: fixture.doctor.staffId });
    await expect(functional.prisma.blockchainLogger.findFirst({
      where: { entity: 'MedicalConclusion', entityId: conclusion.id, action: 'CREATE' },
    })).resolves.not.toBeNull();
  });

  it('[TC8.09] returns visit history and results only for a PatientAccess-authorized profile', async () => {
    const fixture = await createClinicalFixture('809');
    const order = await createOrder(fixture);
    await request(functional.app.getHttpServer()).post(`/api/medical-orders/${order.id}/results`).set(bearer(fixture.labToken)).send({ note: 'Ket qua duoc cap quyen', files: privatePdfMetadata() }).expect(201);
    const patientUser = await functional.prisma.user.create({ data: { username: 'patient-history-809', email: 'patient-history-809@test.local', role: UserRole.PATIENT, status: 'ACTIVE', firstLogin: false } });
    await functional.prisma.patientAccess.create({ data: { userId: patientUser.id, patientId: fixture.visit.patientId, relationship: 'SELF', status: 'ACTIVE', canViewProfile: true, canViewVisits: true, canViewResults: true } });
    const patientToken = functional.tokenFor({ id: patientUser.id, role: UserRole.PATIENT, tokenVersion: patientUser.tokenVersion });

    const visits = unwrap<Array<{ id: string }>>((await request(functional.app.getHttpServer()).get(`/api/patient/me/profiles/${fixture.visit.patientId}/visits`).set(bearer(patientToken)).expect(200)).body);
    expect(visits).toEqual([expect.objectContaining({ id: fixture.visit.id })]);
    const detail = unwrap<{ id: string; orders: Array<{ id: string; results: Array<{ note: string }> }> }>((await request(functional.app.getHttpServer()).get(`/api/patient/me/profiles/${fixture.visit.patientId}/visits/${fixture.visit.id}`).set(bearer(patientToken)).expect(200)).body);
    expect(detail).toMatchObject({ id: fixture.visit.id, orders: [expect.objectContaining({ id: order.id, results: [expect.objectContaining({ note: 'Ket qua duoc cap quyen' })] })] });
  });

  it('[TC8.10] denies history outside PatientAccess without returning the visit or result', async () => {
    const fixture = await createClinicalFixture('810');
    const order = await createOrder(fixture);
    await request(functional.app.getHttpServer()).post(`/api/medical-orders/${order.id}/results`).set(bearer(fixture.labToken)).send({ note: 'Ket qua rieng tu', files: privatePdfMetadata() }).expect(201);
    const outsider = await functional.prisma.user.create({ data: { username: 'patient-history-810x', email: 'patient-history-810x@test.local', role: UserRole.PATIENT, status: 'ACTIVE', firstLogin: false } });
    const outsiderToken = functional.tokenFor({ id: outsider.id, role: UserRole.PATIENT, tokenVersion: outsider.tokenVersion });

    const listResponse = await request(functional.app.getHttpServer()).get(`/api/patient/me/profiles/${fixture.visit.patientId}/visits`).set(bearer(outsiderToken)).expect(404);
    const detailResponse = await request(functional.app.getHttpServer()).get(`/api/patient/me/profiles/${fixture.visit.patientId}/visits/${fixture.visit.id}`).set(bearer(outsiderToken)).expect(404);
    expect(JSON.stringify(listResponse.body)).not.toContain('Ket qua rieng tu');
    expect(JSON.stringify(detailResponse.body)).not.toContain(order.id);
  });

  it('[TC8.01] creates a source-backed AI suggestion through the real provider gateway with correct relations', async () => {
    const fixture = await createClinicalFixture('801');
    await functional.prisma.visit.update({ where: { id: fixture.visit.id }, data: { status: VisitStatus.WAITING_CONCLUSION } });
    const http = await import('node:http');
    const provider = http.createServer((_incoming, response) => {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ diagnosis: 'Theo doi tim mach', confidence: 0.91 }) } }] }));
    });
    await new Promise<void>((resolve) => provider.listen(0, '127.0.0.1', resolve));
    const address = provider.address();
    if (!address || typeof address === 'string') throw new Error('Local clinical AI test server failed to bind.');

    try {
      const model = unwrap<{ id: string }>((await request(functional.app.getHttpServer())
        .post('/api/ai-models')
        .set(bearer(adminToken))
        .send({ modelName: 'Clinical Decision 801', modelVersion: 'v801', recommendedSpecialty: 'Tim mach', type: 'API', provider: 'local', apiEndpoint: `http://127.0.0.1:${address.port}/analysis`, secretOrIpHash: 'functional-ai-token' })
        .expect(201)).body);
      const response = await request(functional.app.getHttpServer()).post('/api/clinical-decisions/ai-analysis').set(bearer(fixture.doctorToken)).send({ visitId: fixture.visit.id, aiModelId: model.id }).expect(201);
      const diagnosis = unwrap<{ id: string; result: string; confidence: number; status: string }>(response.body);
      expect(JSON.parse(diagnosis.result)).toMatchObject({ source: 'REAL_AI_MODEL', isMock: false, analysis: expect.objectContaining({ diagnosis: 'Theo doi tim mach' }) });
      expect(diagnosis).toMatchObject({ confidence: 0.91, status: 'AI_SUGGESTED' });
      await expect(functional.prisma.aiDiagnosis.findUniqueOrThrow({ where: { id: diagnosis.id } })).resolves.toMatchObject({ aiModelId: model.id, patientId: fixture.visit.patientId, visitId: fixture.visit.id });
      await expect(functional.prisma.blockchainLogger.findFirst({ where: { entity: 'AiDiagnosis', entityId: diagnosis.id, action: 'CREATE' } })).resolves.not.toBeNull();
      await expect(functional.prisma.visit.findUniqueOrThrow({ where: { id: fixture.visit.id } })).resolves.toMatchObject({ status: VisitStatus.WAITING_CONCLUSION });
    } finally {
      await new Promise<void>((resolve, reject) => provider.close((error) => error ? reject(error) : resolve()));
    }
  });

  it('[TC8.02] keeps a Visit awaiting conclusion when it has an AI suggestion but no Doctor conclusion', async () => {
    const fixture = await createClinicalFixture('802');
    await functional.prisma.visit.update({ where: { id: fixture.visit.id }, data: { status: VisitStatus.WAITING_CONCLUSION } });
    const model = await functional.prisma.aiModelRegistry.create({ data: { modelName: 'Decision Model 802', modelVersion: 'v802', ipHashEncrypted: 'encrypted', createdBy: fixture.doctor.userId } });
    await functional.prisma.aiDiagnosis.create({ data: { aiModelId: model.id, patientId: fixture.visit.patientId, visitId: fixture.visit.id, result: 'AI suggestion only', status: 'AI_SUGGESTED' } });

    await expect(functional.prisma.visit.findUniqueOrThrow({ where: { id: fixture.visit.id } })).resolves.toMatchObject({ status: VisitStatus.WAITING_CONCLUSION });
    await expect(functional.prisma.medicalConclusion.count({ where: { visitId: fixture.visit.id } })).resolves.toBe(0);
  });

  it('[TC8.03] lets the responsible Doctor review an AI diagnosis and stores reviewer feedback without finalizing the Visit', async () => {
    const fixture = await createClinicalFixture('803');
    await functional.prisma.visit.update({ where: { id: fixture.visit.id }, data: { status: VisitStatus.WAITING_CONCLUSION } });
    const model = await functional.prisma.aiModelRegistry.create({ data: { modelName: 'Decision Model 803', modelVersion: 'v803', ipHashEncrypted: 'encrypted', createdBy: fixture.doctor.userId } });
    const diagnosis = await functional.prisma.aiDiagnosis.create({ data: { aiModelId: model.id, patientId: fixture.visit.patientId, visitId: fixture.visit.id, result: 'AI suggestion', status: 'AI_SUGGESTED' } });

    await request(functional.app.getHttpServer()).patch(`/api/clinical-decisions/ai-diagnoses/${diagnosis.id}/review`).set(bearer(fixture.doctorToken)).send({ doctorFeedback: 'Phu hop lam sang' }).expect(200);

    await expect(functional.prisma.aiDiagnosis.findUniqueOrThrow({ where: { id: diagnosis.id } })).resolves.toMatchObject({ status: 'DOCTOR_REVIEWED', reviewedByDoctorId: fixture.doctor.id, doctorFeedback: 'Phu hop lam sang' });
    await expect(functional.prisma.visit.findUniqueOrThrow({ where: { id: fixture.visit.id } })).resolves.toMatchObject({ status: VisitStatus.WAITING_CONCLUSION });
  });

  it('[TC8.04] refuses a Doctor review of an AI diagnosis from another department and leaves it unchanged', async () => {
    const owner = await createClinicalFixture('804');
    await functional.prisma.visit.update({ where: { id: owner.visit.id }, data: { status: VisitStatus.WAITING_CONCLUSION } });
    const model = await functional.prisma.aiModelRegistry.create({ data: { modelName: 'Decision Model 804', modelVersion: 'v804', ipHashEncrypted: 'encrypted', createdBy: owner.doctor.userId } });
    const diagnosis = await functional.prisma.aiDiagnosis.create({ data: { aiModelId: model.id, patientId: owner.visit.patientId, visitId: owner.visit.id, result: 'Private AI suggestion', status: 'AI_SUGGESTED' } });
    const otherDepartment = await functional.prisma.department.create({ data: { departmentCode: 'CLINIC-804X', name: 'Phong kham khac', type: DepartmentType.CLINICAL, status: 'ACTIVE' } });
    const otherDoctor = await functional.prisma.user.create({ data: { username: 'doctor-decision-804x', email: 'doctor-decision-804x@test.local', role: UserRole.DOCTOR, status: 'ACTIVE', firstLogin: false, staffProfile: { create: { employeeCode: 'BS-804X', fullName: 'Bac si khac', phone: '0948040001', gender: 'Nam', citizenId: '330000000804', birthDate: new Date('1980-01-01'), avatarUrl: 'test://other', departmentId: otherDepartment.id, doctorProfile: { create: { specialty: MedicalSpecialty.NEUROLOGY, licenseNumber: 'LIC-804X', qualification: 'MD' } } } } } });
    const otherToken = functional.tokenFor({ id: otherDoctor.id, role: UserRole.DOCTOR, tokenVersion: otherDoctor.tokenVersion });

    await request(functional.app.getHttpServer()).patch(`/api/clinical-decisions/ai-diagnoses/${diagnosis.id}/review`).set(bearer(otherToken)).send({ doctorFeedback: 'Khong duoc phep' }).expect(400);

    await expect(functional.prisma.aiDiagnosis.findUniqueOrThrow({ where: { id: diagnosis.id } })).resolves.toMatchObject({ status: 'AI_SUGGESTED', reviewedByDoctorId: null, doctorFeedback: null });
  });

  it('[TC8.06] refuses a conclusion while a medical order is still pending and does not complete the Visit', async () => {
    const fixture = await createClinicalFixture('806');
    await createOrder(fixture);

    await request(functional.app.getHttpServer()).post('/api/clinical-decisions/conclusions').set(bearer(fixture.doctorToken)).send({ visitId: fixture.visit.id, finalDiagnosis: 'Chua du dieu kien ket luan' }).expect(400);

    await expect(functional.prisma.medicalConclusion.count({ where: { visitId: fixture.visit.id } })).resolves.toBe(0);
    await expect(functional.prisma.visit.findUniqueOrThrow({ where: { id: fixture.visit.id } })).resolves.toMatchObject({ status: VisitStatus.WAITING_TEST_RESULT });
  });

  it('[TC8.08] rejects non-DOCTOR accounts from creating a conclusion or reviewing AI output', async () => {
    const fixture = await createClinicalFixture('808');
    await functional.prisma.visit.update({ where: { id: fixture.visit.id }, data: { status: VisitStatus.WAITING_CONCLUSION } });
    const model = await functional.prisma.aiModelRegistry.create({ data: { modelName: 'Decision Model 808', modelVersion: 'v808', ipHashEncrypted: 'encrypted', createdBy: fixture.doctor.userId } });
    const diagnosis = await functional.prisma.aiDiagnosis.create({ data: { aiModelId: model.id, patientId: fixture.visit.patientId, visitId: fixture.visit.id, result: 'AI suggestion', status: 'AI_SUGGESTED' } });

    await request(functional.app.getHttpServer()).post('/api/clinical-decisions/conclusions').set(bearer(adminToken)).send({ visitId: fixture.visit.id, finalDiagnosis: 'Admin khong duoc ket luan' }).expect(403);
    await request(functional.app.getHttpServer()).patch(`/api/clinical-decisions/ai-diagnoses/${diagnosis.id}/review`).set(bearer(adminToken)).send({ doctorFeedback: 'Admin khong duoc review' }).expect(403);

    await expect(functional.prisma.medicalConclusion.count({ where: { visitId: fixture.visit.id } })).resolves.toBe(0);
    await expect(functional.prisma.aiDiagnosis.findUniqueOrThrow({ where: { id: diagnosis.id } })).resolves.toMatchObject({ status: 'AI_SUGGESTED', reviewedByDoctorId: null });
  });

  it('[TC8.07] rejects a second conclusion and retains the original conclusion', async () => {
    const fixture = await createClinicalFixture('807');
    await functional.prisma.visit.update({ where: { id: fixture.visit.id }, data: { status: VisitStatus.WAITING_CONCLUSION } });

    await request(functional.app.getHttpServer()).post('/api/clinical-decisions/conclusions').set(bearer(fixture.doctorToken)).send({ visitId: fixture.visit.id, finalDiagnosis: 'Ket luan lan mot' }).expect(201);
    await request(functional.app.getHttpServer()).post('/api/clinical-decisions/conclusions').set(bearer(fixture.doctorToken)).send({ visitId: fixture.visit.id, finalDiagnosis: 'Ket luan lan hai' }).expect(400);

    await expect(functional.prisma.medicalConclusion.findUniqueOrThrow({ where: { visitId: fixture.visit.id } })).resolves.toMatchObject({ finalDiagnosis: 'Ket luan lan mot', doctorId: fixture.doctor.id });
  });
});
