import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../src/infrastructure/prisma/prisma.service';
import { BlockchainService } from '../../../src/infrastructure/blockchain/blockchain.service';
import { AuditAnchorService } from '../../../src/infrastructure/audit/audit-anchor.service';
import { AuditArtifactService } from '../../../src/infrastructure/audit/audit-artifact.service';
import { AuditLoggerService } from '../../../src/infrastructure/audit/audit-logger.service';
import { AuditRecoveryService } from '../../../src/infrastructure/audit/audit-recovery.service';
import { AuditRecoveryCryptoService } from '../../../src/infrastructure/audit/audit-recovery-crypto.service';
import { EntityRecoveryService } from '../../../src/infrastructure/audit/entity-recovery.service';
import { EntityRecreationService } from '../../../src/infrastructure/audit/entity-recreation.service';
import { IpfsArtifactService } from '../../../src/infrastructure/audit/ipfs-artifact.service';
import { buildPatientSnapshot } from '../../../src/modules/patient/domain/patient-snapshot';
import { buildAiDiagnosisSnapshot } from '../../../src/modules/clinical-decision/domain/ai-diagnosis-snapshot';
import { buildStaffSnapshot } from '../../../src/modules/staff/domain/staff-snapshot';
import { buildMedicalOrderSnapshot } from '../../../src/modules/medical-order/domain/medical-order-snapshot';
import { buildMedicalResultSnapshot } from '../../../src/modules/medical-order/domain/medical-result-snapshot';
import { buildAppointmentSnapshot } from '../../../src/modules/patient-portal/domain/appointment-snapshot';
import { buildAiQualitySnapshot } from '../../../src/modules/ai-model/domain/ai-quality-snapshot';
import { buildVisitSnapshot } from '../../../src/modules/visit/domain/visit-snapshot';
import { buildMedicalConclusionSnapshot } from '../../../src/modules/clinical-decision/domain/medical-conclusion-snapshot';
import { AdministrativeLifecycleService } from '../../../src/common/lifecycle/administrative-lifecycle.service';
import * as crypto from 'crypto';

const enabled = process.env.RUN_TAMPER_RECOVERY_E2E === 'true';
const describeIntegration = enabled ? describe : describe.skip;

