/**
 * S10 — Workflow Audit Trail (end-to-end)
 *
 * Mục tiêu: xác nhận từng giai đoạn trong chu trình khám bệnh đều ghi
 * đúng audit log vào BlockchainLogger và KHÔNG xuất hiện cảnh báo
 * "SNAPSHOT_INCOMPLETE" / "Dữ liệu cần kiểm tra" trên trang Audit dashboard.
 *
 * Từng giai đoạn được kiểm tra độc lập (beforeEach reset DB) để:
 *   1. Xác nhận audit row tồn tại (entity + action + entityId).
 *   2. Xác nhận audit row có đủ trường (afterHash, afterEncrypted, fieldsChanged).
 *   3. Sau khi anchor, batch integrity KHÔNG báo "tampered" hay "missing".
 *
 * Quy tắc: KHÔNG sửa code production để cho test pass — logic seed ở đây
 * phải 1-1 với cách API thực tế xây dựng dữ liệu (không bypass use case).
 */
import request from 'supertest';
import {
  DepartmentType,
  MedicalOrderStatus,
  MedicalSpecialty,
  UserRole,
  VisitStatus,
} from '@prisma/client';
import { createFunctionalApp, FunctionalApp, unwrap } from './support/functional-app';
import { bearer, createAdminA, resetFunctionalDatabase } from './support/database-reset';

type Created = { id: string };

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixture helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Kiểm tra một audit row có đủ trường V2 bắt buộc không. */
function expectAuditRowComplete(row: Record<string, unknown> | null) {
  expect(row).not.toBeNull();
  // afterHash phải tồn tại và là hex string
  expect(typeof row!.afterHash).toBe('string');
  expect((row!.afterHash as string).length).toBeGreaterThan(0);
  // afterEncrypted phải tồn tại
  expect(row!.afterEncrypted).not.toBeNull();
  // fieldsChanged phải là array
  expect(Array.isArray(row!.fieldsChanged)).toBe(true);
}

