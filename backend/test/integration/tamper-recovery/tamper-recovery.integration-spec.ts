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
import { AuditKafkaService } from '../../../src/infrastructure/audit/audit-kafka.service';
import { buildPatientSnapshot } from '../../../src/modules/patient/domain/patient-snapshot';
import { buildAiDiagnosisSnapshot } from '../../../src/modules/clinical-decision/domain/ai-diagnosis-snapshot';
import { buildStaffSnapshot } from '../../../src/modules/staff/domain/staff-snapshot';
import { AdministrativeLifecycleService } from '../../../src/common/lifecycle/administrative-lifecycle.service';

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
        "AuditRecoveryStageRow",
        "AuditRecovery",
        "AuditKafkaReceipt",
        "AuditOutbox",
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

  it('publishes the transactional outbox to real Kafka and projects duplicate events idempotently', async () => {
    const fixture = await seedTrustedPatientChange();
    const outbox = await prisma.auditOutbox.findFirstOrThrow({ orderBy: { createdAt: 'desc' } });
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const previous = {
      enabled: process.env.KAFKA_ENABLED,
      group: process.env.KAFKA_AUDIT_GROUP_ID,
      tierA: process.env.KAFKA_AUDIT_TIER_A_TOPIC,
      tierB: process.env.KAFKA_AUDIT_TIER_B_TOPIC,
    };
    process.env.KAFKA_ENABLED = 'true';
    process.env.KAFKA_AUDIT_GROUP_ID = `kltn-audit-integration-${suffix}`;
    process.env.KAFKA_AUDIT_TIER_A_TOPIC = `kltn.audit.integration.a.${suffix}`;
    process.env.KAFKA_AUDIT_TIER_B_TOPIC = outbox.topic = `kltn.audit.integration.b.${suffix}`;
    await prisma.auditOutbox.update({ where: { id: outbox.id }, data: { topic: outbox.topic } });

    const firstRun = new AuditKafkaService(prisma);
    try {
      await firstRun.onApplicationBootstrap();
      await waitForOutboxStatus(outbox.id, 'PUBLISHED');
      await waitForKafkaReceipt(outbox.eventId);
      expect(await prisma.auditKafkaReceipt.count({ where: { eventId: outbox.eventId } })).toBe(1);
    } finally {
      await firstRun.onModuleDestroy();
    }

    await prisma.auditOutbox.update({
      where: { id: outbox.id },
      data: { status: 'PENDING', publishedAt: null, lastError: null },
    });
    process.env.KAFKA_AUDIT_GROUP_ID = `kltn-audit-integration-restart-${suffix}`;
    const restarted = new AuditKafkaService(prisma);
    try {
      await restarted.onApplicationBootstrap();
      await waitForOutboxStatus(outbox.id, 'PUBLISHED');
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(await prisma.auditKafkaReceipt.count({ where: { eventId: outbox.eventId } })).toBe(1);
      expect(await prisma.blockchainLogger.count({ where: { eventId: outbox.eventId } })).toBe(1);
      expect(await prisma.blockchainLogger.findFirstOrThrow({ where: { patientId: fixture.patientId } })).toBeDefined();
    } finally {
      await restarted.onModuleDestroy();
      restoreEnv('KAFKA_ENABLED', previous.enabled);
      restoreEnv('KAFKA_AUDIT_GROUP_ID', previous.group);
      restoreEnv('KAFKA_AUDIT_TIER_A_TOPIC', previous.tierA);
      restoreEnv('KAFKA_AUDIT_TIER_B_TOPIC', previous.tierB);
    }
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
      await tx.auditOutbox.deleteMany({ where: { auditLogId: id } });
      await tx.auditKafkaReceipt.deleteMany({ where: { auditLogId: id } });
      await tx.blockchainLogger.delete({ where: { id } });
    });
  }

  async function waitForRecoveryStatus(batchId: number, status: string) {
    await waitUntil(async () => (await prisma.auditRecovery.findFirst({
      where: { batchId },
      orderBy: { createdAt: 'desc' },
    }))?.status === status, `audit recovery status ${status}`);
  }

  async function waitForOutboxStatus(id: string, status: string) {
    await waitUntil(async () => (await prisma.auditOutbox.findUnique({ where: { id } }))?.status === status, `outbox status ${status}`);
  }

  async function waitForKafkaReceipt(eventId: string) {
    await waitUntil(async () => Boolean(await prisma.auditKafkaReceipt.findUnique({ where: { eventId } })), 'Kafka receipt');
  }

  async function waitUntil(predicate: () => Promise<boolean>, label: string) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (await predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out waiting for ${label}.`);
  }

  function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
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