describeIntegration('Audit tamper and recovery integration', () => {
  let prisma: PrismaService;
  let blockchain: BlockchainService;
  let artifacts: AuditArtifactService;
  let anchor: AuditAnchorService;
  let audit: AuditLoggerService;
  let entityRecovery: EntityRecoveryService;
  let batchRecovery: AuditRecoveryService;
  let lifecycle: AdministrativeLifecycleService;
  let ipfs: IpfsArtifactService;

  beforeAll(async () => {
    prisma = new PrismaService();
    blockchain = new BlockchainService();
    ipfs = new IpfsArtifactService();
    const recoveryCrypto = new AuditRecoveryCryptoService();
    artifacts = new AuditArtifactService(recoveryCrypto, ipfs);
    anchor = new AuditAnchorService(prisma, blockchain, artifacts);
    audit = new AuditLoggerService(prisma, anchor);
    batchRecovery = new AuditRecoveryService(prisma, blockchain, artifacts, anchor, audit);
    const entityRecreation = new EntityRecreationService(prisma, audit, batchRecovery);
    entityRecovery = new EntityRecoveryService(prisma, audit, anchor, entityRecreation);
    lifecycle = new AdministrativeLifecycleService(prisma, audit, entityRecovery);

    await prisma.onModuleInit();
    await blockchain.onModuleInit();
    anchor.onModuleInit();
    await waitForAppendOnlyTrigger();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "AuditRecovery",
        "BlockchainLogger",
        "AuditBatch",
        "Patient",
        "User"
      RESTART IDENTITY CASCADE
    `);
  });

  afterAll(async () => {
    anchor.onModuleDestroy();
    await prisma.onModuleDestroy();
  });

  it('blocks recovery when the latest Tier-B audit row is still pending', async () => {
    const fixture = await seedTrustedPatientChange();
    await tamperPatient(fixture.patientId);

    let response: Record<string, unknown> | undefined;
    try {
      await entityRecovery.assertTrusted('Patient', fixture.patientId);
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      response = (error as ConflictException).getResponse() as Record<string, unknown>;
    }

    expect(response).toMatchObject({
      code: 'ENTITY_INTEGRITY_WARNING',
      recoveryRequired: false,
      entity: 'Patient',
      entityId: fixture.patientId,
    });
    expect(await prisma.auditBatch.count()).toBe(0);
  });

  it('recovers only the selected entity from the latest blockchain-anchored snapshot', async () => {
    const fixture = await seedTrustedPatientChange();
    const anchored = await anchor.anchorNow();
    expect(anchored.committed).toBe(true);

    await tamperPatient(fixture.patientId);
    const warnings = await entityRecovery.listWarnings();
    expect(warnings.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity: 'Patient',
          entityId: fixture.patientId,
          status: 'TAMPERED',
          recoverable: true,
          sensitiveDataHidden: true,
        }),
      ]),
    );

    const result = await entityRecovery.recoverMany(
      [{ entity: 'Patient', entityId: fixture.patientId }],
      fixture.adminId,
      'Tamper recovery integration test',
    );
    expect(result).toMatchObject({ requested: 1, recovered: 1, failed: 0 });
    expect(JSON.stringify(result)).not.toContain('Hacker Modified Patient');
    expect(JSON.stringify(result)).not.toContain(fixture.trustedName);

    const restored = await prisma.patient.findUniqueOrThrow({ where: { id: fixture.patientId } });
    expect(restored.fullName).toBe(fixture.trustedName);
    expect(restored.phone).toBe(fixture.trustedPhone);
    expect(
      await prisma.blockchainLogger.count({
        where: { entity: 'Patient', entityId: fixture.patientId, action: 'AUDIT_ENTITY_RECOVERED' },
      }),
    ).toBe(1);
  });

  it('aborts anchoring when a pending audit content hash has been modified', async () => {
    const fixture = await seedTrustedPatientChange();
    const row = await prisma.blockchainLogger.findFirstOrThrow({
      where: { entity: 'Patient', entityId: fixture.patientId },
      orderBy: { seq: 'desc' },
    });
    await overwriteAuditContent(row.id, { afterHash: '0'.repeat(64) });

    const result = await anchor.anchorNow();
    expect(result.committed).toBe(false);
    expect(result.reason).toMatch(/kiểm tra|integrity|hash/i);
    expect(await prisma.auditBatch.count()).toBe(0);
  });

  it('restores a damaged audit batch from encrypted local IPFS artifact', async () => {
    const fixture = await seedTrustedPatientChange();
    const anchored = await anchor.anchorNow();
    expect(anchored.committed).toBe(true);
    expect(anchored.batchId).toBeDefined();

    const original = await prisma.blockchainLogger.findFirstOrThrow({
      where: { batchId: anchored.batchId },
      orderBy: { seq: 'asc' },
    });
    await overwriteAuditContent(original.id, { entryHash: 'f'.repeat(64) });

    const recovered = await batchRecovery.recover(
      anchored.batchId!,
      fixture.adminId,
      'Restore modified audit batch from local IPFS',
    );
    expect(recovered).toMatchObject({
      batchId: anchored.batchId,
      status: 'RECOVERED',
      restoredCount: 1,
    });

    const restored = await prisma.blockchainLogger.findUniqueOrThrow({ where: { id: original.id } });
    expect(restored.entryHash).toBe(original.entryHash);
    expect(restored.onChainStatus).toBe('ANCHORED');
  });

  it('recreates a deleted AI diagnosis from IPFS with every foreign key intact', async () => {
    const admin = await prisma.user.create({
      data: {
        username: `diagnosis-admin-${Date.now()}`,
        email: `diagnosis-admin-${Date.now()}@test.local`,
        role: 'ADMIN', status: 'ACTIVE', firstLogin: false,
      },
    });
    const department = await prisma.department.create({
      data: { departmentCode: `K-${Date.now()}`, name: `Khoa ${Date.now()}`, type: 'CLINICAL' },
    });
    const doctorUser = await prisma.user.create({
      data: {
        username: `doctor-${Date.now()}`, email: `doctor-${Date.now()}@test.local`,
        role: 'DOCTOR', status: 'ACTIVE', firstLogin: false,
      },
    });
    const staff = await prisma.staffProfile.create({
      data: {
        userId: doctorUser.id, departmentId: department.id, employeeCode: `BS-${Date.now()}`,
        fullName: 'Bac si recovery', phone: `09${String(Date.now()).slice(-8)}`,
        gender: 'MALE', citizenId: String(Date.now()).slice(-12).padStart(12, '0'),
        birthDate: new Date('1985-01-01T00:00:00.000Z'), avatarUrl: '/doctor.png',
      },
    });
    const doctor = await prisma.doctorProfile.create({
      data: {
        staffProfileId: staff.id, specialty: 'GENERAL_INTERNAL_MEDICINE',
        licenseNumber: `GPH-${Date.now()}`, qualification: 'CKI', yearsExperience: 10,
      },
    });
    const patient = await prisma.patient.create({
      data: {
        patientCode: `BN-DIAG-${Date.now()}`, fullName: 'Benh nhan recovery', gender: 'FEMALE',
        birthDate: new Date('1992-02-02T00:00:00.000Z'), phone: '0900000011',
      },
    });
    const visit = await prisma.visit.create({
      data: { visitCode: `LK-${Date.now()}`, patientId: patient.id, departmentId: department.id, staffId: staff.id },
    });
    const model = await prisma.aiModelRegistry.create({
      data: {
        modelName: 'Recovery AI', modelVersion: '1.0', ipHashEncrypted: 'encrypted-test-hash',
        ipHashPlain: 'plain-test-hash', createdBy: admin.id, type: 'API', status: 'ACTIVE',
      },
    });
    const diagnosis = await prisma.aiDiagnosis.create({
      data: {
        aiModelId: model.id, patientId: patient.id, visitId: visit.id,
        prompt: 'trusted prompt', result: '{"diagnosis":"trusted"}', confidence: 0.93,
        status: 'DOCTOR_REVIEWED', reviewedByDoctorId: doctor.id, doctorFeedback: 'confirmed',
      },
    });
    await audit.recordV2({
      entity: 'AiDiagnosis', entityId: diagnosis.id, action: 'CREATE', actorId: doctorUser.id,
      before: null, after: buildAiDiagnosisSnapshot(diagnosis),
    });
    const anchored = await anchor.anchorNow();
    expect(anchored.committed).toBe(true);

    await prisma.aiDiagnosis.delete({ where: { id: diagnosis.id } });
    const preview = await entityRecovery.previewMany([{ entity: 'AiDiagnosis', entityId: diagnosis.id }]);
    expect(preview).toMatchObject({
      recoverable: 1,
      items: [expect.objectContaining({ operation: 'RECREATE', recoverable: true, source: 'IPFS_BLOCKCHAIN_VERIFIED' })],
    });

    const result = await entityRecovery.recoverMany(
      [{ entity: 'AiDiagnosis', entityId: diagnosis.id }],
      admin.id,
      'Integration recovery for deleted AI diagnosis',
    );
    expect(result).toMatchObject({ requested: 1, recovered: 1, failed: 0 });
    const restored = await prisma.aiDiagnosis.findUniqueOrThrow({ where: { id: diagnosis.id } });
    expect(restored).toMatchObject({
      aiModelId: model.id,
      patientId: patient.id,
      visitId: visit.id,
      reviewedByDoctorId: doctor.id,
      result: diagnosis.result,
      confidence: diagnosis.confidence,
    });
    expect(await prisma.blockchainLogger.count({
      where: { entity: 'AiDiagnosis', entityId: diagnosis.id, action: 'AUDIT_ENTITY_RECREATED_FROM_IPFS' },
    })).toBe(1);
  });

  it('recreates a permanently deleted staff profile and relinks its preserved User tombstone', async () => {
    const admin = await prisma.user.create({
      data: {
        username: `staff-recovery-admin-${Date.now()}`,
        email: `staff-recovery-admin-${Date.now()}@test.local`,
        role: 'ADMIN', status: 'ACTIVE', firstLogin: false,
      },
    });
    const passwordHash = '$argon2id$v=19$m=65536,t=3,p=4$integration$trusted-hash';
    const staffUser = await prisma.user.create({
      data: {
        username: `staff-recovery-${Date.now()}`,
        email: `staff-recovery-${Date.now()}@test.local`, passwordHash,
        role: 'RECEPTIONIST', status: 'ACTIVE', firstLogin: false,
      },
    });
    const staff = await prisma.staffProfile.create({
      data: {
        userId: staffUser.id, employeeCode: `NV-R-${Date.now()}`, fullName: 'Nhan vien hard delete',
        phone: `08${String(Date.now()).slice(-8)}`, gender: 'FEMALE',
        citizenId: `7${String(Date.now()).slice(-11)}`, birthDate: new Date('1993-03-03T00:00:00.000Z'),
        avatarUrl: '/staff-recovery.png', position: 'Receptionist',
      },
      include: { user: true },
    });
    const before = buildStaffSnapshot(staff);
    const deletedAt = new Date();
    await prisma.user.update({
      where: { id: staffUser.id },
      data: { status: 'DELETE', deletedAt, deletedBy: admin.id },
    });
    const softDeleted = await prisma.staffProfile.findUniqueOrThrow({ where: { id: staff.id }, include: { user: true } });
    await audit.recordV2({
      entity: 'StaffProfile', entityId: staff.id, action: 'DELETE', actorId: admin.id,
      before, after: buildStaffSnapshot(softDeleted),
    });

    await lifecycle.permanentDelete('staff', staff.id, admin.id);
    expect(await prisma.staffProfile.findUnique({ where: { id: staff.id } })).toBeNull();
    expect(await prisma.user.findUnique({ where: { id: staffUser.id } })).toMatchObject({ status: 'DELETE', passwordHash });

    const anchored = await anchor.anchorNow();
    expect(anchored.committed).toBe(true);
    const preview = await entityRecovery.previewMany([{ entity: 'StaffProfile', entityId: staff.id }]);
    expect(preview).toMatchObject({ recoverable: 1, items: [expect.objectContaining({ operation: 'RECREATE', recoverable: true })] });

    const result = await entityRecovery.recoverMany(
      [{ entity: 'StaffProfile', entityId: staff.id }],
      admin.id,
      'Integration recovery for permanently deleted staff',
    );
    expect(result).toMatchObject({ requested: 1, recovered: 1, failed: 0 });
    const restored = await prisma.staffProfile.findUniqueOrThrow({ where: { id: staff.id }, include: { user: true } });
    expect(restored).toMatchObject({
      id: staff.id, userId: staffUser.id, employeeCode: staff.employeeCode,
      fullName: staff.fullName, citizenId: staff.citizenId,
      user: expect.objectContaining({ id: staffUser.id, status: 'INACTIVE', passwordHash }),
    });
  });

  it('restores an audit row deleted from PostgreSQL using the encrypted IPFS artifact', async () => {
    const fixture = await seedTrustedPatientChange();
    const anchored = await anchor.anchorNow();
    expect(anchored.committed).toBe(true);

    const original = await prisma.blockchainLogger.findFirstOrThrow({
      where: { batchId: anchored.batchId },
      orderBy: { seq: 'asc' },
    });
    await deleteAuditContent(original.id);
    expect(await prisma.blockchainLogger.findUnique({ where: { id: original.id } })).toBeNull();

    const recovered = await batchRecovery.recover(
      anchored.batchId!,
      fixture.adminId,
      'Restore deleted audit row from local IPFS',
    );

    expect(recovered).toMatchObject({ status: 'RECOVERED', restoredCount: 1 });
    const restored = await prisma.blockchainLogger.findUniqueOrThrow({ where: { id: original.id } });
    expect(restored.entryHash).toBe(original.entryHash);
    expect(restored.afterHash).toBe(original.afterHash);
    expect(restored.onChainStatus).toBe('ANCHORED');
  });

  it('rejects audit recovery when PostgreSQL already matches the blockchain checkpoint', async () => {
    const fixture = await seedTrustedPatientChange();
    const anchored = await anchor.anchorNow();
    expect(anchored.committed).toBe(true);

    const before = await prisma.blockchainLogger.findMany({ where: { batchId: anchored.batchId } });
    await expect(
      batchRecovery.recover(anchored.batchId!, fixture.adminId, 'Recovery must not rewrite a healthy batch'),
    ).rejects.toBeInstanceOf(BadRequestException);

    const after = await prisma.blockchainLogger.findMany({ where: { batchId: anchored.batchId } });
    expect(after).toEqual(before);
    expect(await prisma.auditRecovery.findFirstOrThrow({ orderBy: { createdAt: 'desc' } })).toMatchObject({
      status: 'FAILED',
      restoredCount: 0,
    });
  });

  it('fails closed when the encrypted IPFS artifact cannot be downloaded', async () => {
    const fixture = await seedTrustedPatientChange();
    const anchored = await anchor.anchorNow();
    expect(anchored.committed).toBe(true);
    const original = await prisma.blockchainLogger.findFirstOrThrow({ where: { batchId: anchored.batchId } });
    await overwriteAuditContent(original.id, { entryHash: 'e'.repeat(64) });

    const download = jest.spyOn(ipfs, 'download').mockRejectedValueOnce(new Error('simulated IPFS artifact unavailable'));
    await expect(
      batchRecovery.recover(anchored.batchId!, fixture.adminId, 'IPFS unavailable integration test'),
    ).rejects.toThrow('simulated IPFS artifact unavailable');
    download.mockRestore();

    const unchanged = await prisma.blockchainLogger.findUniqueOrThrow({ where: { id: original.id } });
    expect(unchanged.entryHash).toBe('e'.repeat(64));
    expect(await prisma.auditRecovery.findFirstOrThrow({ orderBy: { createdAt: 'desc' } })).toMatchObject({
      status: 'FAILED',
      restoredCount: 0,
    });
  });

  it('recovers a damaged audit batch before allowing recovery of the tampered entity', async () => {
    const fixture = await seedTrustedPatientChange();
    const anchored = await anchor.anchorNow();
    expect(anchored.committed).toBe(true);
    const original = await prisma.blockchainLogger.findFirstOrThrow({ where: { batchId: anchored.batchId } });

    await overwriteAuditContent(original.id, { afterHash: 'd'.repeat(64) });
    await tamperPatient(fixture.patientId);

    const warningBeforeAuditRecovery = await entityRecovery.listWarnings();
    expect(warningBeforeAuditRecovery.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entity: 'Patient',
        entityId: fixture.patientId,
        status: 'AUDIT_UNTRUSTED',
        recoverable: false,
      }),
    ]));

    await batchRecovery.recover(anchored.batchId!, fixture.adminId, 'Recover audit before entity');
    const entityResult = await entityRecovery.recoverMany(
      [{ entity: 'Patient', entityId: fixture.patientId }],
      fixture.adminId,
      'Recover entity after trusted audit is restored',
    );
    expect(entityResult).toMatchObject({ requested: 1, recovered: 1, failed: 0 });
    const restored = await prisma.patient.findUniqueOrThrow({ where: { id: fixture.patientId } });
    expect(restored.fullName).toBe(fixture.trustedName);
    expect(restored.phone).toBe(fixture.trustedPhone);
  });

  it('allows only one concurrent recovery for the same audit batch', async () => {
    const fixture = await seedTrustedPatientChange();
    const anchored = await anchor.anchorNow();
    expect(anchored.committed).toBe(true);
    const original = await prisma.blockchainLogger.findFirstOrThrow({ where: { batchId: anchored.batchId } });
    await overwriteAuditContent(original.id, { entryHash: 'c'.repeat(64) });

    const realDownload = ipfs.download.bind(ipfs);
    let releaseDownload!: () => void;
    const gate = new Promise<void>((resolve) => { releaseDownload = resolve; });
    const delayed = jest.spyOn(ipfs, 'download').mockImplementationOnce(async (uri) => {
      await gate;
      return realDownload(uri);
    });

    const first = batchRecovery.recover(anchored.batchId!, fixture.adminId, 'First concurrent request');
    await waitForRecoveryStatus(anchored.batchId!, 'STARTED');
    await expect(
      batchRecovery.recover(anchored.batchId!, fixture.adminId, 'Second concurrent request'),
    ).rejects.toBeInstanceOf(ConflictException);
    releaseDownload();
    await expect(first).resolves.toMatchObject({ status: 'RECOVERED', restoredCount: 1 });
    delayed.mockRestore();

    expect(await prisma.auditRecovery.count({ where: { batchId: anchored.batchId } })).toBe(1);
  });


  it('resumes a durable pending batch after server restart and blockchain network recovery', async () => {
    const fixture = await seedTrustedPatientChange();
    const pendingBeforeRestart = await prisma.blockchainLogger.findFirstOrThrow({
      where: { entity: 'Patient', entityId: fixture.patientId },
    });
    expect(pendingBeforeRestart.onChainStatus).toBe('PENDING');
    expect(pendingBeforeRestart.batchId).toBeNull();

    // The process stops after the business transaction and durable audit insert. A new service
    // instance represents the backend starting again with the same PostgreSQL state.
    anchor.onModuleDestroy();
    const restartedDuringOutage = new AuditAnchorService(prisma, blockchain, artifacts);
    restartedDuringOutage.onModuleInit();

    const commitSpy = jest
      .spyOn(blockchain, 'commitAuditCheckpoint')
      .mockResolvedValueOnce({ success: false, error: 'simulated blockchain network outage' });
    const unavailable = await restartedDuringOutage.anchorNow();
    expect(unavailable.committed).toBe(false);
    expect(unavailable.reason).toContain('simulated blockchain network outage');

    const prepared = await prisma.auditBatch.findUniqueOrThrow({ where: { batchId: unavailable.batchId! } });
    expect(prepared.status).toBe('ARTIFACT_READY');
    expect(prepared.artifactUri).toMatch(/^ipfs:\/\//);
    expect(await blockchain.getAuditCheckpoint(prepared.batchId)).toMatchObject({ committed: false });
    commitSpy.mockRestore();
    restartedDuringOutage.onModuleDestroy();

    // Network and server are available again. Startup/retry cycles resume the same batch rather
    // than creating a second artifact or checkpoint.
    const restartedAfterRecovery = new AuditAnchorService(prisma, blockchain, artifacts);
    restartedAfterRecovery.onModuleInit();
    await restartedAfterRecovery.anchorNow();
    await restartedAfterRecovery.anchorNow();

    const anchoredBatch = await prisma.auditBatch.findUniqueOrThrow({ where: { batchId: prepared.batchId } });
    const anchoredLog = await prisma.blockchainLogger.findUniqueOrThrow({ where: { id: pendingBeforeRestart.id } });
    const checkpoint = await blockchain.getAuditCheckpoint(prepared.batchId);
    expect(anchoredBatch.status).toBe('ANCHORED');
    expect(anchoredBatch.artifactUri).toBe(prepared.artifactUri);
    expect(anchoredLog.onChainStatus).toBe('ANCHORED');
    expect(anchoredLog.batchId).toBe(prepared.batchId);
    expect(checkpoint).toMatchObject({
      committed: true,
      artifactUri: prepared.artifactUri,
      leafCount: 1,
    });
    expect(await prisma.auditBatch.count()).toBe(1);
    restartedAfterRecovery.onModuleDestroy();
  });

  it('recovers tampered MedicalOrder, MedicalResult (with files[]), Appointment, and AiQuality from anchored blockchain snapshot', async () => {
    const admin = await prisma.user.create({
      data: { username: `admin-full-${Date.now()}`, email: `admin-full-${Date.now()}@test.local`, role: 'ADMIN', status: 'ACTIVE', firstLogin: false },
    });
    const labDept = await prisma.department.create({
      data: { departmentCode: `LAB-${Date.now()}`, name: `Khoa XN ${Date.now()}`, type: 'LABORATORY', canReceiveOrders: true, status: 'ACTIVE' },
    });
    const doctorUser = await prisma.user.create({
      data: { username: `doc-full-${Date.now()}`, email: `doc-full-${Date.now()}@test.local`, role: 'DOCTOR', status: 'ACTIVE', firstLogin: false },
    });
    const staff = await prisma.staffProfile.create({
      data: {
        userId: doctorUser.id, departmentId: labDept.id, employeeCode: `BS-FULL-${Date.now()}`,
        fullName: 'Bac si Test Full', phone: `09${String(Date.now()).slice(-8)}`, gender: 'MALE',
        citizenId: String(Date.now()).slice(-12).padStart(12, '0'), birthDate: new Date('1988-08-08T00:00:00.000Z'),
        avatarUrl: '/avatar-full.png',
      },
    });
    const doctor = await prisma.doctorProfile.create({
      data: { staffProfileId: staff.id, specialty: 'GENERAL_INTERNAL_MEDICINE', licenseNumber: `GPH-FULL-${Date.now()}`, qualification: 'BS', yearsExperience: 5 },
    });
    const patient = await prisma.patient.create({
      data: { patientCode: `BN-FULL-${Date.now()}`, fullName: 'Benh Nhan Full Test', gender: 'FEMALE', birthDate: new Date('1995-05-05T00:00:00.000Z'), phone: '0988888888' },
    });
    const visit = await prisma.visit.create({
      data: { visitCode: `LK-FULL-${Date.now()}`, patientId: patient.id, departmentId: labDept.id, staffId: staff.id, status: 'IN_PROGRESS', source: 'WALK_IN' },
    });
    const aiModel = await prisma.aiModelRegistry.create({
      data: { modelName: 'Chest XRay AI', modelVersion: '2.0', ipHashEncrypted: 'hash-enc', ipHashPlain: 'hash-plain', createdBy: admin.id, status: 'ACTIVE' },
    });
    const aiDiagnosis = await prisma.aiDiagnosis.create({
      data: { aiModelId: aiModel.id, patientId: patient.id, visitId: visit.id, prompt: 'Chest XRay prompt', result: '{"pneumonia": false}', confidence: 0.98, status: 'DOCTOR_REVIEWED', reviewedByDoctorId: doctor.id },
    });

    // 1. Seed MedicalOrder with 100% DB fields & write audit snapshot
    const order = await prisma.medicalOrder.create({
      data: {
        orderCode: `ORD-FULL-${Date.now()}`, visitId: visit.id, patientId: patient.id, doctorId: doctor.id,
        targetDepartmentId: labDept.id, orderType: 'BLOOD_TEST', priority: 'HIGH', clinicalNote: 'Original clinical note', status: 'ORDERED',
      },
    });
    await audit.recordV2({
      entity: 'MedicalOrder', entityId: order.id, action: 'CREATE', actorId: doctorUser.id,
      before: null, after: buildMedicalOrderSnapshot(order),
    });

    // 2. Seed MedicalResult & 2 MedicalResultFiles with 100% metadata & write audit snapshot
    const resultRow = await prisma.medicalResult.create({
      data: {
        resultCode: `RES-FULL-${Date.now()}`, orderId: order.id, performedById: doctorUser.id,
        note: 'Original result note', returnedAt: new Date('2026-08-09T08:00:00.000Z'),
        files: {
          create: [
            {
              fileName: 'cong_thuc_mau.pdf', originalName: 'CongThucMau_NguyenVanA.pdf', mimeType: 'application/pdf', size: 1048576,
              storageProvider: 'CLOUDINARY', url: 'https://res.cloudinary.com/test/raw/upload/v1/cong_thuc_mau.pdf',
              bucket: 'lab-bucket', objectKey: '2026/08/cong_thuc_mau.pdf', sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
              etag: '"d41d8cd98f00b204e9800998ecf8427e"',
            },
            {
              fileName: 'xquang_phoi.png', originalName: 'XQuangPhoi_NguyenVanA.png', mimeType: 'image/png', size: 2097152,
              storageProvider: 'CLOUDINARY', url: 'https://res.cloudinary.com/test/image/upload/v1/xquang_phoi.png',
              bucket: 'lab-bucket', objectKey: '2026/08/xquang_phoi.png', sha256: '8f4e3c2b1a0d9e8f7c6b5a4321fedcba8f4e3c2b1a0d9e8f7c6b5a4321fedcba',
              etag: '"a1b2c3d4e5f60718293a4b5c6d7e8f90"',
            },
          ],
        },
      },
      include: { files: true },
    });
    await audit.recordV2({
      entity: 'MedicalResult', entityId: resultRow.id, action: 'CREATE', actorId: doctorUser.id,
      before: null, after: buildMedicalResultSnapshot({ ...resultRow, visitId: visit.id }),
    });

    // 3. Seed Appointment with 100% DB fields & write audit snapshot
    const scheduledAt = new Date('2026-08-10T09:00:00.000Z');
    const rawQrToken = crypto.randomBytes(32).toString('base64url');
    const qrTokenHash = crypto.createHmac('sha256', 'test-secret').update(rawQrToken).digest('hex');
    const appt = await prisma.appointment.create({
      data: {
        appointmentCode: `LH-FULL-${Date.now()}`, patientId: patient.id, departmentId: labDept.id, doctorId: doctor.id,
        scheduledAt, status: 'CONFIRMED', qrTokenHash, qrExpiresAt: new Date(scheduledAt.getTime() + 86400000),
      },
      include: { doctor: { select: { staffProfileId: true } } },
    });
    await audit.recordV2({
      entity: 'Appointment', entityId: appt.id, action: 'CREATE', actorId: admin.id,
      before: null, after: buildAppointmentSnapshot(appt),
    });

    // 4. Seed AiQuality with 100% DB fields & write audit snapshot
    const quality = await prisma.aiQuality.create({
      data: {
        doctorId: doctor.id, aiModelId: aiModel.id, aiDiagnosisId: aiDiagnosis.id,
        doctorConclusionAboutModel: 'Original AI model review', trustablePercent: 95.5,
      },
    });
    await audit.recordV2({
      entity: 'AiQuality', entityId: quality.id, action: 'AI_MODEL_RATED', actorId: doctorUser.id,
      before: null, after: buildAiQualitySnapshot(quality),
    });

    // Anchor batch on blockchain/IPFS
    const anchored = await anchor.anchorNow();
    expect(anchored.committed).toBe(true);

    // Tamper all 4 entities in PostgreSQL
    await prisma.medicalOrder.update({ where: { id: order.id }, data: { clinicalNote: 'Hacker tampered order note', priority: 'LOW' } });
    await prisma.medicalResult.update({ where: { id: resultRow.id }, data: { note: 'Hacker tampered result note' } });
    await prisma.medicalResultFile.deleteMany({ where: { resultId: resultRow.id } }); // Hacker deleted files!
    await prisma.appointment.update({ where: { id: appt.id }, data: { scheduledAt: new Date('2020-01-01T00:00:00.000Z'), status: 'CANCELLED' } });
    await prisma.aiQuality.update({ where: { id: quality.id }, data: { trustablePercent: 0.0, doctorConclusionAboutModel: 'Faked model review' } });

    // Verify warnings detected TAMPERED status for all 4 entities
    const warnings = await entityRecovery.listWarnings();
    const tamperedEntities = warnings.items.map((w) => w.entity);
    expect(tamperedEntities).toEqual(expect.arrayContaining(['MedicalOrder', 'MedicalResult', 'Appointment', 'AiQuality']));

    // Recover all 4 entities
    const recoveryResult = await entityRecovery.recoverMany(
      [
        { entity: 'MedicalOrder', entityId: order.id },
        { entity: 'MedicalResult', entityId: resultRow.id },
        { entity: 'Appointment', entityId: appt.id },
        { entity: 'AiQuality', entityId: quality.id },
      ],
      admin.id,
      'Recovery test for 4 new entities',
    );
    expect(recoveryResult).toMatchObject({ requested: 4, recovered: 4, failed: 0 });

    // Verify DB states restored 100%
    const restoredOrder = await prisma.medicalOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(restoredOrder.clinicalNote).toBe('Original clinical note');
    expect(restoredOrder.priority).toBe('HIGH');

    const restoredResult = await prisma.medicalResult.findUniqueOrThrow({ where: { id: resultRow.id }, include: { files: true } });
    expect(restoredResult.note).toBe('Original result note');
    expect(restoredResult.files).toHaveLength(2);
    expect(restoredResult.files[0]).toMatchObject({
      fileName: 'cong_thuc_mau.pdf', originalName: 'CongThucMau_NguyenVanA.pdf', mimeType: 'application/pdf',
      size: 1048576, storageProvider: 'CLOUDINARY', url: 'https://res.cloudinary.com/test/raw/upload/v1/cong_thuc_mau.pdf',
    });
    expect(restoredResult.files[1]).toMatchObject({
      fileName: 'xquang_phoi.png', originalName: 'XQuangPhoi_NguyenVanA.png', mimeType: 'image/png',
      size: 2097152, storageProvider: 'CLOUDINARY', url: 'https://res.cloudinary.com/test/image/upload/v1/xquang_phoi.png',
    });

    const restoredAppt = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(restoredAppt.scheduledAt).toEqual(scheduledAt);
    expect(restoredAppt.status).toBe('CONFIRMED');

    const restoredQuality = await prisma.aiQuality.findUniqueOrThrow({ where: { id: quality.id } });
    expect(restoredQuality.trustablePercent).toBe(95.5);
    expect(restoredQuality.doctorConclusionAboutModel).toBe('Original AI model review');
  });

  it('recreates deleted MedicalResult with full files[] metadata and Appointment from IPFS', async () => {
    const admin = await prisma.user.create({
      data: { username: `admin-rec-${Date.now()}`, email: `admin-rec-${Date.now()}@test.local`, role: 'ADMIN', status: 'ACTIVE', firstLogin: false },
    });
    const labDept = await prisma.department.create({
      data: { departmentCode: `LAB-R-${Date.now()}`, name: `Khoa XN Recreate ${Date.now()}`, type: 'LABORATORY', canReceiveOrders: true, status: 'ACTIVE' },
    });
    const doctorUser = await prisma.user.create({
      data: { username: `doc-rec-${Date.now()}`, email: `doc-rec-${Date.now()}@test.local`, role: 'DOCTOR', status: 'ACTIVE', firstLogin: false },
    });
    const staff = await prisma.staffProfile.create({
      data: {
        userId: doctorUser.id, departmentId: labDept.id, employeeCode: `BS-REC-${Date.now()}`,
        fullName: 'Bac si Recreate', phone: `09${String(Date.now()).slice(-8)}`, gender: 'MALE',
        citizenId: String(Date.now()).slice(-12).padStart(12, '0'), birthDate: new Date('1990-01-01T00:00:00.000Z'), avatarUrl: '/avatar-rec.png',
      },
    });
    const doctor = await prisma.doctorProfile.create({
      data: { staffProfileId: staff.id, specialty: 'GENERAL_INTERNAL_MEDICINE', licenseNumber: `GPH-REC-${Date.now()}`, qualification: 'BS', yearsExperience: 5 },
    });
    const patient = await prisma.patient.create({
      data: { patientCode: `BN-REC-${Date.now()}`, fullName: 'Benh Nhan Recreate', gender: 'MALE', birthDate: new Date('1992-02-02T00:00:00.000Z'), phone: '0977777777' },
    });
    const visit = await prisma.visit.create({
      data: { visitCode: `LK-REC-${Date.now()}`, patientId: patient.id, departmentId: labDept.id, staffId: staff.id, status: 'IN_PROGRESS', source: 'WALK_IN' },
    });
    const order = await prisma.medicalOrder.create({
      data: { orderCode: `ORD-REC-${Date.now()}`, visitId: visit.id, patientId: patient.id, doctorId: doctor.id, targetDepartmentId: labDept.id, orderType: 'BLOOD_TEST', priority: 'NORMAL', status: 'ORDERED' },
    });

    const resultRow = await prisma.medicalResult.create({
      data: {
        resultCode: `RES-REC-${Date.now()}`, orderId: order.id, performedById: doctorUser.id, note: 'Recreate test note',
        files: {
          create: [{ fileName: 'test_result.pdf', originalName: 'TestResult.pdf', mimeType: 'application/pdf', size: 500000, storageProvider: 'CLOUDINARY', url: 'https://cloudinary.com/test_result.pdf' }],
        },
      },
      include: { files: true },
    });
    await audit.recordV2({
      entity: 'MedicalResult', entityId: resultRow.id, action: 'CREATE', actorId: doctorUser.id,
      before: null, after: buildMedicalResultSnapshot({ ...resultRow, visitId: visit.id }),
    });

    const appt = await prisma.appointment.create({
      data: {
        appointmentCode: `LH-REC-${Date.now()}`, patientId: patient.id, departmentId: labDept.id, doctorId: doctor.id,
        scheduledAt: new Date('2026-09-09T09:00:00.000Z'), status: 'CONFIRMED',
        qrTokenHash: 'initial-hash', qrExpiresAt: new Date('2026-09-10T09:00:00.000Z'),
      },
      include: { doctor: { select: { staffProfileId: true } } },
    });
    await audit.recordV2({
      entity: 'Appointment', entityId: appt.id, action: 'CREATE', actorId: admin.id,
      before: null, after: buildAppointmentSnapshot(appt),
    });

    const anchored = await anchor.anchorNow();
    expect(anchored.committed).toBe(true);

    // Hard Delete MedicalResult and Appointment
    await prisma.medicalResultFile.deleteMany({ where: { resultId: resultRow.id } });
    await prisma.medicalResult.delete({ where: { id: resultRow.id } });
    await prisma.appointment.delete({ where: { id: appt.id } });

    // Preview
    const preview = await entityRecovery.previewMany([
      { entity: 'MedicalResult', entityId: resultRow.id },
      { entity: 'Appointment', entityId: appt.id },
    ]);
    expect(preview.recoverable).toBe(2);
    expect(preview.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ entity: 'MedicalResult', operation: 'RECREATE', recoverable: true }),
      expect.objectContaining({ entity: 'Appointment', operation: 'RECREATE', recoverable: true }),
    ]));

    // Recreate from IPFS
    const recreationResult = await entityRecovery.recoverMany(
      [
        { entity: 'MedicalResult', entityId: resultRow.id },
        { entity: 'Appointment', entityId: appt.id },
      ],
      admin.id,
      'Recreate deleted MedicalResult & Appointment from IPFS',
    );
    expect(recreationResult).toMatchObject({ requested: 2, recovered: 2, failed: 0 });

    const recreatedResult = await prisma.medicalResult.findUniqueOrThrow({ where: { id: resultRow.id }, include: { files: true } });
    expect(recreatedResult.note).toBe('Recreate test note');
    expect(recreatedResult.files).toHaveLength(1);
    expect(recreatedResult.files[0].fileName).toBe('test_result.pdf');

    const recreatedAppt = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(recreatedAppt.appointmentCode).toBe(appt.appointmentCode);
    expect(recreatedAppt.status).toBe('CONFIRMED');
    expect(recreatedAppt.qrTokenHash).toBeDefined();
    expect(recreatedAppt.qrTokenHash).not.toBe('initial-hash');
  });

  it('executes full clinical flow seed (receptionist -> appointment -> visit -> doctor order -> lab result with files -> 5 AI diagnoses & quality rating -> conclusion), tampers DB, and successfully recovers 100% data', async () => {
    // 1. Roles & Users Setup
    const admin = await prisma.user.create({
      data: { username: `e2e-admin-${Date.now()}`, email: `e2e-admin-${Date.now()}@test.local`, role: 'ADMIN', status: 'ACTIVE', firstLogin: false },
    });
    const receptionUser = await prisma.user.create({
      data: { username: `reception-${Date.now()}`, email: `reception-${Date.now()}@test.local`, role: 'RECEPTIONIST', status: 'ACTIVE', firstLogin: false },
    });
    const doctorUser = await prisma.user.create({
      data: { username: `e2e-doctor-${Date.now()}`, email: `e2e-doctor-${Date.now()}@test.local`, role: 'DOCTOR', status: 'ACTIVE', firstLogin: false },
    });

    const clinDept = await prisma.department.create({
      data: { departmentCode: `K-KHAM-${Date.now()}`, name: `Khoa Kham Benh ${Date.now()}`, type: 'EXAMINATION', status: 'ACTIVE' },
    });
    const labDept = await prisma.department.create({
      data: { departmentCode: `K-XN-${Date.now()}`, name: `Khoa Xet Nghiem ${Date.now()}`, type: 'LABORATORY', canReceiveOrders: true, status: 'ACTIVE' },
    });

    const doctorStaff = await prisma.staffProfile.create({
      data: {
        userId: doctorUser.id, departmentId: clinDept.id, employeeCode: `BS-E2E-${Date.now()}`,
        fullName: 'Bac Si Lam Sang E2E', phone: `09${String(Date.now()).slice(-8)}`, gender: 'MALE',
        citizenId: String(Date.now()).slice(-12).padStart(12, '0'), birthDate: new Date('1985-05-15T00:00:00.000Z'), avatarUrl: '/doctor-e2e.png',
      },
    });
    const doctor = await prisma.doctorProfile.create({
      data: { staffProfileId: doctorStaff.id, specialty: 'GENERAL_INTERNAL_MEDICINE', licenseNumber: `GPH-E2E-${Date.now()}`, qualification: 'CKII', yearsExperience: 12 },
    });

    const patient = await prisma.patient.create({
      data: {
        patientCode: `BN-E2E-${Date.now()}`, fullName: 'Tran Van E2E Patient', gender: 'MALE',
        birthDate: new Date('1991-11-11T00:00:00.000Z'), citizenId: String(Date.now()).slice(-12).padStart(12, '0'),
        phone: '0912345678', address: '123 Tran Hung Dao, Q1, TP.HCM', emergencyContact: '0987654321',
      },
    });

    // 2. STEP A: Receptionist creates Appointment
    const scheduledAt = new Date('2026-08-10T08:30:00.000Z');
    const rawQrToken = crypto.randomBytes(32).toString('base64url');
    const qrTokenHash = crypto.createHmac('sha256', 'test-secret').update(rawQrToken).digest('hex');
    const appointment = await prisma.appointment.create({
      data: {
        appointmentCode: `LH-E2E-${Date.now()}`, patientId: patient.id, departmentId: clinDept.id, doctorId: doctor.id,
        scheduledAt, status: 'CONFIRMED', qrTokenHash, qrExpiresAt: new Date(scheduledAt.getTime() + 86400000), createdByUserId: receptionUser.id,
      },
      include: { doctor: { select: { staffProfileId: true } } },
    });
    await audit.recordV2({
      entity: 'Appointment', entityId: appointment.id, action: 'CREATE', actorId: receptionUser.id,
      before: null, after: buildAppointmentSnapshot(appointment),
    });

    // 3. STEP B: Patient arrives & Visit is created
    const visit = await prisma.visit.create({
      data: {
        visitCode: `LK-E2E-${Date.now()}`, patientId: patient.id, departmentId: clinDept.id, staffId: doctorStaff.id,
        status: 'IN_PROGRESS', source: 'APPOINTMENT', checkInAt: new Date(),
      },
    });
    await audit.recordV2({
      entity: 'Visit', entityId: visit.id, action: 'CREATE', actorId: receptionUser.id,
      before: null, after: buildVisitSnapshot(visit),
    });

    await prisma.appointment.update({ where: { id: appointment.id }, data: { status: 'CHECKED_IN', visitId: visit.id, checkedInAt: new Date() } });

    // 4. STEP C: Doctor accepts Visit and creates MedicalOrder
    const medicalOrder = await prisma.medicalOrder.create({
      data: {
        orderCode: `ORD-E2E-${Date.now()}`, visitId: visit.id, patientId: patient.id, doctorId: doctor.id,
        targetDepartmentId: labDept.id, orderType: 'BLOOD_TEST', priority: 'HIGH',
        clinicalNote: 'Benh nhan sot cao ngay 3, nghi ngo Dengue — yeu cau cong thuc mau & X-Quang phoi', status: 'ORDERED',
      },
    });
    await audit.recordV2({
      entity: 'MedicalOrder', entityId: medicalOrder.id, action: 'CREATE', actorId: doctorUser.id,
      before: null, after: buildMedicalOrderSnapshot(medicalOrder),
    });

    // 5. STEP D: Lab Technician performs test & returns MedicalResult with 2 Files
    const resultRow = await prisma.medicalResult.create({
      data: {
        resultCode: `RES-E2E-${Date.now()}`, orderId: medicalOrder.id, performedById: doctorUser.id,
        note: 'Tieu cau giam con 110 G/L, quai dong phoi thoat dich nhe', returnedAt: new Date('2026-08-09T09:00:00.000Z'),
        files: {
          create: [
            {
              fileName: 'ctm_e2e.pdf', originalName: 'CongThucMau_E2E.pdf', mimeType: 'application/pdf', size: 1200000,
              storageProvider: 'CLOUDINARY', url: 'https://res.cloudinary.com/test/raw/upload/v1/ctm_e2e.pdf',
              bucket: 'e2e-bucket', objectKey: '2026/08/ctm_e2e.pdf', sha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90', etag: '"etag-pdf-e2e"',
            },
            {
              fileName: 'xquang_e2e.png', originalName: 'XQuangPhoi_E2E.png', mimeType: 'image/png', size: 2500000,
              storageProvider: 'CLOUDINARY', url: 'https://res.cloudinary.com/test/image/upload/v1/xquang_e2e.png',
              bucket: 'e2e-bucket', objectKey: '2026/08/xquang_e2e.png', sha256: 'f9e8d7c6b5a43210f9e8d7c6b5a43210f9e8d7c6b5a43210f9e8d7c6b5a43210', etag: '"etag-png-e2e"',
            },
          ],
        },
      },
      include: { files: true },
    });
    await audit.recordV2({
      entity: 'MedicalResult', entityId: resultRow.id, action: 'CREATE', actorId: doctorUser.id,
      before: null, after: buildMedicalResultSnapshot({ ...resultRow, visitId: visit.id }),
    });

    await prisma.medicalOrder.update({ where: { id: medicalOrder.id }, data: { status: 'RESULT_READY', completedAt: new Date() } });

    // 6. STEP E: Doctor runs AI Diagnosis 5 times
    const aiModel = await prisma.aiModelRegistry.create({
      data: { modelName: 'Multi-Modal Dengue & Pulmonary AI', modelVersion: '3.5', ipHashEncrypted: 'ip-enc-v35', ipHashPlain: 'ip-plain-v35', createdBy: admin.id, status: 'ACTIVE' },
    });

    const aiDiagnoses: any[] = [];
    const confidences = [0.90, 0.92, 0.94, 0.96, 0.98];
    for (let i = 1; i <= 5; i += 1) {
      const diag = await prisma.aiDiagnosis.create({
        data: {
          aiModelId: aiModel.id, patientId: patient.id, visitId: visit.id,
          prompt: `AI Analysis run #${i} for patient ${patient.patientCode}`,
          result: JSON.stringify({ dengueRisk: 'HIGH', confidence: confidences[i - 1], pulmonaryInfiltration: i >= 4 }),
          confidence: confidences[i - 1], status: i === 5 ? 'DOCTOR_REVIEWED' : 'PENDING_REVIEW',
          reviewedByDoctorId: i === 5 ? doctor.id : null, doctorFeedback: i === 5 ? 'Doctor confirmed AI prediction' : null,
        },
      });
      await audit.recordV2({
        entity: 'AiDiagnosis', entityId: diag.id, action: 'CREATE', actorId: doctorUser.id,
        before: null, after: buildAiDiagnosisSnapshot(diag),
      });
      aiDiagnoses.push(diag);
    }

    // Doctor rates AI Model quality (AiQuality) linked to diagnosis #5
    const aiQuality = await prisma.aiQuality.create({
      data: {
        doctorId: doctor.id, aiModelId: aiModel.id, aiDiagnosisId: aiDiagnoses[4].id,
        doctorConclusionAboutModel: 'Model AI du doan rat chinh xac xuat huyet Dengue va ton thuong phoi', trustablePercent: 96.5,
      },
    });
    await audit.recordV2({
      entity: 'AiQuality', entityId: aiQuality.id, action: 'AI_MODEL_RATED', actorId: doctorUser.id,
      before: null, after: buildAiQualitySnapshot(aiQuality),
    });

    // 7. STEP F: Doctor issues MedicalConclusion & completes Visit
    const conclusionData = {
      visitId: visit.id, doctorId: doctor.id, aiDiagnosisId: aiDiagnoses[4].id,
      finalDiagnosis: 'Sot xuat huyet Dengue cap ngay 3 — Theo doi tran dịch mang phoi nhe',
      treatmentPlan: 'Truyen dich Ringer Lactate 500ml, theo doi tieu cau hang ngay',
      prescription: 'Paracetamol 500mg x 3 vien/ngay (uong khi sot > 38.5C)',
      followUpNote: 'Tai kham sau 24h hoac ngay khi co dau hieu xuat huyet duoi da', doctorNote: 'Benh nhan tinh tao, sinh hieu on dinh',
    };
    const integrity = audit.hashSnapshot({ ...conclusionData, patientCode: patient.patientCode });
    const conclusion = await prisma.medicalConclusion.create({
      data: { ...conclusionData, hash256: integrity.hash, dataSalt: integrity.salt },
    });
    await audit.recordV2({
      entity: 'MedicalConclusion', entityId: conclusion.id, action: 'CREATE', actorId: doctorUser.id,
      before: null, after: buildMedicalConclusionSnapshot({ ...conclusion, visit: { patient } }),
    });

    await prisma.visit.update({ where: { id: visit.id }, data: { status: 'COMPLETED', completedAt: new Date() } });

    // 8. STEP G: MedicalConclusion is Tier-A, so audit.recordV2 automatically seals & anchors the batch on Blockchain & IPFS!
    const latestBatch = await prisma.auditBatch.findFirstOrThrow({ orderBy: { batchId: 'desc' } });
    expect(latestBatch.status).toBe('ANCHORED');
    expect(latestBatch.leafCount).toBe(11);

    // 9. TAMPER & DELETE PHASE: Hack/Modify PostgreSQL directly!
    // A. Sửa MedicalOrder
    await prisma.medicalOrder.update({ where: { id: medicalOrder.id }, data: { clinicalNote: 'HACKER MODIFIED CLINICAL NOTE', priority: 'LOW' } });
    // B. Sửa MedicalResult & xóa files
    await prisma.medicalResult.update({ where: { id: resultRow.id }, data: { note: 'HACKER MODIFIED RESULT NOTE' } });
    await prisma.medicalResultFile.deleteMany({ where: { resultId: resultRow.id } });
    // C. Sửa AiQuality
    await prisma.aiQuality.update({ where: { id: aiQuality.id }, data: { trustablePercent: 1.0, doctorConclusionAboutModel: 'HACKER BAD REVIEW' } });
    // D. Sửa MedicalConclusion
    await prisma.medicalConclusion.update({ where: { id: conclusion.id }, data: { finalDiagnosis: 'HACKER FAKE DIAGNOSIS' } });
    // E. Hard Delete Appointment
    await prisma.appointment.delete({ where: { id: appointment.id } });
    // F. Hard Delete AiDiagnosis #3 & #5
    await prisma.aiDiagnosis.delete({ where: { id: aiDiagnoses[2].id } });
    await prisma.aiDiagnosis.delete({ where: { id: aiDiagnoses[4].id } });

    // 10. RECOVERY & VERIFICATION PHASE
    const warnings = await entityRecovery.listWarnings();
    const tamperedList = warnings.items.map((w) => `${w.entity}:${w.status}`);
    expect(tamperedList).toEqual(expect.arrayContaining([
      `MedicalOrder:TAMPERED`,
      `MedicalResult:TAMPERED`,
      `AiQuality:TAMPERED`,
      `MedicalConclusion:TAMPERED`,
      `Appointment:MISSING`,
      `AiDiagnosis:MISSING`,
    ]));

    // Perform Full Recovery for all 7 affected entities
    const recoveryResult = await entityRecovery.recoverMany(
      [
        { entity: 'AiDiagnosis', entityId: aiDiagnoses[2].id },
        { entity: 'AiDiagnosis', entityId: aiDiagnoses[4].id },
        { entity: 'Appointment', entityId: appointment.id },
        { entity: 'MedicalOrder', entityId: medicalOrder.id },
        { entity: 'MedicalResult', entityId: resultRow.id },
        { entity: 'AiQuality', entityId: aiQuality.id },
        { entity: 'MedicalConclusion', entityId: conclusion.id },
      ],
      admin.id,
      'Full clinical flow recovery integration test',
    );

    expect(recoveryResult).toMatchObject({ requested: 7, recovered: 7, failed: 0 });

    // 11. VERIFY 100% DATA RESTORED MATCHES ORIGINAL AUDIT
    const restoredOrder = await prisma.medicalOrder.findUniqueOrThrow({ where: { id: medicalOrder.id } });
    expect(restoredOrder.clinicalNote).toBe('Benh nhan sot cao ngay 3, nghi ngo Dengue — yeu cau cong thuc mau & X-Quang phoi');
    expect(restoredOrder.priority).toBe('HIGH');

    const restoredResult = await prisma.medicalResult.findUniqueOrThrow({ where: { id: resultRow.id }, include: { files: true } });
    expect(restoredResult.note).toBe('Tieu cau giam con 110 G/L, quai dong phoi thoat dich nhe');
    expect(restoredResult.files).toHaveLength(2);
    expect(restoredResult.files[0]).toMatchObject({
      fileName: 'ctm_e2e.pdf', originalName: 'CongThucMau_E2E.pdf', mimeType: 'application/pdf', size: 1200000,
      storageProvider: 'CLOUDINARY', url: 'https://res.cloudinary.com/test/raw/upload/v1/ctm_e2e.pdf',
    });
    expect(restoredResult.files[1]).toMatchObject({
      fileName: 'xquang_e2e.png', originalName: 'XQuangPhoi_E2E.png', mimeType: 'image/png', size: 2500000,
      storageProvider: 'CLOUDINARY', url: 'https://res.cloudinary.com/test/image/upload/v1/xquang_e2e.png',
    });

    const restoredAppt = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(restoredAppt.appointmentCode).toBe(appointment.appointmentCode);
    expect(restoredAppt.status).toBe('CONFIRMED');
    expect(restoredAppt.qrTokenHash).toBeDefined();

    const restoredDiag3 = await prisma.aiDiagnosis.findUniqueOrThrow({ where: { id: aiDiagnoses[2].id } });
    expect(restoredDiag3.confidence).toBe(0.94);
    expect(restoredDiag3.prompt).toContain('run #3');

    const restoredDiag5 = await prisma.aiDiagnosis.findUniqueOrThrow({ where: { id: aiDiagnoses[4].id } });
    expect(restoredDiag5.confidence).toBe(0.98);
    expect(restoredDiag5.status).toBe('DOCTOR_REVIEWED');

    const restoredQuality = await prisma.aiQuality.findUniqueOrThrow({ where: { id: aiQuality.id } });
    expect(restoredQuality.trustablePercent).toBe(96.5);
    expect(restoredQuality.doctorConclusionAboutModel).toBe('Model AI du doan rat chinh xac xuat huyet Dengue va ton thuong phoi');

    const restoredConclusion = await prisma.medicalConclusion.findUniqueOrThrow({ where: { id: conclusion.id } });
    expect(restoredConclusion.finalDiagnosis).toBe('Sot xuat huyet Dengue cap ngay 3 — Theo doi tran dịch mang phoi nhe');
    expect(restoredConclusion.treatmentPlan).toBe('Truyen dich Ringer Lactate 500ml, theo doi tieu cau hang ngay');
  });

  it('performs HARD DELETE on ALL clinical entities (MedicalResult, MedicalResultFiles, MedicalOrder, Appointment, AiDiagnosis, AiQuality, MedicalConclusion) and recreates 100% of them from IPFS + Blockchain', async () => {
    // 1. Setup Base Entities
    const admin = await prisma.user.create({
      data: { username: `del-admin-${Date.now()}`, email: `del-admin-${Date.now()}@test.local`, role: 'ADMIN', status: 'ACTIVE', firstLogin: false },
    });
    const receptionUser = await prisma.user.create({
      data: { username: `del-recept-${Date.now()}`, email: `del-recept-${Date.now()}@test.local`, role: 'RECEPTIONIST', status: 'ACTIVE', firstLogin: false },
    });
    const doctorUser = await prisma.user.create({
      data: { username: `del-doctor-${Date.now()}`, email: `del-doctor-${Date.now()}@test.local`, role: 'DOCTOR', status: 'ACTIVE', firstLogin: false },
    });

    const clinDept = await prisma.department.create({
      data: { departmentCode: `K-DEL-CLIN-${Date.now()}`, name: `Khoa Kham Wipe ${Date.now()}`, type: 'EXAMINATION', status: 'ACTIVE' },
    });
    const labDept = await prisma.department.create({
      data: { departmentCode: `K-DEL-LAB-${Date.now()}`, name: `Khoa XN Wipe ${Date.now()}`, type: 'LABORATORY', canReceiveOrders: true, status: 'ACTIVE' },
    });

    const doctorStaff = await prisma.staffProfile.create({
      data: {
        userId: doctorUser.id, departmentId: clinDept.id, employeeCode: `BS-DEL-${Date.now()}`,
        fullName: 'Bac Si Hard Delete Test', phone: `09${String(Date.now()).slice(-8)}`, gender: 'MALE',
        citizenId: String(Date.now()).slice(-12).padStart(12, '0'), birthDate: new Date('1987-07-07T00:00:00.000Z'), avatarUrl: '/doctor-del.png',
      },
    });
    const doctor = await prisma.doctorProfile.create({
      data: { staffProfileId: doctorStaff.id, specialty: 'GENERAL_INTERNAL_MEDICINE', licenseNumber: `GPH-DEL-${Date.now()}`, qualification: 'CKII', yearsExperience: 10 },
    });

    const patient = await prisma.patient.create({
      data: {
        patientCode: `BN-DEL-${Date.now()}`, fullName: 'Tran Van Hard Delete Patient', gender: 'MALE',
        birthDate: new Date('1993-03-03T00:00:00.000Z'), citizenId: String(Date.now()).slice(-12).padStart(12, '0'),
        phone: '0933333333', address: '456 Le Loi, Q1, TP.HCM', emergencyContact: '0944444444',
      },
    });

    // 2. Create Appointment & Visit
    const scheduledAt = new Date('2026-08-11T09:00:00.000Z');
    const appointment = await prisma.appointment.create({
      data: {
        appointmentCode: `LH-DEL-${Date.now()}`, patientId: patient.id, departmentId: clinDept.id, doctorId: doctor.id,
        scheduledAt, status: 'CONFIRMED', qrTokenHash: 'qr-hash-del', qrExpiresAt: new Date(scheduledAt.getTime() + 86400000), createdByUserId: receptionUser.id,
      },
      include: { doctor: { select: { staffProfileId: true } } },
    });
    await audit.recordV2({
      entity: 'Appointment', entityId: appointment.id, action: 'CREATE', actorId: receptionUser.id,
      before: null, after: buildAppointmentSnapshot(appointment),
    });

    const visit = await prisma.visit.create({
      data: {
        visitCode: `LK-DEL-${Date.now()}`, patientId: patient.id, departmentId: clinDept.id, staffId: doctorStaff.id,
        status: 'IN_PROGRESS', source: 'APPOINTMENT', checkInAt: new Date(),
      },
    });
    await audit.recordV2({
      entity: 'Visit', entityId: visit.id, action: 'CREATE', actorId: receptionUser.id,
      before: null, after: buildVisitSnapshot(visit),
    });

    // 3. Create MedicalOrder
    const medicalOrder = await prisma.medicalOrder.create({
      data: {
        orderCode: `ORD-DEL-${Date.now()}`, visitId: visit.id, patientId: patient.id, doctorId: doctor.id,
        targetDepartmentId: labDept.id, orderType: 'BLOOD_TEST', priority: 'HIGH',
        clinicalNote: 'Delete simulation clinical note for Dengue test', status: 'ORDERED',
      },
    });
    await audit.recordV2({
      entity: 'MedicalOrder', entityId: medicalOrder.id, action: 'CREATE', actorId: doctorUser.id,
      before: null, after: buildMedicalOrderSnapshot(medicalOrder),
    });

    // 4. Create MedicalResult with 2 Files
    const resultRow = await prisma.medicalResult.create({
      data: {
        resultCode: `RES-DEL-${Date.now()}`, orderId: medicalOrder.id, performedById: doctorUser.id,
        note: 'Delete simulation result note - Platelets 105 G/L', returnedAt: new Date('2026-08-09T09:30:00.000Z'),
        files: {
          create: [
            {
              fileName: 'del_result_1.pdf', originalName: 'DelResult1.pdf', mimeType: 'application/pdf', size: 1500000,
              storageProvider: 'CLOUDINARY', url: 'https://res.cloudinary.com/test/raw/upload/v1/del_result_1.pdf',
              bucket: 'del-bucket', objectKey: '2026/08/del_result_1.pdf', sha256: 'b1b2c3d4e5f60718293a4b5c6d7e8f90b1b2c3d4e5f60718293a4b5c6d7e8f90', etag: '"etag-del-1"',
            },
            {
              fileName: 'del_result_2.png', originalName: 'DelResult2.png', mimeType: 'image/png', size: 2800000,
              storageProvider: 'CLOUDINARY', url: 'https://res.cloudinary.com/test/image/upload/v1/del_result_2.png',
              bucket: 'del-bucket', objectKey: '2026/08/del_result_2.png', sha256: 'c9e8d7c6b5a43210c9e8d7c6b5a43210c9e8d7c6b5a43210c9e8d7c6b5a43210', etag: '"etag-del-2"',
            },
          ],
        },
      },
      include: { files: true },
    });
    await audit.recordV2({
      entity: 'MedicalResult', entityId: resultRow.id, action: 'CREATE', actorId: doctorUser.id,
      before: null, after: buildMedicalResultSnapshot({ ...resultRow, visitId: visit.id }),
    });

    // 5. Create AI Model, AiDiagnosis, AiQuality
    const aiModel = await prisma.aiModelRegistry.create({
      data: { modelName: 'Delete Simulation AI Model', modelVersion: '4.0', ipHashEncrypted: 'ip-enc-v40', ipHashPlain: 'ip-plain-v40', createdBy: admin.id, status: 'ACTIVE' },
    });

    const aiDiag = await prisma.aiDiagnosis.create({
      data: {
        aiModelId: aiModel.id, patientId: patient.id, visitId: visit.id,
        prompt: 'Delete simulation AI prompt', result: '{"dengueProbability": 0.97}',
        confidence: 0.97, status: 'DOCTOR_REVIEWED', reviewedByDoctorId: doctor.id, doctorFeedback: 'Confirmed AI result',
      },
    });
    await audit.recordV2({
      entity: 'AiDiagnosis', entityId: aiDiag.id, action: 'CREATE', actorId: doctorUser.id,
      before: null, after: buildAiDiagnosisSnapshot(aiDiag),
    });

    const aiQuality = await prisma.aiQuality.create({
      data: {
        doctorId: doctor.id, aiModelId: aiModel.id, aiDiagnosisId: aiDiag.id,
        doctorConclusionAboutModel: 'Delete simulation quality rating - 97% accuracy', trustablePercent: 97.0,
      },
    });
    await audit.recordV2({
      entity: 'AiQuality', entityId: aiQuality.id, action: 'AI_MODEL_RATED', actorId: doctorUser.id,
      before: null, after: buildAiQualitySnapshot(aiQuality),
    });

    // 6. Create MedicalConclusion
    const conclusionData = {
      visitId: visit.id, doctorId: doctor.id, aiDiagnosisId: aiDiag.id,
      finalDiagnosis: 'Delete simulation final diagnosis - Sot xuat huyet Dengue',
      treatmentPlan: 'Delete simulation treatment plan - Truyen dich & theo doi',
      prescription: 'Paracetamol 500mg', followUpNote: 'Tai kham 24h', doctorNote: 'On dinh',
    };
    const integrity = audit.hashSnapshot({ ...conclusionData, patientCode: patient.patientCode });
    const conclusion = await prisma.medicalConclusion.create({
      data: { ...conclusionData, hash256: integrity.hash, dataSalt: integrity.salt },
    });
    await audit.recordV2({
      entity: 'MedicalConclusion', entityId: conclusion.id, action: 'CREATE', actorId: doctorUser.id,
      before: null, after: buildMedicalConclusionSnapshot({ ...conclusion, visit: { patient } }),
    });

    // 7. Verify Batch Anchored Tier-A
    const latestBatch = await prisma.auditBatch.findFirstOrThrow({ orderBy: { batchId: 'desc' } });
    expect(latestBatch.status).toBe('ANCHORED');

    // 8. EXECUTE HARD DELETE ON ALL 7 RECORDS FROM POSTGRESQL!
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.audit_recovery_authorized = 'true'`;
      await tx.medicalResultFile.deleteMany({ where: { resultId: resultRow.id } });
      await tx.medicalResult.delete({ where: { id: resultRow.id } });
      await tx.medicalOrder.delete({ where: { id: medicalOrder.id } });
      await tx.aiQuality.delete({ where: { id: aiQuality.id } });
      await tx.medicalConclusion.delete({ where: { id: conclusion.id } });
      await tx.appointment.delete({ where: { id: appointment.id } });
      await tx.aiDiagnosis.delete({ where: { id: aiDiag.id } });
    });

    // Verify DB records are 100% GONE (returns null)
    expect(await prisma.medicalResult.findUnique({ where: { id: resultRow.id } })).toBeNull();
    expect(await prisma.medicalOrder.findUnique({ where: { id: medicalOrder.id } })).toBeNull();
    expect(await prisma.aiQuality.findUnique({ where: { id: aiQuality.id } })).toBeNull();
    expect(await prisma.medicalConclusion.findUnique({ where: { id: conclusion.id } })).toBeNull();
    expect(await prisma.appointment.findUnique({ where: { id: appointment.id } })).toBeNull();
    expect(await prisma.aiDiagnosis.findUnique({ where: { id: aiDiag.id } })).toBeNull();

    // 9. PREVIEW RECREATION STATUS -> Expect MISSING & RECREATE
    const preview = await entityRecovery.previewMany([
      { entity: 'AiDiagnosis', entityId: aiDiag.id },
      { entity: 'Appointment', entityId: appointment.id },
      { entity: 'MedicalOrder', entityId: medicalOrder.id },
      { entity: 'MedicalResult', entityId: resultRow.id },
      { entity: 'AiQuality', entityId: aiQuality.id },
      { entity: 'MedicalConclusion', entityId: conclusion.id },
    ]);
    expect(preview.items).toHaveLength(6);
    expect(preview.items.every((item) => item.state === 'MISSING' && item.operation === 'RECREATE')).toBe(true);

    // 10. RECREATE ALL DELETED ENTITIES FROM IPFS + BLOCKCHAIN
    const recreationResult = await entityRecovery.recoverMany(
      [
        { entity: 'AiDiagnosis', entityId: aiDiag.id },
        { entity: 'Appointment', entityId: appointment.id },
        { entity: 'MedicalOrder', entityId: medicalOrder.id },
        { entity: 'MedicalResult', entityId: resultRow.id },
        { entity: 'AiQuality', entityId: aiQuality.id },
        { entity: 'MedicalConclusion', entityId: conclusion.id },
      ],
      admin.id,
      'Recreate all hard-deleted clinical entities from IPFS',
    );

    expect(recreationResult).toMatchObject({ requested: 6, recovered: 6, failed: 0 });

    // 11. VERIFY 100% DELETED DATA RECREATED IN DB WITH EVERY FIELD & FILE INTACT!
    const recreatedDiag = await prisma.aiDiagnosis.findUniqueOrThrow({ where: { id: aiDiag.id } });
    expect(recreatedDiag.confidence).toBe(0.97);
    expect(recreatedDiag.status).toBe('DOCTOR_REVIEWED');

    const recreatedAppt = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(recreatedAppt.appointmentCode).toBe(appointment.appointmentCode);
    expect(recreatedAppt.status).toBe('CONFIRMED');

    const recreatedOrder = await prisma.medicalOrder.findUniqueOrThrow({ where: { id: medicalOrder.id } });
    expect(recreatedOrder.orderCode).toBe(medicalOrder.orderCode);
    expect(recreatedOrder.clinicalNote).toBe('Delete simulation clinical note for Dengue test');

    const recreatedResult = await prisma.medicalResult.findUniqueOrThrow({ where: { id: resultRow.id }, include: { files: true } });
    expect(recreatedResult.note).toBe('Delete simulation result note - Platelets 105 G/L');
    expect(recreatedResult.files).toHaveLength(2);
    expect(recreatedResult.files[0]).toMatchObject({
      fileName: 'del_result_1.pdf', originalName: 'DelResult1.pdf', mimeType: 'application/pdf', size: 1500000,
      storageProvider: 'CLOUDINARY', url: 'https://res.cloudinary.com/test/raw/upload/v1/del_result_1.pdf',
    });
    expect(recreatedResult.files[1]).toMatchObject({
      fileName: 'del_result_2.png', originalName: 'DelResult2.png', mimeType: 'image/png', size: 2800000,
      storageProvider: 'CLOUDINARY', url: 'https://res.cloudinary.com/test/image/upload/v1/del_result_2.png',
    });

    const recreatedQuality = await prisma.aiQuality.findUniqueOrThrow({ where: { id: aiQuality.id } });
    expect(recreatedQuality.trustablePercent).toBe(97.0);
    expect(recreatedQuality.doctorConclusionAboutModel).toBe('Delete simulation quality rating - 97% accuracy');

    const recreatedConclusion = await prisma.medicalConclusion.findUniqueOrThrow({ where: { id: conclusion.id } });
    expect(recreatedConclusion.finalDiagnosis).toBe('Delete simulation final diagnosis - Sot xuat huyet Dengue');
    expect(recreatedConclusion.treatmentPlan).toBe('Delete simulation treatment plan - Truyen dich & theo doi');
  });

  async function seedTrustedPatientChange() {
    const admin = await prisma.user.create({
      data: {
        username: `tamper-admin-${Date.now()}-${Math.random()}`,
        email: `tamper-${Date.now()}-${Math.random()}@test.local`,
        role: 'ADMIN',
        status: 'ACTIVE',
        firstLogin: false,
      },
    });
    const patient = await prisma.patient.create({
      data: {
        patientCode: `BN-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        fullName: 'Nguyen Van A',
        gender: 'MALE',
        birthDate: new Date('1990-01-01T00:00:00.000Z'),
        citizenId: `${Date.now()}`.slice(-12).padStart(12, '0'),
        phone: '0900000000',
        address: 'Original address',
      },
    });
    const before = buildPatientSnapshot(patient);
    const trustedName = 'Nguyen Van A Updated';
    const trustedPhone = '0911111111';
    const updated = await prisma.patient.update({
      where: { id: patient.id },
      data: { fullName: trustedName, phone: trustedPhone },
    });
    await audit.recordV2({
      entity: 'Patient',
      entityId: patient.id,
      action: 'UPDATE',
      actorId: admin.id,
      before,
      after: buildPatientSnapshot(updated),
    });
    return { adminId: admin.id, patientId: patient.id, trustedName, trustedPhone };
  }

  async function tamperPatient(patientId: string) {
    await prisma.patient.update({
      where: { id: patientId },
      data: { fullName: 'Hacker Modified Patient', phone: '0999999999' },
    });
  }

  async function overwriteAuditContent(id: string, data: { afterHash?: string; entryHash?: string }) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.audit_recovery_authorized', 'true', true)`;
      await tx.blockchainLogger.update({ where: { id }, data });
    });
  }

  async function deleteAuditContent(id: string) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.audit_recovery_authorized', 'true', true)`;
      await tx.blockchainLogger.delete({ where: { id } });
    });
  }

  async function waitForRecoveryStatus(batchId: number, status: string) {
    await waitUntil(async () => (await prisma.auditRecovery.findFirst({
      where: { batchId },
      orderBy: { createdAt: 'desc' },
    }))?.status === status, `audit recovery status ${status}`);
  }


  async function waitUntil(predicate: () => Promise<boolean>, label: string) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (await predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out waiting for ${label}.`);
  }


  async function waitForAppendOnlyTrigger() {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'trg_blockchain_logger_append_only'
        ) AS "exists"
      `;
      if (rows[0]?.exists) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('BlockchainLogger append-only trigger was not created in time.');
  }
});