function privatePdfMetadata() {
  return [
    {
      fileName: 'result-trail.pdf',
      originalName: 'result-trail.pdf',
      mimeType: 'application/pdf',
      size: 2048,
      storageProvider: 'S3',
      bucket: 'kltn-private-test',
      objectKey: 'results/result-trail.pdf',
      sha256: 'b'.repeat(64),
      etag: 'etag-trail-001',
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────────────────────

describe('S10 Workflow audit trail — mỗi giai đoạn phải ghi log đúng và đủ', () => {
  let functional: FunctionalApp;
  let adminToken: string;

  beforeAll(async () => {
    functional = await createFunctionalApp();
  });

  beforeEach(async () => {
    await resetFunctionalDatabase(functional.prisma);
    const admin = await createAdminA(functional.prisma);
    adminToken = functional.tokenFor({ id: admin.id, role: UserRole.ADMIN, tokenVersion: admin.tokenVersion });
  });

  afterAll(async () => {
    await functional.close();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Helper: tạo toàn bộ nhân vật cần thiết (lễ tân, bác sĩ, ktv)
  // ──────────────────────────────────────────────────────────────────────────
  async function buildWorkflowActors(suffix: string) {
    // Phòng khám (EXAMINATION) — nơi bác sĩ tiếp nhận bệnh nhân
    const examDept = await functional.prisma.department.create({
      data: {
        departmentCode: `S10-EXAM-${suffix}`,
        name: `Phong kham S10 ${suffix}`,
        type: DepartmentType.EXAMINATION,
        status: 'ACTIVE',
      },
    });

    // Phòng xét nghiệm (LABORATORY) — nơi KTV trả kết quả
    const labDept = await functional.prisma.department.create({
      data: {
        departmentCode: `S10-LAB-${suffix}`,
        name: `Xet nghiem S10 ${suffix}`,
        type: DepartmentType.LABORATORY,
        status: 'ACTIVE',
        canReceiveOrders: true,
      },
    });

    // Lễ tân
    const receptionistUser = await functional.prisma.user.create({
      data: {
        username: `s10-reception-${suffix}`,
        email: `s10-reception-${suffix}@test.local`,
        role: UserRole.RECEPTIONIST,
        status: 'ACTIVE',
        firstLogin: false,
      },
    });

    // Bác sĩ — cần staffProfile + doctorProfile
    const doctorUser = await functional.prisma.user.create({
      data: {
        username: `s10-doctor-${suffix}`,
        email: `s10-doctor-${suffix}@test.local`,
        role: UserRole.DOCTOR,
        status: 'ACTIVE',
        firstLogin: false,
        staffProfile: {
          create: {
            employeeCode: `BS-S10-${suffix}`,
            fullName: 'Bac Si S10',
            phone: `0912340${suffix}`,
            gender: 'Nam',
            citizenId: `31000000${suffix}`,
            birthDate: new Date('1985-03-15'),
            address: 'HCM',
            avatarUrl: 'test://doctor-s10',
            departmentId: examDept.id,
            position: 'Bac si chinh',
            doctorProfile: {
              create: {
                specialty: MedicalSpecialty.CARDIOLOGY,
                licenseNumber: `LIC-S10-${suffix}`,
                qualification: 'MD',
                yearsExperience: 10,
              },
            },
          },
        },
      },
      include: { staffProfile: { include: { doctorProfile: true } } },
    });

    // KTV xét nghiệm
    const labUser = await functional.prisma.user.create({
      data: {
        username: `s10-lab-${suffix}`,
        email: `s10-lab-${suffix}@test.local`,
        role: UserRole.LAB_MANAGER,
        status: 'ACTIVE',
        firstLogin: false,
        staffProfile: {
          create: {
            employeeCode: `LABM-S10-${suffix}`,
            fullName: 'Ky Thuat Vien S10',
            phone: `0922340${suffix}`,
            gender: 'Nu',
            citizenId: `32000000${suffix}`,
            birthDate: new Date('1990-06-20'),
            address: 'HCM',
            avatarUrl: 'test://lab-s10',
            departmentId: labDept.id,
            position: 'Truong khoa xet nghiem',
          },
        },
      },
    });

    return {
      examDept,
      labDept,
      receptionistToken: functional.tokenFor({
        id: receptionistUser.id,
        role: UserRole.RECEPTIONIST,
        tokenVersion: receptionistUser.tokenVersion,
      }),
      doctorToken: functional.tokenFor({
        id: doctorUser.id,
        role: UserRole.DOCTOR,
        tokenVersion: doctorUser.tokenVersion,
      }),
      labToken: functional.tokenFor({
        id: labUser.id,
        role: UserRole.LAB_MANAGER,
        tokenVersion: labUser.tokenVersion,
      }),
      doctorUserId: doctorUser.id,
      doctorStaffId: doctorUser.staffProfile!.id,
      doctorProfileId: doctorUser.staffProfile!.doctorProfile!.id,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GIAI ĐOẠN 1: Lễ tân tạo bệnh nhân + lượt khám
  // ──────────────────────────────────────────────────────────────────────────

  it('[S10.01] Lễ tân tạo bệnh nhân mới — ghi audit CREATE Patient đủ trường', async () => {
    const actors = await buildWorkflowActors('01');

    const response = await request(functional.app.getHttpServer())
      .post('/api/patients')
      .set(bearer(actors.receptionistToken))
      .send({
        fullName: 'Benh Nhan Mot',
        gender: 'MALE',
        birthDate: '1995-05-20',
        citizenId: '410000000101',
        phone: '0901000101',
        address: 'Dia chi thu nghiem',
        emergencyContact: '0907000101',
      })
      .expect(201);

    const patient = unwrap<Created>(response.body);
    const row = await functional.prisma.blockchainLogger.findFirst({
      where: { entity: 'Patient', entityId: patient.id, action: 'CREATE' },
    });

    expect(row).not.toBeNull();
    expectAuditRowComplete(row as Record<string, unknown>);
    expect(row!.onChainStatus).toBe('PENDING');
  });

  it('[S10.02] Lễ tân tạo lượt khám cho bệnh nhân có sẵn — ghi audit CREATE Visit đủ trường', async () => {
    const actors = await buildWorkflowActors('02');

    const patientResp = await request(functional.app.getHttpServer())
      .post('/api/patients')
      .set(bearer(actors.receptionistToken))
      .send({
        fullName: 'Benh Nhan Hai',
        gender: 'FEMALE',
        birthDate: '1998-08-08',
        citizenId: '410000000102',
        phone: '0901000102',
        address: 'Dia chi thu nghiem',
        emergencyContact: '0907000102',
      })
      .expect(201);
    const patient = unwrap<Created>(patientResp.body);

    const visitResp = await request(functional.app.getHttpServer())
      .post('/api/visits')
      .set(bearer(actors.receptionistToken))
      .send({ patientId: patient.id, departmentId: actors.examDept.id })
      .expect(201);
    const visit = unwrap<Created>(visitResp.body);

    const visitRow = await functional.prisma.blockchainLogger.findFirst({
      where: { entity: 'Visit', entityId: visit.id, action: 'CREATE' },
    });
    expect(visitRow).not.toBeNull();
    expectAuditRowComplete(visitRow as Record<string, unknown>);

    const storedVisit = await functional.prisma.visit.findUniqueOrThrow({ where: { id: visit.id } });
    expect(storedVisit.status).toBe(VisitStatus.WAITING);
    expect(storedVisit.patientId).toBe(patient.id);
  });

  it('[S10.03] Lễ tân quick intake (bệnh nhân + lượt khám cùng lúc) — ghi 2 audit row đủ trường', async () => {
    const actors = await buildWorkflowActors('03');

    const visitResp = await request(functional.app.getHttpServer())
      .post('/api/visits')
      .set(bearer(actors.receptionistToken))
      .send({
        patient: {
          fullName: 'Benh Nhan Ba',
          gender: 'MALE',
          birthDate: '2000-01-01',
          citizenId: '410000000103',
          phone: '0901000103',
          address: 'Dia chi thu nghiem',
          emergencyContact: '0907000103',
        },
        departmentId: actors.examDept.id,
      })
      .expect(201);
    const visit = unwrap<Created>(visitResp.body);

    const storedVisit = await functional.prisma.visit.findUniqueOrThrow({ where: { id: visit.id } });
    const patientId = storedVisit.patientId;

    const auditCount = await functional.prisma.blockchainLogger.count({
      where: { entityId: { in: [visit.id, patientId] }, action: 'CREATE' },
    });
    expect(auditCount).toBe(2);

    const rows = await functional.prisma.blockchainLogger.findMany({
      where: { entityId: { in: [visit.id, patientId] }, action: 'CREATE' },
    });
    for (const row of rows) {
      expectAuditRowComplete(row as Record<string, unknown>);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GIAI ĐOẠN 2: Bác sĩ bắt đầu lượt khám (WAITING → IN_PROGRESS)
  // ──────────────────────────────────────────────────────────────────────────

  it('[S10.04] Bác sĩ bắt đầu khám (WAITING → IN_PROGRESS) — ghi audit UPDATE Visit đủ trường', async () => {
    const actors = await buildWorkflowActors('04');

    const visitResp = await request(functional.app.getHttpServer())
      .post('/api/visits')
      .set(bearer(actors.receptionistToken))
      .send({
        patient: {
          fullName: 'Benh Nhan Bon',
          gender: 'MALE',
          birthDate: '1992-04-04',
          citizenId: '410000000104',
          phone: '0901000104',
          address: 'Dia chi thu nghiem',
          emergencyContact: '0907000104',
        },
        departmentId: actors.examDept.id,
      })
      .expect(201);
    const visit = unwrap<Created>(visitResp.body);

    // Bác sĩ bắt đầu khám — đây chính là action "Bắt đầu lượt khám" của UI
    await request(functional.app.getHttpServer())
      .patch(`/api/visits/${visit.id}/status`)
      .set(bearer(actors.doctorToken))
      .send({ status: VisitStatus.IN_PROGRESS })
      .expect(200);

    const row = await functional.prisma.blockchainLogger.findFirst({
      where: { entity: 'Visit', entityId: visit.id, action: 'UPDATE' },
    });
    expect(row).not.toBeNull();
    expectAuditRowComplete(row as Record<string, unknown>);

    // Visit phải ở IN_PROGRESS
    const storedVisit = await functional.prisma.visit.findUniqueOrThrow({ where: { id: visit.id } });
    expect(storedVisit.status).toBe(VisitStatus.IN_PROGRESS);
    // Bác sĩ phải được gắn vào visit
    expect(storedVisit.staffId).toBe(actors.doctorStaffId);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GIAI ĐOẠN 3: Bác sĩ gửi chỉ định cận lâm sàng cho KTV
  // ──────────────────────────────────────────────────────────────────────────

  it('[S10.05] Bác sĩ gửi chỉ định cho KTV — ghi audit CREATE MedicalOrder và UPDATE Visit đủ trường', async () => {
    const actors = await buildWorkflowActors('05');

    const visitResp = await request(functional.app.getHttpServer())
      .post('/api/visits')
      .set(bearer(actors.receptionistToken))
      .send({
        patient: {
          fullName: 'Benh Nhan Nam',
          gender: 'FEMALE',
          birthDate: '1993-05-05',
          citizenId: '410000000105',
          phone: '0901000105',
          address: 'Dia chi thu nghiem',
          emergencyContact: '0907000105',
        },
        departmentId: actors.examDept.id,
      })
      .expect(201);
    const visit = unwrap<Created>(visitResp.body);

    await request(functional.app.getHttpServer())
      .patch(`/api/visits/${visit.id}/status`)
      .set(bearer(actors.doctorToken))
      .send({ status: VisitStatus.IN_PROGRESS })
      .expect(200);

    const orderResp = await request(functional.app.getHttpServer())
      .post('/api/medical-orders')
      .set(bearer(actors.doctorToken))
      .send({
        visitId: visit.id,
        targetDepartmentId: actors.labDept.id,
        orderType: 'Xet nghiem mau toan bo',
        priority: 'URGENT',
        clinicalNote: 'Kiem tra chi so huyet hoc',
      })
      .expect(201);
    const order = unwrap<Created>(orderResp.body);

    // Audit MedicalOrder CREATE
    const orderRow = await functional.prisma.blockchainLogger.findFirst({
      where: { entity: 'MedicalOrder', entityId: order.id, action: 'CREATE' },
    });
    expect(orderRow).not.toBeNull();
    expectAuditRowComplete(orderRow as Record<string, unknown>);

    // Audit Visit UPDATE (đã transition ít nhất 1 lần)
    const visitUpdateRows = await functional.prisma.blockchainLogger.findMany({
      where: { entity: 'Visit', entityId: visit.id, action: 'UPDATE' },
    });
    expect(visitUpdateRows.length).toBeGreaterThanOrEqual(1);
    for (const row of visitUpdateRows) {
      expectAuditRowComplete(row as Record<string, unknown>);
    }

    // Trạng thái cuối
    await expect(functional.prisma.visit.findUniqueOrThrow({ where: { id: visit.id } }))
      .resolves.toMatchObject({ status: VisitStatus.WAITING_TEST_RESULT });
    await expect(functional.prisma.medicalOrder.findUniqueOrThrow({ where: { id: order.id } }))
      .resolves.toMatchObject({ status: MedicalOrderStatus.ORDERED });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GIAI ĐOẠN 4: KTV trả kết quả về cho bác sĩ
  // ──────────────────────────────────────────────────────────────────────────

  it('[S10.06] KTV trả kết quả — ghi audit CREATE MedicalResult, UPDATE MedicalOrder, UPDATE Visit đủ trường', async () => {
    const actors = await buildWorkflowActors('06');

    const visitResp = await request(functional.app.getHttpServer())
      .post('/api/visits')
      .set(bearer(actors.receptionistToken))
      .send({
        patient: {
          fullName: 'Benh Nhan Sau',
          gender: 'MALE',
          birthDate: '1994-06-06',
          citizenId: '410000000106',
          phone: '0901000106',
          address: 'Dia chi thu nghiem',
          emergencyContact: '0907000106',
        },
        departmentId: actors.examDept.id,
      })
      .expect(201);
    const visit = unwrap<Created>(visitResp.body);

    await request(functional.app.getHttpServer())
      .patch(`/api/visits/${visit.id}/status`)
      .set(bearer(actors.doctorToken))
      .send({ status: VisitStatus.IN_PROGRESS })
      .expect(200);

    const orderResp = await request(functional.app.getHttpServer())
      .post('/api/medical-orders')
      .set(bearer(actors.doctorToken))
      .send({
        visitId: visit.id,
        targetDepartmentId: actors.labDept.id,
        orderType: 'Xet nghiem sinh hoa',
        priority: 'NORMAL',
      })
      .expect(201);
    const order = unwrap<Created>(orderResp.body);

    // KTV "Tiếp nhận phiếu" (PATCH status ORDERED → IN_PROGRESS) — đúng flow UI/UX.
    // Mọi thay đổi DB phải được ghi audit trong cùng transaction.
    await request(functional.app.getHttpServer())
      .patch(`/api/medical-orders/${order.id}/status`)
      .set(bearer(actors.labToken))
      .send({ status: MedicalOrderStatus.IN_PROGRESS })
      .expect(200);

    // Audit MedicalOrder UPDATE cho transition "Tiếp nhận phiếu" phải tồn tại và đủ trường
    const acceptUpdateRow = await functional.prisma.blockchainLogger.findFirst({
      where: {
        entity: 'MedicalOrder',
        entityId: order.id,
        action: 'UPDATE',
        metadata: { path: ['schema'], equals: 'KLTN_MEDICAL_ORDER_STATUS_AUDIT_V2' },
      },
      orderBy: { seq: 'desc' },
    });
    expect(acceptUpdateRow).not.toBeNull();
    expectAuditRowComplete(acceptUpdateRow as Record<string, unknown>);
    // after snapshot phải chứa đủ trường REQUIRED_SNAPSHOT_FIELDS.MedicalOrder
    const acceptAfter = (acceptUpdateRow as Record<string, unknown>).afterJson as Record<string, unknown>;
    expect(acceptAfter).toMatchObject({ status: MedicalOrderStatus.IN_PROGRESS });

    // KTV trả kết quả
    await request(functional.app.getHttpServer())
      .post(`/api/medical-orders/${order.id}/results`)
      .set(bearer(actors.labToken))
      .send({ note: 'Ket qua binh thuong', files: privatePdfMetadata() })
      .expect(201);

    const result = await functional.prisma.medicalResult.findFirstOrThrow({ where: { orderId: order.id } });

    // Audit MedicalResult CREATE
    const resultRow = await functional.prisma.blockchainLogger.findFirst({
      where: { entity: 'MedicalResult', entityId: result.id, action: 'CREATE' },
    });
    expect(resultRow).not.toBeNull();
    expectAuditRowComplete(resultRow as Record<string, unknown>);

    // Audit MedicalOrder UPDATE
    const orderUpdateRow = await functional.prisma.blockchainLogger.findFirst({
      where: { entity: 'MedicalOrder', entityId: order.id, action: 'UPDATE' },
    });
    expect(orderUpdateRow).not.toBeNull();
    expectAuditRowComplete(orderUpdateRow as Record<string, unknown>);

    // Audit Visit UPDATE (phải có ít nhất cho WAITING_TEST_RESULT và WAITING_CONCLUSION)
    const visitRows = await functional.prisma.blockchainLogger.findMany({
      where: { entity: 'Visit', entityId: visit.id, action: 'UPDATE' },
      orderBy: { seq: 'asc' },
    });
    expect(visitRows.length).toBeGreaterThanOrEqual(2);
    for (const row of visitRows) {
      expectAuditRowComplete(row as Record<string, unknown>);
    }

    // Trạng thái cuối
    await expect(functional.prisma.medicalOrder.findUniqueOrThrow({ where: { id: order.id } }))
      .resolves.toMatchObject({ status: MedicalOrderStatus.RESULT_READY });
    await expect(functional.prisma.visit.findUniqueOrThrow({ where: { id: visit.id } }))
      .resolves.toMatchObject({ status: VisitStatus.WAITING_CONCLUSION });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GIAI ĐOẠN 5: Bác sĩ dùng AI phân tích
  // ──────────────────────────────────────────────────────────────────────────

  it('[S10.07] Bác sĩ tạo phân tích AI — ghi audit CREATE AiDiagnosis đủ trường', async () => {
    const actors = await buildWorkflowActors('07');

    const visitResp = await request(functional.app.getHttpServer())
      .post('/api/visits')
      .set(bearer(actors.receptionistToken))
      .send({
        patient: {
          fullName: 'Benh Nhan Bay',
          gender: 'FEMALE',
          birthDate: '1996-07-07',
          citizenId: '410000000107',
          phone: '0901000107',
          address: 'Dia chi thu nghiem',
          emergencyContact: '0907000107',
        },
        departmentId: actors.examDept.id,
      })
      .expect(201);
    const visit = unwrap<Created>(visitResp.body);

    await request(functional.app.getHttpServer())
      .patch(`/api/visits/${visit.id}/status`)
      .set(bearer(actors.doctorToken))
      .send({ status: VisitStatus.IN_PROGRESS })
      .expect(200);

    const orderResp = await request(functional.app.getHttpServer())
      .post('/api/medical-orders')
      .set(bearer(actors.doctorToken))
      .send({ visitId: visit.id, targetDepartmentId: actors.labDept.id, orderType: 'Xet nghiem nuoc tieu', priority: 'NORMAL' })
      .expect(201);
    const order = unwrap<Created>(orderResp.body);

    await request(functional.app.getHttpServer())
      .post(`/api/medical-orders/${order.id}/results`)
      .set(bearer(actors.labToken))
      .send({ note: 'Binh thuong', files: privatePdfMetadata() })
      .expect(201);

    // Tạo AI server giả (local mock)
    const http = await import('node:http');
    const aiServer = http.createServer((_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({ diagnosis: 'Khong co benh ly dac biet', confidence: 0.87 }),
          },
        }],
      }));
    });
    await new Promise<void>((resolve) => aiServer.listen(0, '127.0.0.1', resolve));
    const address = aiServer.address() as { port: number };

    try {
      const modelResp = await request(functional.app.getHttpServer())
        .post('/api/ai-models')
        .set(bearer(adminToken))
        .send({
          modelName: 'AI Model S10-07',
          modelVersion: 'v1007',
          recommendedSpecialty: 'Noi khoa',
          type: 'API',
          provider: 'local',
          apiEndpoint: `http://127.0.0.1:${address.port}/analysis`,
          secretOrIpHash: 'ai-token-s10-07',
        })
        .expect(201);
      const model = unwrap<{ id: string }>(modelResp.body);

      const diagnosisResp = await request(functional.app.getHttpServer())
        .post('/api/clinical-decisions/ai-analysis')
        .set(bearer(actors.doctorToken))
        .send({ visitId: visit.id, aiModelId: model.id })
        .expect(201);
      const diagnosis = unwrap<{ id: string }>(diagnosisResp.body);

      const aiRow = await functional.prisma.blockchainLogger.findFirst({
        where: { entity: 'AiDiagnosis', entityId: diagnosis.id, action: 'CREATE' },
      });
      expect(aiRow).not.toBeNull();
      expectAuditRowComplete(aiRow as Record<string, unknown>);
    } finally {
      await new Promise<void>((resolve, reject) =>
        aiServer.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GIAI ĐOẠN 6: Bác sĩ kết luận — hoàn tất lượt khám
  // ──────────────────────────────────────────────────────────────────────────

  it('[S10.08] Bác sĩ kết luận và hoàn tất lượt khám — ghi audit CREATE MedicalConclusion và UPDATE Visit đủ trường', async () => {
    const actors = await buildWorkflowActors('08');

    const visitResp = await request(functional.app.getHttpServer())
      .post('/api/visits')
      .set(bearer(actors.receptionistToken))
      .send({
        patient: {
          fullName: 'Benh Nhan Tam',
          gender: 'MALE',
          birthDate: '1997-08-08',
          citizenId: '410000000108',
          phone: '0901000108',
          address: 'Dia chi thu nghiem',
          emergencyContact: '0907000108',
        },
        departmentId: actors.examDept.id,
      })
      .expect(201);
    const visit = unwrap<Created>(visitResp.body);

    await request(functional.app.getHttpServer())
      .patch(`/api/visits/${visit.id}/status`)
      .set(bearer(actors.doctorToken))
      .send({ status: VisitStatus.IN_PROGRESS })
      .expect(200);

    const orderResp = await request(functional.app.getHttpServer())
      .post('/api/medical-orders')
      .set(bearer(actors.doctorToken))
      .send({ visitId: visit.id, targetDepartmentId: actors.labDept.id, orderType: 'Sieu am tim', priority: 'NORMAL' })
      .expect(201);
    const order = unwrap<Created>(orderResp.body);

    await request(functional.app.getHttpServer())
      .post(`/api/medical-orders/${order.id}/results`)
      .set(bearer(actors.labToken))
      .send({ note: 'Tim binh thuong', files: privatePdfMetadata() })
      .expect(201);

    const conclusionResp = await request(functional.app.getHttpServer())
      .post('/api/clinical-decisions/conclusions')
      .set(bearer(actors.doctorToken))
      .send({
        visitId: visit.id,
        finalDiagnosis: 'Suc khoe on dinh, khong co benh ly tim mach dac biet',
        treatmentPlan: 'Tai kham sau 6 thang, duy tri che do sinh hoat lanh manh',
      })
      .expect(201);
    const conclusion = unwrap<{ id: string }>(conclusionResp.body);

    // Audit MedicalConclusion CREATE
    const conclusionRow = await functional.prisma.blockchainLogger.findFirst({
      where: { entity: 'MedicalConclusion', entityId: conclusion.id, action: 'CREATE' },
    });
    expect(conclusionRow).not.toBeNull();
    expectAuditRowComplete(conclusionRow as Record<string, unknown>);

    // Visit phải COMPLETED
    await expect(functional.prisma.visit.findUniqueOrThrow({ where: { id: visit.id } }))
      .resolves.toMatchObject({ status: VisitStatus.COMPLETED });

    // Tất cả Visit UPDATE rows đều phải đủ trường
    const visitRows = await functional.prisma.blockchainLogger.findMany({
      where: { entity: 'Visit', entityId: visit.id, action: 'UPDATE' },
      orderBy: { seq: 'asc' },
    });
    expect(visitRows.length).toBeGreaterThanOrEqual(1);
    for (const row of visitRows) {
      expectAuditRowComplete(row as Record<string, unknown>);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Full e2e + anchor + kiểm tra batch integrity (không TAMPERED)
  // ──────────────────────────────────────────────────────────────────────────

  it('[S10.09] Full workflow + anchor — batch integrity KHÔNG có tampered hay SNAPSHOT_INCOMPLETE', async () => {
    const actors = await buildWorkflowActors('09');

    const visitResp = await request(functional.app.getHttpServer())
      .post('/api/visits')
      .set(bearer(actors.receptionistToken))
      .send({
        patient: {
          fullName: 'Benh Nhan Chin',
          gender: 'FEMALE',
          birthDate: '1991-09-09',
          citizenId: '410000000109',
          phone: '0901000109',
          address: 'Dia chi thu nghiem',
          emergencyContact: '0907000109',
        },
        departmentId: actors.examDept.id,
      })
      .expect(201);
    const visit = unwrap<Created>(visitResp.body);

    await request(functional.app.getHttpServer())
      .patch(`/api/visits/${visit.id}/status`)
      .set(bearer(actors.doctorToken))
      .send({ status: VisitStatus.IN_PROGRESS })
      .expect(200);

    const orderResp = await request(functional.app.getHttpServer())
      .post('/api/medical-orders')
      .set(bearer(actors.doctorToken))
      .send({ visitId: visit.id, targetDepartmentId: actors.labDept.id, orderType: 'Xet nghiem mau tong quat', priority: 'URGENT' })
      .expect(201);
    const order = unwrap<Created>(orderResp.body);

    // KTV "Tiếp nhận phiếu" (PATCH status ORDERED → IN_PROGRESS) — đúng flow UI/UX
    await request(functional.app.getHttpServer())
      .patch(`/api/medical-orders/${order.id}/status`)
      .set(bearer(actors.labToken))
      .send({ status: MedicalOrderStatus.IN_PROGRESS })
      .expect(200);

    await request(functional.app.getHttpServer())
      .post(`/api/medical-orders/${order.id}/results`)
      .set(bearer(actors.labToken))
      .send({ note: 'Ket qua day du', files: privatePdfMetadata() })
      .expect(201);

    await request(functional.app.getHttpServer())
      .post('/api/clinical-decisions/conclusions')
      .set(bearer(actors.doctorToken))
      .send({
        visitId: visit.id,
        finalDiagnosis: 'Benh nhan khoe manh',
        treatmentPlan: 'Khong can dieu tri',
      })
      .expect(201);

    // MedicalConclusion là Tier-A event → nó tự anchor ngay sau khi tạo.
    // Vì vậy anchor-now có thể trả committed:false nếu không còn pending logs.
    const anchorResp = await request(functional.app.getHttpServer())
      .post('/api/audit/anchor-now')
      .set(bearer(adminToken))
      .expect(201);
    const anchored = unwrap<{ committed: boolean; batchId?: number; leafCount?: number; reason?: string }>(anchorResp.body);

    let batchId: number;
    if (anchored.committed) {
      batchId = anchored.batchId!;
      expect(anchored.leafCount).toBeGreaterThan(0);
    } else {
      // Chỉ chấp nhận 2 lý do hợp lệ (đã anchor hết / đang anchor dở do Tier-A):
      //  1. "Không có bản ghi nào cần neo." → conclusion đã anchor toàn bộ rồi
      //  2. "An incomplete batch must be resumed..." → conclusion đang anchor dở
      // Bất kỳ lý do nào khác (chain integrity failure...) đều là LỖI THẬT.
      expect(anchored.reason).toMatch(/Không có bản ghi nào cần neo|incomplete batch/);
      const latest = await functional.prisma.auditBatch.findFirst({
        where: { status: 'ANCHORED' },
        orderBy: { batchId: 'desc' },
        select: { batchId: true },
      });
      expect(latest).not.toBeNull();
      batchId = latest!.batchId;
    }

    // Kiểm tra batch integrity: tampered = 0
    const batchResp = await request(functional.app.getHttpServer())
      .get(`/api/audit/batches/${batchId}`)
      .set(bearer(adminToken))
      .expect(200);
    const batchDetail = unwrap<{
      batchId: number;
      integrity: { total: number; verified: number; tampered: number };
    }>(batchResp.body);

    expect(batchDetail.integrity.tampered).toBe(0);
    expect(batchDetail.integrity.verified).toBe(batchDetail.integrity.total);

    // Toàn bộ audit rows của workflow phải được anchor thành công (không bị lệch/thiếu)
    const result = await functional.prisma.medicalResult.findFirst({ where: { orderId: order.id } });
    const workflowEntityIds = [visit.id, order.id, ...(result ? [result.id] : [])];
    const anchoredRows = await functional.prisma.blockchainLogger.findMany({
      where: { entityId: { in: workflowEntityIds } },
    });
    expect(anchoredRows.length).toBeGreaterThan(0);
    expect(anchoredRows.every((row) => row.onChainStatus === 'ANCHORED')).toBe(true);

    // BẮT BUỘC: Gọi HTTP GET /api/audit/recovery/entities/warnings kiểm tra API báo KHÔNG CÓ LỖI / TAMPERED
    const warningsResp = await request(functional.app.getHttpServer())
      .get('/api/audit/recovery/entities/warnings')
      .set(bearer(adminToken))
      .expect(200);
    const warnings = unwrap<{ items: Array<{ entity: string; entityId: string; status: string }> }>(warningsResp.body);
    const workflowWarnings = warnings.items.filter((item) => workflowEntityIds.includes(item.entityId));
    expect(workflowWarnings).toHaveLength(0);

    // Không được có bản ghi khôi phục nào được tạo ra (dữ liệu hoàn toàn toàn vẹn)
    await expect(functional.prisma.auditRecovery.count()).resolves.toBe(0);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // S10.10: Tamper detection — giả lập kẻ tấn công sửa thẳng DB rồi kiểm tra
  //         hệ thống PHÁT HIỆN và CHẶN sửa/xóa qua API (không chỉ happy path)
  // ──────────────────────────────────────────────────────────────────────────

  it('[S10.10] Giả lập tấn công sửa thẳng DB — warnings báo TAMPERED + PATCH patient bị chặn 409 ENTITY_INTEGRITY_WARNING', async () => {
    const actors = await buildWorkflowActors('10');

    // 1. Tạo patient qua API thật (lễ tân) → ghi audit CREATE Patient
    const patientResp = await request(functional.app.getHttpServer())
      .post('/api/patients')
      .set(bearer(actors.receptionistToken))
      .send({
        fullName: 'Benh Nhan Muoi',
        gender: 'MALE',
        birthDate: '1993-10-10',
        citizenId: '410000000110',
        phone: '0901000110',
        address: 'Dia chi thu nghiem',
        emergencyContact: '0907000110',
      })
      .expect(201);
    const patient = unwrap<Created>(patientResp.body);

    // 2. Anchor để có bằng chứng blockchain xác nhận snapshot ban đầu
    const anchorResp = await request(functional.app.getHttpServer())
      .post('/api/audit/anchor-now')
      .set(bearer(adminToken))
      .expect(201);
    const anchored = unwrap<{ committed: boolean; batchId?: number; reason?: string }>(anchorResp.body);
    expect(anchored.committed).toBe(true);
    expect(anchored.batchId).toBeDefined();

    // 3. Kẻ tấn công: sửa TRỰC TIẾP DB (bỏ qua API/audit) — giống hư hỏng thực tế
    await functional.prisma.patient.update({
      where: { id: patient.id },
      data: { fullName: 'Hacker Modified Patient' },
    });

    // 4. Hệ thống phải PHÁT HIỆN: warnings endpoint báo TAMPERED
    const warningsResp = await request(functional.app.getHttpServer())
      .get('/api/audit/recovery/entities/warnings')
      .set(bearer(adminToken))
      .expect(200);
    const warnings = unwrap<{ items: Array<{
      entity: string;
      entityId: string;
      status: string;
      recoverable: boolean;
      fieldsChanged: string[];
      recoveryMode: string;
    }> }>(warningsResp.body);

    const patientWarning = warnings.items.find((item) => item.entity === 'Patient' && item.entityId === patient.id);
    expect(patientWarning).toBeDefined();
    expect(patientWarning!.status).toBe('TAMPERED');
    expect(patientWarning!.recoverable).toBe(true);
    // safeFieldNames che tên trường PII (fullName...) thành SENSITIVE_FIELD_CHANGED
    expect(patientWarning!.fieldsChanged).toContain('SENSITIVE_FIELD_CHANGED');
    expect(patientWarning!.recoveryMode).toBe('DIRECT_ENTITY');

    // 5. Hệ thống phải CHẶN thao tác sửa qua API (PATCH patient) với mã lỗi rõ ràng
    //    Lưu ý: GlobalExceptionFilter chỉ expose success/statusCode/code/message/path/timestamp
    //    (chi tiết entity/fieldsChanged/recoveryMode KHÔNG được lộ ra ngoài).
    const blockedResp = await request(functional.app.getHttpServer())
      .patch(`/api/patients/${patient.id}`)
      .set(bearer(actors.receptionistToken))
      .send({
        fullName: 'Ten Hop Le Khac',
        gender: 'MALE',
        birthDate: '1993-10-10',
        citizenId: '410000000110',
        phone: '0901000110',
        address: 'Dia chi thu nghiem',
        emergencyContact: '0907000110',
      })
      .expect(409);
    const blocked = blockedResp.body as {
      success?: boolean;
      statusCode?: number;
      code?: string;
      message?: string;
      path?: string;
    };
    expect(blocked.success).toBe(false);
    expect(blocked.statusCode).toBe(409);
    expect(blocked.code).toBe('ENTITY_INTEGRITY_WARNING');
    expect(blocked.message).toContain('không khớp bản audit');
    expect(blocked.path).toBe(`/api/patients/${patient.id}`);

    // 6. Dữ liệu trong DB KHÔNG được thay đổi bởi lệnh sửa bị chặn
    const after = await functional.prisma.patient.findUniqueOrThrow({ where: { id: patient.id } });
    expect(after.fullName).toBe('Hacker Modified Patient');
  });
});
