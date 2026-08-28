import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../src/infrastructure/prisma/prisma.service';
import { BlockchainService } from '../../../src/infrastructure/blockchain/blockchain.service';
import { AuditAnchorService } from '../../../src/infrastructure/audit';
import { AuditArtifactService } from '../../../src/infrastructure/audit';
import { AuditLoggerService } from '../../../src/infrastructure/audit';
import { AuditRecoveryService } from '../../../src/infrastructure/audit';
import { AuditRecoveryCryptoService } from '../../../src/infrastructure/audit';
import { VerifiedAuditBundleReader } from '../../../src/infrastructure/audit';
import { ClinicalAuditTrustService } from '../../../src/infrastructure/audit';
import { AuditPageIntegrityService } from '../../../src/infrastructure/audit';
import { EntityRecoveryService } from '../../../src/infrastructure/audit';
import { EntityRecreationService } from '../../../src/infrastructure/audit';
import { IpfsArtifactService } from '../../../src/infrastructure/audit';
import { buildPatientSnapshot } from '../../../src/modules/patient/domain/patient-snapshot';
import { buildDepartmentSnapshot } from '../../../src/modules/department/domain/department-snapshot';
import { buildUnifiedDoctorSnapshot } from '../../../src/modules/doctor/domain/doctor-snapshot';
import { buildAiModelSnapshot } from '../../../src/modules/ai-model/domain/ai-model-snapshot';
import { buildAiDiagnosisSnapshot } from '../../../src/modules/clinical-decision/domain/ai-diagnosis-snapshot';
import { buildStaffSnapshot } from '../../../src/modules/staff/domain/staff-snapshot';
import { buildMedicalOrderSnapshot } from '../../../src/modules/medical-order/domain/medical-order-snapshot';
import { buildMedicalResultSnapshot } from '../../../src/modules/medical-order/domain/medical-result-snapshot';
import { buildAppointmentSnapshot } from '../../../src/modules/patient-portal/domain/appointment-snapshot';
import { buildAiQualitySnapshot } from '../../../src/modules/ai-model/domain/ai-quality-snapshot';
import { buildVisitSnapshot } from '../../../src/modules/visit/domain/visit-snapshot';
import { buildMedicalConclusionSnapshot } from '../../../src/modules/clinical-decision/domain/medical-conclusion-snapshot';
import { AdministrativeLifecycleService } from '../../../src/common/lifecycle/administrative-lifecycle.service';
import { RateAiModelUseCase } from '../../../src/modules/ai-model/application/use-cases/rate-ai-model.use-case';
import { GetAiModelStatsUseCase } from '../../../src/modules/ai-model/application/use-cases/get-ai-model-stats.use-case';
import { CreateAiModelUseCase } from '../../../src/modules/ai-model/application/use-cases/create-ai-model.use-case';
import { UpdateAiModelUseCase } from '../../../src/modules/ai-model/application/use-cases/update-ai-model.use-case';
import { CreateAiModelDto, UpdateAiModelDto, RateAiModelDto } from '../../../src/modules/ai-model/dto/ai-model.dto';
import { PrismaAiModelRepository } from '../../../src/modules/ai-model/infrastructure/prisma/prisma-ai-model.repository';
import { AiModelCryptoAdapter } from '../../../src/modules/ai-model/infrastructure/adapters/ai-model-crypto.adapter';
import { HttpAiModelConnectivityAdapter } from '../../../src/modules/ai-model/infrastructure/adapters/http-ai-model-connectivity.adapter';
import { BlockchainAiModelIntegrityAnchor } from '../../../src/modules/ai-model/infrastructure/adapters/blockchain-ai-model-integrity.anchor';

import { CreateDepartmentUseCase } from '../../../src/modules/department/application/use-cases/create-department.use-case';
import { UpdateDepartmentUseCase } from '../../../src/modules/department/application/use-cases/update-department.use-case';
import { CreateDepartmentDto, UpdateDepartmentDto } from '../../../src/modules/department/dto/department.dto';
import { PrismaDepartmentRepository } from '../../../src/modules/department/infrastructure/prisma/prisma-department.repository';
import { BlockchainDepartmentIntegrityAnchor } from '../../../src/modules/department/infrastructure/adapters/blockchain-department-integrity.anchor';
import { DepartmentValidator } from '../../../src/modules/department/application/services/department.validator';

import { CreateDoctorWithStaffUseCase } from '../../../src/modules/doctor/application/use-cases/create-doctor-with-staff.use-case';
import { UpdateDoctorUseCase } from '../../../src/modules/doctor/application/use-cases/update-doctor.use-case';
import { CreateDoctorWithStaffDto } from '../../../src/modules/doctor/dto/doctor.dto';
import { PrismaDoctorRepository } from '../../../src/modules/doctor/infrastructure/prisma/prisma-doctor.repository';
import { BlockchainDoctorIntegrityAnchor } from '../../../src/modules/doctor/infrastructure/adapters/blockchain-doctor-integrity.anchor';

import { CreatePatientUseCase } from '../../../src/modules/patient/application/use-cases/create-patient.use-case';
import { CreatePatientDto } from '../../../src/modules/patient/dto/patient.dto';
import { PrismaPatientRepository } from '../../../src/modules/patient/infrastructure/prisma/prisma-patient.repository';
import { AuditPatientIntegrityAnchor } from '../../../src/modules/patient/infrastructure/adapters/audit-patient-integrity.anchor';

import { CreateVisitUseCase } from '../../../src/modules/visit/application/use-cases/create-visit.use-case';
import { CreateVisitDto } from '../../../src/modules/visit/dto/visit.dto';
import { PrismaVisitRepository } from '../../../src/modules/visit/infrastructure/prisma/prisma-visit.repository';
import { BlockchainVisitIntegrityAnchor } from '../../../src/modules/visit/infrastructure/adapters/blockchain-visit-integrity.anchor';

import { CreateMedicalConclusionUseCase } from '../../../src/modules/clinical-decision/application/use-cases/create-medical-conclusion.use-case';
import { CreateMedicalConclusionDto } from '../../../src/modules/clinical-decision/dto/clinical-decision.dto';
import { PrismaClinicalDecisionRepository } from '../../../src/modules/clinical-decision/infrastructure/prisma/prisma-clinical-decision.repository';
import { BlockchainMedicalConclusionIntegrityAnchor } from '../../../src/modules/clinical-decision/infrastructure/adapters/blockchain-medical-conclusion-integrity.anchor';
import { ClinicalDecisionPolicy } from '../../../src/modules/clinical-decision/application/policies/clinical-decision.policy';
import * as crypto from 'crypto';
import { JsonRpcProvider } from 'ethers';

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
  let rpc: JsonRpcProvider;
  let cleanChainSnapshotId: string;

function createAnchorService(prisma: PrismaService, blockchain: BlockchainService, artifacts: AuditArtifactService) {
  const alerts = new AuditTelegramAlertService();
  const verifier = new AuditChainVerifier(prisma, blockchain, alerts);
  const proofs = new AuditProofService(prisma, blockchain);
  const publisher = new AuditBatchArtifactPublisher(prisma, artifacts);
  const resumer = new AuditPendingBatchResumer(prisma, blockchain, publisher, alerts);
  const preparer = new AuditBatchPreparer(prisma, blockchain, verifier);
  return new AuditAnchorService(prisma, blockchain, alerts, verifier, proofs, publisher, resumer, preparer);
}

function createRecoveryService(
  prisma: PrismaService,
  blockchain: BlockchainService,
  artifacts: AuditArtifactService,
  verifiedReader: VerifiedAuditBundleReader,
  audit: AuditLoggerService,
  entityRecovery?: EntityRecoveryService,
) {
  const scanner = new AuditBatchScanner(prisma, blockchain);
  const restorer = new AuditBatchRestorer(prisma, blockchain, artifacts, audit);
  const watchdog = new AuditWatchdogScheduler(blockchain, scanner, restorer);
  const deepScan = new AuditDeepScanService(blockchain, scanner, restorer, entityRecovery);
  return new AuditRecoveryService(prisma, blockchain, verifiedReader, watchdog, deepScan, restorer);
}

  beforeAll(async () => {
    prisma = new PrismaService();
    blockchain = new BlockchainService();
    ipfs = new IpfsArtifactService();
    const recoveryCrypto = new AuditRecoveryCryptoService();
    artifacts = new AuditArtifactService(recoveryCrypto, ipfs);
    anchor = createAnchorService(prisma, blockchain, artifacts);
    audit = new AuditLoggerService(prisma, anchor);
    const verifiedBundleReader = new VerifiedAuditBundleReader(blockchain, artifacts);
    const entityRecreation = new EntityRecreationService(prisma, audit, verifiedBundleReader);
    entityRecovery = new EntityRecoveryService(prisma, audit, anchor, verifiedBundleReader, entityRecreation);
    batchRecovery = createRecoveryService(prisma, blockchain, artifacts, verifiedBundleReader, audit, entityRecovery);
    lifecycle = new AdministrativeLifecycleService(prisma, audit, entityRecovery);

    await prisma.onModuleInit();
    await blockchain.onModuleInit();
    anchor.onModuleInit();
    await waitForAppendOnlyTrigger();
    rpc = new JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
    cleanChainSnapshotId = await rpc.send('evm_snapshot', []);
  });

  beforeEach(async () => {
    anchor.clearCache();
    await rpc.send('evm_revert', [cleanChainSnapshotId]);
    cleanChainSnapshotId = await rpc.send('evm_snapshot', []);
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
    await rpc.destroy();
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

  it('recovers a batch with offset sequence range (fromSeq: 2, toSeq: 2) after local DB wipe (Batch #19 scenario)', async () => {
    const patient1 = await prisma.patient.create({
      data: {
        patientCode: `BN-B19-1-${Date.now()}`,
        fullName: 'Benh Nhan Batch 19 Initial',
        gender: 'MALE',
        birthDate: new Date('1990-01-01'),
        phone: '0900000019',
      },
    });
    await audit.recordV2({
      entity: 'Patient',
      entityId: patient1.id,
      action: 'CREATE',
      after: { fullName: patient1.fullName },
    });
    const anchoredBatch1 = await anchor.anchorNow();
    expect(anchoredBatch1.committed).toBe(true);

    const admin = await prisma.user.create({
      data: {
        username: `b19-admin-${Date.now()}`,
        email: `b19-admin-${Date.now()}@test.local`,
        role: 'ADMIN', status: 'ACTIVE', firstLogin: false,
      },
    });
    const log2 = await audit.recordV2({
      entity: 'Patient',
      entityId: patient1.id,
      action: 'UPDATE',
      actorId: admin.id,
      after: { fullName: 'Patient 1 Updated' },
    });
    expect(log2.seq).toBe(2);

    const anchoredBatch2 = await anchor.anchorNow();
    expect(anchoredBatch2.committed).toBe(true);
    const batch2Id = anchoredBatch2.batchId!;

    const cp2 = await blockchain.getAuditCheckpoint(batch2Id);
    expect(cp2.fromSeq).toBe(2);
    expect(cp2.toSeq).toBe(2);
    expect(cp2.leafCount).toBe(1);

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.audit_recovery_authorized', 'true', true)`;
      await tx.blockchainLogger.deleteMany({ where: { batchId: anchoredBatch1.batchId } });
      await tx.blockchainLogger.deleteMany({ where: { batchId: batch2Id } });
      await tx.auditBatch.update({
        where: { batchId: batch2Id },
        data: { fromSeq: null, toSeq: null },
      });
    });

    expect(await prisma.blockchainLogger.count({ where: { batchId: batch2Id } })).toBe(0);

    const recovered = await batchRecovery.recover(
      batch2Id,
      admin.id,
      'Recovery test for Batch #19 offset sequence range (fromSeq=2, toSeq=2)',
    );

    expect(recovered).toMatchObject({
      batchId: batch2Id,
      status: 'RECOVERED',
      restoredCount: 1,
    });

    const restoredBatch = await prisma.auditBatch.findUniqueOrThrow({ where: { batchId: batch2Id } });
    expect(restoredBatch.fromSeq).toBe(2);
    expect(restoredBatch.toSeq).toBe(2);
    expect(restoredBatch.leafCount).toBe(1);

    const restoredLog = await prisma.blockchainLogger.findUniqueOrThrow({ where: { id: log2.id } });
    expect(restoredLog.seq).toBe(2);
    expect(restoredLog.entryHash).toBe(log2.entryHash);
    expect(restoredLog.onChainStatus).toBe('ANCHORED');
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
    const restartedDuringOutage = createAnchorService(prisma, blockchain, artifacts);
    restartedDuringOutage.onModuleInit();

    const commitSpy = jest
      .spyOn(blockchain, 'commitAuditCheckpoint')
      .mockResolvedValueOnce(null);
    const unavailable = await restartedDuringOutage.anchorNow();
    expect(unavailable.committed).toBe(false);

    const prepared = await prisma.auditBatch.findUniqueOrThrow({ where: { batchId: unavailable.batchId! } });
    expect(prepared.status).toBe('ARTIFACT_READY');
    expect(prepared.artifactUri).toMatch(/^ipfs:\/\//);
    expect(await blockchain.getAuditCheckpoint(prepared.batchId)).toMatchObject({ committed: false });
    commitSpy.mockRestore();
    restartedDuringOutage.onModuleDestroy();

    // Network and server are available again. Startup/retry cycles resume the same batch rather
    // than creating a second artifact or checkpoint.
    const restartedAfterRecovery = createAnchorService(prisma, blockchain, artifacts);
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

  it('executes full AI Model diagnosis, conclusion, rating, detects tampering and recreates on deletion', async () => {
    // 1. Setup UseCases and Repositories
    const deptRepo = new PrismaDepartmentRepository(prisma);
    const deptAnchor = new BlockchainDepartmentIntegrityAnchor(prisma, audit, anchor);
    const deptValidator = new DepartmentValidator(deptRepo);
    const createDepartmentUseCase = new CreateDepartmentUseCase(deptRepo, deptAnchor, deptValidator);
    const updateDepartmentUseCase = new UpdateDepartmentUseCase(deptRepo, deptAnchor, deptValidator, entityRecovery);

    const doctorRepo = new PrismaDoctorRepository(prisma);
    const doctorAnchor = new BlockchainDoctorIntegrityAnchor(prisma, audit, anchor);
    const nullMailer = { sendTemporaryPassword: async () => {} };
    const createDoctorWithStaffUseCase = new CreateDoctorWithStaffUseCase(doctorRepo, doctorAnchor, nullMailer as any);
    const updateDoctorUseCase = new UpdateDoctorUseCase(doctorRepo, doctorAnchor, entityRecovery);

    const aiModelRepo = new PrismaAiModelRepository(prisma);
    const aiModelCrypto = new AiModelCryptoAdapter();
    const aiModelConnectivity = new HttpAiModelConnectivityAdapter();
    const aiModelAnchor = new BlockchainAiModelIntegrityAnchor(prisma, audit, anchor);
    const createAiModelUseCase = new CreateAiModelUseCase(aiModelRepo, aiModelCrypto, aiModelConnectivity, aiModelAnchor);
    const updateAiModelUseCase = new UpdateAiModelUseCase(aiModelRepo, aiModelCrypto, aiModelConnectivity, aiModelAnchor, entityRecovery);

    const patientRepo = new PrismaPatientRepository(prisma);
    const patientAnchor = new AuditPatientIntegrityAnchor(prisma, audit, anchor);
    const createPatientUseCase = new CreatePatientUseCase(patientRepo, patientAnchor);

    const visitRepo = new PrismaVisitRepository(prisma);
    const pageIntegrity = new AuditPageIntegrityService(prisma, blockchain);
    const visitIntegrity = new BlockchainVisitIntegrityAnchor(prisma, audit, pageIntegrity);
    const nullNotification = { createNotification: async () => {} };
    const clinicalTrust = new ClinicalAuditTrustService(prisma, anchor);
    const createVisitUseCase = new CreateVisitUseCase(
      visitRepo,
      visitIntegrity,
      prisma,
      nullNotification as any,
      audit,
      clinicalTrust,
    );

    const clinicalRepo = new PrismaClinicalDecisionRepository(prisma);
    const clinicalAnchor = new BlockchainMedicalConclusionIntegrityAnchor(prisma, audit, anchor);
    const clinicalPolicy = new ClinicalDecisionPolicy();
    const createMedicalConclusionUseCase = new CreateMedicalConclusionUseCase(
      clinicalRepo,
      clinicalAnchor,
      clinicalPolicy,
      visitIntegrity,
      clinicalTrust,
    );

    const rateAiModelUseCase = new RateAiModelUseCase(prisma, audit);
    const getAiModelStatsUseCase = new GetAiModelStatsUseCase(prisma, audit, anchor);

    // 2. Setup Admin User
    const admin = await prisma.user.create({
      data: {
        username: `ai-admin-${Date.now()}-${Math.random()}`,
        email: `admin-${Date.now()}@test.local`,
        role: 'ADMIN',
        status: 'ACTIVE',
        firstLogin: false,
      },
    });

    // 3. Department Flow: Create & Update via API DTOs (CreateDepartmentDto, UpdateDepartmentDto)
    const createDeptDto: CreateDepartmentDto = {
      departmentCode: `PK-${Date.now().toString().slice(-4)}`,
      name: `Khoa Kham Tim Mach ${Date.now().toString().slice(-4)}`,
      floor: '2A',
      type: 'EXAMINATION',
      canReceiveOrders: false,
      status: 'ACTIVE',
      description: 'Phong kham va dieu tri benh ly tim mach chuyen sau',
    };
    const dept = await createDepartmentUseCase.execute(createDeptDto, admin.id);
    expect(dept.departmentCode).toBe(createDeptDto.departmentCode);
    expect(dept.floor).toBe('2A');

    const updateDeptDto: UpdateDepartmentDto = {
      description: 'Phong kham va dieu tri benh ly tim mach, mach vanh va ho hap',
    };
    const updatedDept = await updateDepartmentUseCase.execute(dept.id, updateDeptDto, admin.id);
    expect(updatedDept.description).toBe(updateDeptDto.description);

    // 4. Doctor & Staff Flow: Create & Update via API DTOs (CreateDoctorWithStaffDto, UpdateDoctorDto)
    const createDocDto: CreateDoctorWithStaffDto = {
      username: `drnguyen${Date.now().toString().slice(-4)}`,
      email: `dr.nguyen.${Date.now()}@hospital.local`,
      fullName: 'BS Nguyen Van AI Test',
      phone: '0981234567',
      gender: 'Nam',
      citizenId: `${Date.now()}`.slice(-12).padStart(12, '8'),
      birthDate: '1982-06-15',
      address: 'Ha Noi, Viet Nam',
      avatarUrl: 'https://cdn.hospital.local/avatars/dr-nguyen.jpg',
      departmentId: dept.id,
      position: 'Bac si dieu tri',
      specialty: 'CARDIOLOGY',
      licenseNumber: `CCHN-${Date.now().toString().slice(-6)}`,
      qualification: 'BS CKI',
      yearsExperience: 12,
    };
    const doctor = await createDoctorWithStaffUseCase.execute(createDocDto, admin.id);
    expect(doctor.staffProfile.fullName).toBe('BS Nguyen Van AI Test');
    expect(doctor.specialty).toBe('CARDIOLOGY');

    const updateDocDto = {
      qualification: 'BS CKII',
      yearsExperience: 15,
    };
    const updatedDoc = await updateDoctorUseCase.execute(doctor.id, updateDocDto, admin.id);
    expect(updatedDoc.qualification).toBe('BS CKII');
    expect(updatedDoc.yearsExperience).toBe(15);

    // 5. AI Model Flow: Create & Update via API DTOs (CreateAiModelDto, UpdateAiModelDto)
    const createAiModelDto: CreateAiModelDto = {
      modelName: 'CardioSmart Diagnostic Pro',
      modelVersion: '3.2.0',
      recommendedSpecialty: 'CARDIOLOGY',
      type: 'API',
      provider: 'local',
      apiEndpoint: 'http://localhost:8000/v1/cardio-predict',
      secretOrIpHash: 'api-key-ai-model-test-secret',
      description: 'Mo hinh AI ho tro chan doan som benh ly mach vanh va loan nhip tim',
    };
    const aiModel = await createAiModelUseCase.execute(createAiModelDto, admin.id);
    expect(aiModel.modelName).toBe('CardioSmart Diagnostic Pro');
    expect(aiModel.modelVersion).toBe('3.2.0');

    const updateAiModelDto: UpdateAiModelDto = {
      description: 'Mo hinh AI ho tro chan doan som benh ly mach vanh, loan nhip tim va thieu mau cuc bo',
    };
    const updatedAiModel = await updateAiModelUseCase.execute(aiModel.id, updateAiModelDto, admin.id);
    expect(updatedAiModel.description).toBe(updateAiModelDto.description);

    // 6. Patient Flow: Create via API DTO (CreatePatientDto)
    const createPatientDto: CreatePatientDto = {
      fullName: 'Le Thi Benh Nhan AI',
      gender: 'FEMALE',
      birthDate: '1990-08-20',
      citizenId: `${Date.now()}`.slice(-12).padStart(12, '9'),
      phone: '0912345678',
      address: 'Hai Phong, Viet Nam',
    };
    const patient = await createPatientUseCase.execute(createPatientDto, admin.id);
    expect(patient.fullName).toBe('Le Thi Benh Nhan AI');

    // 7. Visit Intake Flow: Create via API DTO (CreateVisitDto)
    const createVisitDto: CreateVisitDto = {
      patientId: patient.id,
      departmentId: dept.id,
      staffId: doctor.staffProfile.id,
    };
    const doctorUserId = doctor.staffProfile.userId;
    const visitResult = (await createVisitUseCase.execute(createVisitDto, {
      sub: doctorUserId,
      role: 'DOCTOR',
      username: createDocDto.username,
    } as any)) as any;
    const visit = visitResult;
    expect(visit.id).toBeDefined();

    // 8. AI Diagnosis Record: Generated & Reviewed by Doctor
    const aiDiag = await prisma.aiDiagnosis.create({
      data: {
        aiModelId: aiModel.id,
        patientId: patient.id,
        visitId: visit.id,
        prompt: 'Trieu chung: dau nguc trai lan len vai, dien tam do ST chenh len',
        result: JSON.stringify({ diagnosis: 'Nhoi mau co tim cap ST chenh len', probability: 0.98, urgency: 'EMERGENCY' }),
        confidence: 0.98,
        status: 'DOCTOR_REVIEWED',
        reviewedByDoctorId: doctor.id,
        doctorFeedback: 'Dong y voi chan doan cua AI - Can can thiep mach vanh khan cap',
      },
    });
    await audit.recordV2({
      entity: 'AiDiagnosis',
      entityId: aiDiag.id,
      action: 'CREATE',
      actorId: doctorUserId,
      before: null,
      after: buildAiDiagnosisSnapshot(aiDiag),
    });

    // 9. Clinical Decision Flow: Issue Medical Conclusion via API DTO (CreateMedicalConclusionDto)
    await prisma.visit.update({ where: { id: visit.id }, data: { status: 'WAITING_CONCLUSION' } });

    const conclusionDto: CreateMedicalConclusionDto = {
      visitId: visit.id,
      aiDiagnosisId: aiDiag.id,
      finalDiagnosis: 'Nhoi mau co tim cap thanh truoc (STEMI)',
      treatmentPlan: 'Chuyen phong Catheter can thiep mach vanh qua da khau cap (PCI)',
      prescription: 'Aspirin 300mg, Clopidogrel 300mg, Heparin khong phan doan',
      followUpNote: 'Theo doi sat dien tim va men tim tai phong hoi suc cap cuu',
      doctorNote: 'Benh nhan da duoc giai thich tinh trang va dong y can thiep',
    };
    const conclusion: any = await createMedicalConclusionUseCase.execute(conclusionDto, doctorUserId);
    expect(conclusion.finalDiagnosis).toBe(conclusionDto.finalDiagnosis);

    // 10. AI Model Rating Flow: Doctor rates AI Model via API DTO (RateAiModelDto)
    const rateDto: RateAiModelDto = {
      aiDiagnosisId: aiDiag.id,
      satisfied: true,
      feedback: 'Model AI nhan dien dien tam do va trieu chung cuc ky chinh xac, giup xu tri kip thoi',
    };
    const quality = await rateAiModelUseCase.execute(
      aiModel.id,
      doctorUserId,
      rateDto.aiDiagnosisId,
      rateDto.satisfied,
      rateDto.feedback,
    );
    expect(quality).toBeDefined();
    expect(quality.trustablePercent).toBe(100);

    // 11. Blockchain Anchor: Seal all logs onto Merkle Batch + Smart Contract + IPFS
    const anchorResult = await anchor.anchorNow();
    expect(anchorResult.committed).toBe(true);

    // 12. VERIFY INITIAL UNTAMPERED STATE
    // 12a. Check AI Model Stats UseCase
    const initialStats = await getAiModelStatsUseCase.execute();
    const evaluatedModel = initialStats.allModels.find((m) => m.id === aiModel.id);
    expect(evaluatedModel).toBeDefined();
    expect(evaluatedModel?.totalRatings).toBe(1);
    expect(evaluatedModel?.positiveRatings).toBe(1);
    expect(evaluatedModel?.averageAccuracy).toBe(100);
    expect(evaluatedModel?.feedbacks).toHaveLength(0); // Only tampered feedbacks shown in tampered list

    // 12b. Check EntityRecoveryService warnings -> expect 0 warnings across all entities
    const warningsBeforeTamper = await entityRecovery.listWarnings();
    const qualityWarning = warningsBeforeTamper.items.find((w) => w.entity === 'AiQuality' && w.entityId === quality.id);
    expect(qualityWarning).toBeUndefined();

    // 12c. Check assertTrusted for AiQuality and AiModelRegistry
    await expect(entityRecovery.assertTrusted('AiQuality', quality.id)).resolves.not.toThrow();
    await expect(entityRecovery.assertTrusted('AiModelRegistry', aiModel.id)).resolves.not.toThrow();

    // 13. TAMPER SIMULATION: Hacker directly modifies Postgres DB
    await prisma.aiQuality.update({
      where: { id: quality.id },
      data: {
        trustablePercent: 0,
        doctorConclusionAboutModel: 'HACKER ALTERED DOCTOR FEEDBACK TO NEGATIVE',
      },
    });

    // 13a. Verify GetAiModelStatsUseCase detects TAMPERED status immediately
    const tamperedStats = await getAiModelStatsUseCase.execute();
    const tamperedModel = tamperedStats.allModels.find((m) => m.id === aiModel.id);
    expect(tamperedModel?.feedbacks).toHaveLength(1);
    expect(tamperedModel?.feedbacks[0].audit.status).toBe('TAMPERED');
    expect(tamperedModel?.feedbacks[0].audit.dbMatches).toBe(false);
    expect(tamperedModel?.feedbacks[0].audit.chainMatches).toBe(false);

    // 13b. Verify EntityRecoveryService detects TAMPERED
    const warningsAfterTamper = await entityRecovery.listWarnings();
    const tamperedQualityWarning = warningsAfterTamper.items.find((w) => w.entity === 'AiQuality' && w.entityId === quality.id);
    expect(tamperedQualityWarning).toBeDefined();
    expect(tamperedQualityWarning?.status).toBe('TAMPERED');
    expect(tamperedQualityWarning?.recoverable).toBe(true);

    // 13c. Verify assertTrusted throws ConflictException
    await expect(entityRecovery.assertTrusted('AiQuality', quality.id)).rejects.toThrow(ConflictException);

    // 13d. In-place Recovery: recover from blockchain anchor
    const recoverResult = await entityRecovery.recoverMany(
      [{ entity: 'AiQuality', entityId: quality.id }],
      admin.id,
      'Recovery of tampered AI quality evaluation via DTO flow',
    );
    expect(recoverResult.requested).toBe(1);
    expect(recoverResult.recovered).toBe(1);
    expect(recoverResult.failed).toBe(0);

    // 13e. Verify DB data and hashes are fully restored
    const restoredQuality = await prisma.aiQuality.findUniqueOrThrow({ where: { id: quality.id } });
    expect(restoredQuality.trustablePercent).toBe(100);
    expect(restoredQuality.doctorConclusionAboutModel).toBe(rateDto.feedback);

    // 13f. Re-verify with GetAiModelStatsUseCase -> back to VERIFIED
    const recoveredStats = await getAiModelStatsUseCase.execute();
    const recoveredModel = recoveredStats.allModels.find((m) => m.id === aiModel.id);
    expect(recoveredModel?.averageAccuracy).toBe(100);
    expect(recoveredModel?.feedbacks).toHaveLength(0);

    // 14. HARD-DELETION & IPFS RECREATION SIMULATION
    // Delete AiQuality row directly from DB
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.audit_recovery_authorized = 'true'`;
      await tx.aiQuality.delete({ where: { id: quality.id } });
    });
    expect(await prisma.aiQuality.findUnique({ where: { id: quality.id } })).toBeNull();

    // 14a. Preview recreation -> MISSING & RECREATE
    const deletePreview = await entityRecovery.previewMany([{ entity: 'AiQuality', entityId: quality.id }]);
    expect(deletePreview.items).toHaveLength(1);
    expect(deletePreview.items[0].state).toBe('MISSING');
    expect(deletePreview.items[0].operation).toBe('RECREATE');
    expect(deletePreview.items[0].recoverable).toBe(true);

    // 14b. Recreate entity from IPFS artifact + Blockchain Merkle proof
    const recreationResult = await entityRecovery.recoverMany(
      [{ entity: 'AiQuality', entityId: quality.id }],
      admin.id,
      'Recreate deleted AI quality evaluation from IPFS bundle',
    );
    expect(recreationResult.requested).toBe(1);
    expect(recreationResult.recovered).toBe(1);
    expect(recreationResult.results[0].status).toBe('RECREATED');

    // 14c. Verify record is back in DB, fully verified with foreign keys intact
    const recreatedQuality = await prisma.aiQuality.findUniqueOrThrow({ where: { id: quality.id } });
    expect(recreatedQuality.doctorId).toBe(doctor.id);
    expect(recreatedQuality.aiModelId).toBe(aiModel.id);
    expect(recreatedQuality.aiDiagnosisId).toBe(aiDiag.id);
    expect(recreatedQuality.trustablePercent).toBe(100);
    expect(recreatedQuality.doctorConclusionAboutModel).toBe(rateDto.feedback);

    const finalStats = await getAiModelStatsUseCase.execute();
    const finalModel = finalStats.allModels.find((m) => m.id === aiModel.id);
    expect(finalModel?.totalRatings).toBe(1);
    expect(finalModel?.averageAccuracy).toBe(100);
  });

  it('18. Cascading Dependency Auto-Resolution: Hard deleting multi-tier parent & child entities (Patient + Visit + AiDiagnosis + MedicalConclusion + AiQuality) and recovering leaf node automatically resolves & heals entire chain in topological order', async () => {
    // 0. Instantiate Clean Architecture UseCases & Services
    const deptRepo = new PrismaDepartmentRepository(prisma);
    const deptAnchor = new BlockchainDepartmentIntegrityAnchor(prisma, audit, anchor);
    const deptValidator = new DepartmentValidator(deptRepo);
    const createDepartmentUseCase = new CreateDepartmentUseCase(deptRepo, deptAnchor, deptValidator);

    const doctorRepo = new PrismaDoctorRepository(prisma);
    const doctorAnchor = new BlockchainDoctorIntegrityAnchor(prisma, audit, anchor);
    const nullMailer = { sendTemporaryPassword: async () => {} };
    const createDoctorWithStaffUseCase = new CreateDoctorWithStaffUseCase(doctorRepo, doctorAnchor, nullMailer as any);

    const aiModelRepo = new PrismaAiModelRepository(prisma);
    const aiModelCrypto = new AiModelCryptoAdapter();
    const aiModelConnectivity = new HttpAiModelConnectivityAdapter();
    const aiModelAnchor = new BlockchainAiModelIntegrityAnchor(prisma, audit, anchor);
    const createAiModelUseCase = new CreateAiModelUseCase(aiModelRepo, aiModelCrypto, aiModelConnectivity, aiModelAnchor);

    const patientRepo = new PrismaPatientRepository(prisma);
    const patientAnchor = new AuditPatientIntegrityAnchor(prisma, audit, anchor);
    const createPatientUseCase = new CreatePatientUseCase(patientRepo, patientAnchor);

    const visitRepo = new PrismaVisitRepository(prisma);
    const pageIntegrity = new AuditPageIntegrityService(prisma, blockchain);
    const visitIntegrity = new BlockchainVisitIntegrityAnchor(prisma, audit, pageIntegrity);
    const nullNotification = { createNotification: async () => {} };
    const clinicalTrust = new ClinicalAuditTrustService(prisma, anchor);
    const createVisitUseCase = new CreateVisitUseCase(
      visitRepo,
      visitIntegrity,
      prisma,
      nullNotification as any,
      audit,
      clinicalTrust,
    );

    const clinicalRepo = new PrismaClinicalDecisionRepository(prisma);
    const clinicalAnchor = new BlockchainMedicalConclusionIntegrityAnchor(prisma, audit, anchor);
    const clinicalPolicy = new ClinicalDecisionPolicy();
    const createMedicalConclusionUseCase = new CreateMedicalConclusionUseCase(
      clinicalRepo,
      clinicalAnchor,
      clinicalPolicy,
      visitIntegrity,
      clinicalTrust,
    );

    const rateAiModelUseCase = new RateAiModelUseCase(prisma, audit);

    const admin = await prisma.user.create({
      data: {
        username: `ai-admin-casc-${Date.now()}-${Math.random()}`,
        email: `admin-casc-${Date.now()}@test.local`,
        role: 'ADMIN',
        status: 'ACTIVE',
        firstLogin: false,
      },
    });

    // 1. Setup Department & Doctor via UseCases
    const deptDto: CreateDepartmentDto = {
      departmentCode: `DEPT-CASC-${Date.now()}`,
      name: `Khoa Cap Cuu Cascading ${Date.now()}`,
      floor: '1',
      type: 'EXAMINATION',
      canReceiveOrders: false,
      status: 'ACTIVE',
      description: 'Khoa cap cuu test cascading auto resolution',
    };
    const dept = await createDepartmentUseCase.execute(deptDto, admin.id);

    const docDto: CreateDoctorWithStaffDto = {
      username: `dr.cascade.${Date.now()}`,
      email: `dr.cascade.${Date.now()}@hospital.local`,
      fullName: 'BS Tran Van Cascade',
      phone: '0933333333',
      gender: 'Nam',
      citizenId: `${Date.now()}`.slice(-12).padStart(12, '7'),
      birthDate: '1985-03-10',
      address: 'Da Nang, Viet Nam',
      avatarUrl: 'https://cdn.hospital.local/avatars/dr-tran.jpg',
      departmentId: dept.id,
      position: 'Bac si cap cuu',
      specialty: 'CARDIOLOGY',
      licenseNumber: `CCHN-CASC-${Date.now().toString().slice(-6)}`,
      qualification: 'BS CKI',
      yearsExperience: 8,
    };
    const doctor = await createDoctorWithStaffUseCase.execute(docDto, admin.id);
    const doctorUserId = doctor.staffProfile.userId;

    // 2. Setup AI Model via UseCase
    const aiModelDto: CreateAiModelDto = {
      modelName: 'Cascade Trauma Detector',
      modelVersion: '1.0.0',
      recommendedSpecialty: 'CARDIOLOGY',
      type: 'API',
      provider: 'local',
      apiEndpoint: 'http://localhost:8000/v1/trauma-detect',
      secretOrIpHash: 'secret-trauma-test',
      description: 'Model AI nhan dien chan thuong cap',
    };
    const aiModel = await createAiModelUseCase.execute(aiModelDto, admin.id);

    // 3. Setup Patient via UseCase
    const patientDto: CreatePatientDto = {
      fullName: 'Ngo Thi Cascade Patient',
      gender: 'FEMALE',
      birthDate: '1998-11-12',
      citizenId: `${Date.now()}`.slice(-12).padStart(12, '6'),
      phone: '0944444444',
      address: 'Can Tho, Viet Nam',
    };
    const patient = await createPatientUseCase.execute(patientDto, admin.id);

    // 4. Setup Visit via UseCase
    const visitDto: CreateVisitDto = {
      patientId: patient.id,
      departmentId: dept.id,
      staffId: doctor.staffProfile.id,
    };
    const visit: any = await createVisitUseCase.execute(visitDto, {
      sub: doctorUserId,
      role: 'DOCTOR',
      username: docDto.username,
    } as any);

    // 5. Setup AiDiagnosis directly & record audit
    const aiDiag = await prisma.aiDiagnosis.create({
      data: {
        aiModelId: aiModel.id,
        patientId: patient.id,
        visitId: visit.id,
        prompt: 'Trauma scan CT scan brain',
        result: '{"epiduralHematoma": false, "fracture": false}',
        confidence: 0.99,
        status: 'DOCTOR_REVIEWED',
        reviewedByDoctorId: doctor.id,
        doctorFeedback: 'Ket qua chinh xac, khong co dau hieu xuat huyet',
      },
    });
    await audit.recordV2({
      entity: 'AiDiagnosis',
      entityId: aiDiag.id,
      action: 'CREATE',
      actorId: doctorUserId,
      before: null,
      after: buildAiDiagnosisSnapshot(aiDiag),
    });

    // 6. Setup MedicalConclusion via UseCase
    await prisma.visit.update({ where: { id: visit.id }, data: { status: 'WAITING_CONCLUSION' } });
    const conclusionDto: CreateMedicalConclusionDto = {
      visitId: visit.id,
      aiDiagnosisId: aiDiag.id,
      finalDiagnosis: 'Chan thuong dau nhe (GCS 15 diem), khong ton thuong noi so',
      treatmentPlan: 'Theo doi ngoai tru trong 48h, tai kham neu dau dau tang hoac non',
      prescription: 'Paracetamol 500mg uong khi dau',
      followUpNote: 'Tai kham sau 3 ngay hoac ngay khi co dau hieu bat thuong',
      doctorNote: 'Nguoi nha da hieu ro huong dan theo doi tai nha',
    };
    const conclusion: any = await createMedicalConclusionUseCase.execute(conclusionDto, doctorUserId);

    // 7. Setup AiQuality rating via UseCase
    const rateDto: RateAiModelDto = {
      aiDiagnosisId: aiDiag.id,
      satisfied: true,
      feedback: 'Model phan tich anh CT cap cuu rat nhanh va dang tin cay',
    };
    const quality = await rateAiModelUseCase.execute(
      aiModel.id,
      doctorUserId,
      rateDto.aiDiagnosisId,
      rateDto.satisfied,
      rateDto.feedback,
    );

    // 8. Seal all audit logs to Merkle Batch & on-chain smart contract
    const anchorResult = await anchor.anchorNow();
    expect(anchorResult.committed).toBe(true);

    // 9. CASCADING HARD-DELETE SIMULATION:
    // Delete in reverse order from DB: AiQuality -> MedicalConclusion -> AiDiagnosis -> Visit -> Patient
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.audit_recovery_authorized = 'true'`;
      await tx.aiQuality.delete({ where: { id: quality.id } });
      await tx.medicalConclusion.delete({ where: { id: conclusion.id } });
      await tx.aiDiagnosis.delete({ where: { id: aiDiag.id } });
      await tx.visit.delete({ where: { id: visit.id } });
      await tx.patient.delete({ where: { id: patient.id } });
    });

    // Verify all 5 entities are completely gone from PostgreSQL
    expect(await prisma.aiQuality.findUnique({ where: { id: quality.id } })).toBeNull();
    expect(await prisma.medicalConclusion.findUnique({ where: { id: conclusion.id } })).toBeNull();
    expect(await prisma.aiDiagnosis.findUnique({ where: { id: aiDiag.id } })).toBeNull();
    expect(await prisma.visit.findUnique({ where: { id: visit.id } })).toBeNull();
    expect(await prisma.patient.findUnique({ where: { id: patient.id } })).toBeNull();

    // 10. RECURSIVE AUTO-DEPENDENCY HEALING:
    // User / Admin ONLY clicks "Recover" on the single leaf entity: AiQuality.
    // The backend must automatically detect that AiDiagnosis is missing, which depends on Visit, which depends on Patient.
    // It must recursively recreate: Patient -> Visit -> AiDiagnosis -> AiQuality without ANY manual intervention!
    const leafRecoveryResult = await entityRecovery.recoverMany(
      [{ entity: 'AiQuality', entityId: quality.id }],
      admin.id,
      'One-click cascading auto-heal starting from leaf node AiQuality',
    );

    expect(leafRecoveryResult.failed).toBe(0);
    expect(leafRecoveryResult.recovered).toBe(1);

    // 11. Verify that Patient, Visit, AiDiagnosis, and AiQuality are ALL back in DB!
    const restoredPatient = await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } });
    expect(restoredPatient.fullName).toBe('Ngo Thi Cascade Patient');
    expect(restoredPatient.patientCode).toBe(patient.patientCode);

    const restoredVisit = await prisma.visit.findUniqueOrThrow({ where: { id: visit.id } });
    expect(restoredVisit.patientId).toBe(restoredPatient.id);
    expect(restoredVisit.departmentId).toBe(dept.id);

    const restoredAiDiag = await prisma.aiDiagnosis.findUniqueOrThrow({ where: { id: aiDiag.id } });
    expect(restoredAiDiag.patientId).toBe(restoredPatient.id);
    expect(restoredAiDiag.visitId).toBe(restoredVisit.id);
    expect(restoredAiDiag.aiModelId).toBe(aiModel.id);

    const restoredQuality = await prisma.aiQuality.findUniqueOrThrow({ where: { id: quality.id } });
    expect(restoredQuality.aiDiagnosisId).toBe(restoredAiDiag.id);
    expect(restoredQuality.aiModelId).toBe(aiModel.id);
    expect(restoredQuality.doctorId).toBe(doctor.id);
    expect(restoredQuality.trustablePercent).toBe(100);

    // 12. SHUFFLED BULK RECOVERY TEST:
    // Delete AiQuality and AiDiagnosis again, while MedicalConclusion is also still missing.
    // Submit [AiQuality (Level 6), MedicalConclusion (Level 5), AiDiagnosis (Level 4)] in reverse topological order.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.audit_recovery_authorized = 'true'`;
      await tx.aiQuality.delete({ where: { id: quality.id } });
      await tx.aiDiagnosis.delete({ where: { id: aiDiag.id } });
    });

    const shuffledRecoveryResult = await entityRecovery.recoverMany(
      [
        { entity: 'AiQuality', entityId: quality.id }, // Level 6
        { entity: 'MedicalConclusion', entityId: conclusion.id }, // Level 5
        { entity: 'AiDiagnosis', entityId: aiDiag.id }, // Level 4
      ],
      admin.id,
      'Bulk recovery with topological auto-ordering',
    );

    expect(shuffledRecoveryResult.failed).toBe(0);
    expect(shuffledRecoveryResult.recovered).toBe(3);

    const finalDiagnosis = await prisma.aiDiagnosis.findUniqueOrThrow({ where: { id: aiDiag.id } });
    expect(finalDiagnosis.id).toBe(aiDiag.id);

    const finalConclusion = await prisma.medicalConclusion.findUniqueOrThrow({ where: { id: conclusion.id } });
    expect(finalConclusion.finalDiagnosis).toBe(conclusionDto.finalDiagnosis);
    expect(finalConclusion.visitId).toBe(restoredVisit.id);

    const finalQuality = await prisma.aiQuality.findUniqueOrThrow({ where: { id: quality.id } });
    expect(finalQuality.trustablePercent).toBe(100);
  });

  it('fails closed after anchored history is wiped, restores exact IPFS sequences, then resumes at the next immutable seq', async () => {
    const admin = await prisma.user.create({
      data: {
        username: `monotonic-admin-${Date.now()}`,
        email: `monotonic-${Date.now()}@test.local`,
        role: 'ADMIN', status: 'ACTIVE', firstLogin: false,
      },
    });

    for (let seq = 1; seq <= 5; seq += 1) {
      const patient = await prisma.patient.create({
        data: {
          patientCode: `BN-MONO-1-${seq}-${Date.now()}`,
          fullName: `Patient Mono ${seq}`,
          gender: 'MALE', birthDate: new Date('1990-01-01'), phone: `090000010${seq}`,
        },
      });
      const log = await audit.recordV2({
        entity: 'Patient', entityId: patient.id, action: 'CREATE', actorId: admin.id,
        after: { fullName: patient.fullName },
      });
      expect(log.seq).toBe(seq);
    }
    const batch1 = await anchor.anchorNow();
    expect(batch1.committed).toBe(true);

    for (let seq = 6; seq <= 10; seq += 1) {
      const patient = await prisma.patient.create({
        data: {
          patientCode: `BN-MONO-2-${seq}-${Date.now()}`,
          fullName: `Patient Mono ${seq}`,
          gender: 'FEMALE', birthDate: new Date('1992-02-02'), phone: `090000020${seq}`,
        },
      });
      const log = await audit.recordV2({
        entity: 'Patient', entityId: patient.id, action: 'CREATE', actorId: admin.id,
        after: { fullName: patient.fullName },
      });
      expect(log.seq).toBe(seq);
    }
    const batch2 = await anchor.anchorNow();
    expect(batch2.committed).toBe(true);

    const originalRows = await prisma.blockchainLogger.findMany({
      where: { batchId: { in: [batch1.batchId!, batch2.batchId!] } },
      orderBy: { seq: 'asc' },
      select: { id: true, seq: true, entryHash: true },
    });
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.audit_recovery_authorized', 'true', true)`;
      await tx.blockchainLogger.deleteMany({});
    });

    const postWipePatient = await prisma.patient.create({
      data: {
        patientCode: `BN-MONO-POST-WIPE-${Date.now()}`,
        fullName: 'Patient Post Wipe', gender: 'MALE',
        birthDate: new Date('1995-05-05'), phone: '0900000999',
      },
    });
    await expect(audit.recordV2({
      entity: 'Patient', entityId: postWipePatient.id, action: 'CREATE', actorId: admin.id,
      after: { fullName: postWipePatient.fullName },
    })).rejects.toThrow('AUDIT_CHAIN_RECOVERY_REQUIRED');

    await expect(batchRecovery.recover(batch1.batchId!, admin.id, 'Restore immutable batch 1')).resolves.toMatchObject({ status: 'RECOVERED' });
    await expect(batchRecovery.recover(batch2.batchId!, admin.id, 'Restore immutable batch 2')).resolves.toMatchObject({ status: 'RECOVERED' });

    const restoredRows = await prisma.blockchainLogger.findMany({
      where: { batchId: { in: [batch1.batchId!, batch2.batchId!] } },
      orderBy: { seq: 'asc' },
      select: { id: true, seq: true, entryHash: true },
    });
    expect(restoredRows).toEqual(originalRows);

    // Recovery audit events are appended after the restored checkpoint range; no artifact row is remapped.
    const nextLog = await audit.recordV2({
      entity: 'Patient', entityId: postWipePatient.id, action: 'CREATE', actorId: admin.id,
      after: { fullName: postWipePatient.fullName },
    });
    expect(nextLog.seq).toBeGreaterThan(10);
    expect((await audit.verifyChain()).ok).toBe(true);
  });

  it('removes a hacker seq collision and restores each anchored artifact row at its original immutable id/seq/hash', async () => {
    const admin = await prisma.user.create({
      data: {
        username: `deepscan-admin-${Date.now()}`,
        email: `deepscan-${Date.now()}@test.local`,
        role: 'ADMIN', status: 'ACTIVE', firstLogin: false,
      },
    });

    const p1 = await prisma.patient.create({
      data: {
        patientCode: `BN-DS-1-${Date.now()}`, fullName: 'DeepScan Patient 1',
        gender: 'MALE', birthDate: new Date('1990-01-01'), phone: '0901111111',
      },
    });
    await audit.recordV2({ entity: 'Patient', entityId: p1.id, action: 'CREATE', actorId: admin.id, after: { fullName: p1.fullName } });
    await audit.recordV2({ entity: 'Patient', entityId: p1.id, action: 'UPDATE', actorId: admin.id, after: { fullName: 'P1 Updated' } });
    const b1 = await anchor.anchorNow();
    expect(b1.committed).toBe(true);

    const p2 = await prisma.patient.create({
      data: {
        patientCode: `BN-DS-2-${Date.now()}`, fullName: 'DeepScan Patient 2',
        gender: 'FEMALE', birthDate: new Date('1992-02-02'), phone: '0902222222',
      },
    });
    await audit.recordV2({ entity: 'Patient', entityId: p2.id, action: 'CREATE', actorId: admin.id, after: { fullName: p2.fullName } });
    await audit.recordV2({ entity: 'Patient', entityId: p2.id, action: 'UPDATE', actorId: admin.id, after: { fullName: 'P2 Updated' } });
    const b2 = await anchor.anchorNow();
    expect(b2.committed).toBe(true);

    const originals = await prisma.blockchainLogger.findMany({
      where: { batchId: { in: [b1.batchId!, b2.batchId!] } },
      orderBy: { seq: 'asc' },
      select: { id: true, seq: true, entryHash: true, batchId: true },
    });
    const collisionId = crypto.randomUUID();
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.audit_recovery_authorized', 'true', true)`;
      await tx.blockchainLogger.deleteMany({ where: { batchId: { in: [b1.batchId!, b2.batchId!] } } });
      await tx.auditBatch.deleteMany({ where: { batchId: { in: [b1.batchId!, b2.batchId!] } } });
      await tx.blockchainLogger.create({
        data: {
          id: collisionId, seq: originals[0].seq, prevHash: 'hacker-prev', entryHash: 'hacker-entry',
          entity: 'Patient', entityId: p1.id, action: 'HACKER_INSERT', onChainStatus: 'PENDING',
        },
      });
    });

    await expect(batchRecovery.recover(b1.batchId!, admin.id, 'Deep scan immutable recovery of Batch 1'))
      .resolves.toMatchObject({ status: 'RECOVERED' });
    await expect(prisma.blockchainLogger.findUnique({ where: { id: collisionId } })).resolves.toBeNull();
    await expect(batchRecovery.recover(b2.batchId!, admin.id, 'Deep scan immutable recovery of Batch 2'))
      .resolves.toMatchObject({ status: 'RECOVERED' });

    const restored = await prisma.blockchainLogger.findMany({
      where: { batchId: { in: [b1.batchId!, b2.batchId!] } },
      orderBy: { seq: 'asc' },
      select: { id: true, seq: true, entryHash: true, batchId: true },
    });
    expect(restored).toEqual(originals);
    expect((await audit.verifyChain()).ok).toBe(true);
  });

  it('22. End-to-End Clinical Lifecycle: Seed full 3-dept clinical flow, tamper/edit fields & hard delete records, verify drift detection, recover seamlessly without missing-data error, and confirm post-recovery clean state', async () => {
    // ---------------------------------------------------------------------------------
    // 1. SEED FULL 3-DEPARTMENT CLINICAL WORKFLOW
    // ---------------------------------------------------------------------------------
    const admin = await prisma.user.create({
      data: {
        username: `clinic-e2e-admin-${Date.now()}`,
        email: `clinic-admin-${Date.now()}@hospital.local`,
        role: 'ADMIN', status: 'ACTIVE', firstLogin: false,
      },
    });

    // 1.1 Departments
    const deptRecep = await prisma.department.create({
      data: {
        departmentCode: `PB-REC-${Date.now()}`,
        name: `Phòng Tiếp Đón & Đăng Ký Khám ${Date.now()}`,
        floor: '1', type: 'CLINICAL', canReceiveOrders: false, status: 'ACTIVE',
      },
    });
    await audit.recordV2({ entity: 'Department', entityId: deptRecep.id, action: 'CREATE', actorId: admin.id, after: buildDepartmentSnapshot(deptRecep) });

    const deptClinic = await prisma.department.create({
      data: {
        departmentCode: `PB-CLI-${Date.now()}`,
        name: `Phòng Khám Nội Tổng Quát ${Date.now()}`,
        floor: '2', type: 'CLINICAL', canReceiveOrders: false, status: 'ACTIVE',
      },
    });
    await audit.recordV2({ entity: 'Department', entityId: deptClinic.id, action: 'CREATE', actorId: admin.id, after: buildDepartmentSnapshot(deptClinic) });

    const deptLab = await prisma.department.create({
      data: {
        departmentCode: `PB-LAB-${Date.now()}`,
        name: `Khoa Xét Nghiệm & Huyết Học ${Date.now()}`,
        floor: '3', type: 'CLINICAL', canReceiveOrders: true, status: 'ACTIVE',
      },
    });
    await audit.recordV2({ entity: 'Department', entityId: deptLab.id, action: 'CREATE', actorId: admin.id, after: buildDepartmentSnapshot(deptLab) });

    // 1.2 Staff & Doctor
    const recepUser = await prisma.user.create({
      data: { username: `recep-${Date.now()}`, role: 'RECEPTIONIST', status: 'ACTIVE', firstLogin: false },
    });
    const recepStaff = await prisma.staffProfile.create({
      data: {
        userId: recepUser.id, departmentId: deptRecep.id, fullName: 'Trần Thị Mai',
        phone: '0901000001', gender: 'FEMALE', citizenId: `${Date.now()}`.slice(-12).padStart(12, '1'),
        birthDate: new Date('1995-04-12'), employeeCode: `NV-REC-${Date.now()}`, avatarUrl: 'https://avatar.url/1',
      },
    });
    await audit.recordV2({ entity: 'StaffProfile', entityId: recepStaff.id, action: 'CREATE', actorId: admin.id, after: buildStaffSnapshot(recepStaff) });

    const doctorUser = await prisma.user.create({
      data: { username: `doc-${Date.now()}`, role: 'DOCTOR', status: 'ACTIVE', firstLogin: false },
    });
    const doctorStaff = await prisma.staffProfile.create({
      data: {
        userId: doctorUser.id, departmentId: deptClinic.id, fullName: 'BS. CKI Nguyễn Văn Hoàng',
        phone: '0902000002', gender: 'MALE', citizenId: `${Date.now()}`.slice(-12).padStart(12, '2'),
        birthDate: new Date('1985-08-20'), employeeCode: `BS-NOI-${Date.now()}`, avatarUrl: 'https://avatar.url/2',
      },
    });
    await audit.recordV2({ entity: 'StaffProfile', entityId: doctorStaff.id, action: 'CREATE', actorId: admin.id, after: buildStaffSnapshot(doctorStaff) });

    const doctorProfile = await prisma.doctorProfile.create({
      data: {
        staffProfileId: doctorStaff.id, specialty: 'GENERAL_INTERNAL_MEDICINE',
        licenseNumber: `CCHND-${Date.now()}`, qualification: 'BS CKI Nội Tổng Quát', yearsExperience: 12,
      },
    });
    await audit.recordV2({ entity: 'DoctorProfile', entityId: doctorProfile.id, action: 'CREATE', actorId: admin.id, after: buildUnifiedDoctorSnapshot({ ...doctorProfile, staffProfile: doctorStaff }) });

    const labUser = await prisma.user.create({
      data: { username: `lab-${Date.now()}`, role: 'LAB_MANAGER', status: 'ACTIVE', firstLogin: false },
    });
    const labStaff = await prisma.staffProfile.create({
      data: {
        userId: labUser.id, departmentId: deptLab.id, fullName: 'KTV. Lê Văn Hùng',
        phone: '0903000003', gender: 'MALE', citizenId: `${Date.now()}`.slice(-12).padStart(12, '3'),
        birthDate: new Date('1990-11-05'), employeeCode: `KTV-LAB-${Date.now()}`, avatarUrl: 'https://avatar.url/3',
        labSpecialty: 'LABORATORY',
      },
    });
    await audit.recordV2({ entity: 'StaffProfile', entityId: labStaff.id, action: 'CREATE', actorId: admin.id, after: buildStaffSnapshot(labStaff) });

    // 1.3 AI Model Registry
    const aiModel = await prisma.aiModelRegistry.create({
      data: {
        modelName: `Dengue Diagnostic AI Model ${Date.now()}`,
        modelVersion: '1.0.0', type: 'API', provider: 'Hospital Clinical AI Engine',
        recommendedSpecialty: 'GENERAL_INTERNAL_MEDICINE', ipHashEncrypted: 'enc-hash-1', ipHashPlain: 'plain-hash-1',
        status: 'ACTIVE', createdBy: admin.id,
      },
    });
    await audit.recordV2({ entity: 'AiModelRegistry', entityId: aiModel.id, action: 'CREATE', actorId: admin.id, after: buildAiModelSnapshot(aiModel) });

    // 1.4 Clinical Flow Execution
    const patient = await prisma.patient.create({
      data: {
        patientCode: `BN-${Date.now()}`, fullName: 'Nguyễn Văn An', gender: 'MALE',
        birthDate: new Date('1990-05-15'), citizenId: `${Date.now()}`.slice(-12).padStart(12, '4'),
        phone: '0901234567', address: '123 Nguyễn Trãi, Q.5, TP.HCM',
      },
    });
    const patientIntegrity = audit.hashSnapshot(buildPatientSnapshot(patient));
    await prisma.patient.update({ where: { id: patient.id }, data: { hash256: patientIntegrity.hash, dataSalt: patientIntegrity.salt } });
    await audit.recordV2({ entity: 'Patient', entityId: patient.id, action: 'CREATE', actorId: recepUser.id, after: buildPatientSnapshot(patient) });

    const visit = await prisma.visit.create({
      data: {
        visitCode: `LK-${Date.now()}`, patientId: patient.id, departmentId: deptClinic.id,
        staffId: recepStaff.id, status: 'IN_PROGRESS', source: 'WALK_IN',
      },
    });
    await audit.recordV2({ entity: 'Visit', entityId: visit.id, action: 'CREATE', actorId: recepUser.id, after: buildVisitSnapshot(visit) });

    const medicalOrder = await prisma.medicalOrder.create({
      data: {
        orderCode: `ORD-${Date.now()}`, visitId: visit.id, patientId: patient.id,
        doctorId: doctorProfile.id, targetDepartmentId: deptLab.id, orderType: 'LAB_TEST',
        priority: 'URGENT', clinicalNote: 'Bệnh nhân sốt cao ngày 3, xét nghiệm công thức máu và Dengue NS1.',
        status: 'RESULT_READY',
      },
    });
    await audit.recordV2({ entity: 'MedicalOrder', entityId: medicalOrder.id, action: 'CREATE', actorId: doctorUser.id, after: buildMedicalOrderSnapshot(medicalOrder) });

    const medicalResult = await prisma.medicalResult.create({
      data: {
        resultCode: `RES-${Date.now()}`, orderId: medicalOrder.id, performedById: labUser.id,
        note: 'Tiểu cầu (PLT) giảm thấp: 102 G/L. Dengue NS1 Ag: DƯƠNG TÍNH (+).',
        files: {
          create: [
            {
              fileName: 'phieu_xet_nghiem.pdf', originalName: 'Phieu_Ket_Qua.pdf',
              mimeType: 'application/pdf', size: 1450000, storageProvider: 'CLOUDINARY',
              url: 'https://cloudinary.com/pdf1', sha256: 'sha256-pdf-file',
            },
          ],
        },
      },
      include: { files: true },
    });
    await audit.recordV2({ entity: 'MedicalResult', entityId: medicalResult.id, action: 'CREATE', actorId: labUser.id, after: buildMedicalResultSnapshot({ ...medicalResult, visitId: visit.id }) });

    const aiDiag = await prisma.aiDiagnosis.create({
      data: {
        aiModelId: aiModel.id, patientId: patient.id, visitId: visit.id,
        prompt: 'Sốt cao ngày 3, PLT 102 G/L, Dengue NS1 (+)',
        result: JSON.stringify({ primaryDiagnosis: 'Sốt xuất huyết Dengue ngày thứ 3 có dấu hiệu cảnh báo', confidence: 0.96 }),
        confidence: 0.96, status: 'DOCTOR_REVIEWED', reviewedByDoctorId: doctorProfile.id,
        doctorFeedback: 'Đồng thuận với gợi ý của AI.',
      },
    });
    await audit.recordV2({ entity: 'AiDiagnosis', entityId: aiDiag.id, action: 'CREATE', actorId: doctorUser.id, after: buildAiDiagnosisSnapshot(aiDiag) });

    const qualityData = {
      doctorId: doctorProfile.id, aiModelId: aiModel.id, aiDiagnosisId: aiDiag.id,
      doctorConclusionAboutModel: 'Mô hình nhận diện chính xác dấu hiệu cảnh báo hạ tiểu cầu.', trustablePercent: 96.0,
    };
    const qualityIntegrity = audit.hashSnapshot(qualityData);
    const aiQuality = await prisma.aiQuality.create({
      data: { ...qualityData, hash256: qualityIntegrity.hash, dataSalt: qualityIntegrity.salt },
    });
    await audit.recordV2({ entity: 'AiQuality', entityId: aiQuality.id, action: 'AI_MODEL_RATED', actorId: doctorUser.id, after: buildAiQualitySnapshot(aiQuality) });

    const conclusionData = {
      visitId: visit.id, doctorId: doctorProfile.id, aiDiagnosisId: aiDiag.id,
      finalDiagnosis: 'Sốt xuất huyết Dengue có dấu hiệu cảnh báo ngày thứ 3 (Mã ICD-10: A97.1)',
      treatmentPlan: 'Bù dịch Ringer Lactate đường uống và truyền tĩnh mạch theo phác đồ Bộ Y Tế.',
      prescription: 'Paracetamol 500mg, Oresol 245', followUpNote: 'Tái khám ngay nếu có dấu hiệu cảnh báo nguy hiểm.',
      doctorNote: 'Bệnh nhân tỉnh táo, chưa xuất huyết tự phát.',
    };
    const conclusionIntegrity = audit.hashSnapshot({ ...conclusionData, patientCode: patient.patientCode });
    const conclusion = await prisma.medicalConclusion.create({
      data: { ...conclusionData, hash256: conclusionIntegrity.hash, dataSalt: conclusionIntegrity.salt },
    });
    await audit.recordV2({ entity: 'MedicalConclusion', entityId: conclusion.id, action: 'CREATE', actorId: doctorUser.id, after: buildMedicalConclusionSnapshot({ ...conclusion, visit: { patient } }) });

    // 1.5 Ensure all clinical flow logs are anchored to Blockchain & IPFS
    const unanchoredCount = await prisma.blockchainLogger.count({ where: { batchId: null } });
    if (unanchoredCount > 0) {
      await anchor.rechainLocalBlockchainLogger();
      await anchor.anchorNowWithinRecovery();
    }
    const totalAnchored = await prisma.blockchainLogger.count({ where: { onChainStatus: 'ANCHORED' } });
    expect(totalAnchored).toBeGreaterThanOrEqual(10);

    // ---------------------------------------------------------------------------------
    // 2. TAMPER & EDIT DATA IN DATABASE (SỬA DỮ LIỆU)
    // ---------------------------------------------------------------------------------
    await prisma.patient.update({
      where: { id: patient.id },
      data: { fullName: 'Hacker Tampered Patient Name', phone: '0999999999' },
    });

    await prisma.medicalConclusion.update({
      where: { id: conclusion.id },
      data: { finalDiagnosis: 'Hacker Forged Diagnosis (Cảm cúm thông thường)' },
    });

    // ---------------------------------------------------------------------------------
    // 3. VERIFY ENTITY DRIFT DETECTION (HỆ THỐNG PHÁT HIỆN LỆCH 100%)
    // ---------------------------------------------------------------------------------
    const warningsAfterTamper = await entityRecovery.listWarnings();
    const patientWarning = warningsAfterTamper.items.find((w) => w.entity === 'Patient' && w.entityId === patient.id);
    expect(patientWarning).toBeDefined();
    expect(patientWarning?.status).toBe('TAMPERED');

    const conclusionWarning = warningsAfterTamper.items.find((w) => w.entity === 'MedicalConclusion' && w.entityId === conclusion.id);
    expect(conclusionWarning).toBeDefined();
    expect(conclusionWarning?.status).toBe('TAMPERED');

    // ---------------------------------------------------------------------------------
    // 4. HARD DELETE RECORDS FROM DATABASE (XÓA DỮ LIỆU)
    // ---------------------------------------------------------------------------------
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.audit_recovery_authorized', 'true', true)`;
      await tx.medicalConclusion.delete({ where: { id: conclusion.id } });
      await tx.aiQuality.delete({ where: { id: aiQuality.id } });
    });

    // Detect that deleted entities are flagged as missing/tampered in warnings
    const warningsAfterDelete = await entityRecovery.listWarnings();
    const deletedConclusionWarning = warningsAfterDelete.items.find((w) => w.entity === 'MedicalConclusion' && w.entityId === conclusion.id);
    expect(deletedConclusionWarning).toBeDefined();
    expect(['MISSING', 'TAMPERED']).toContain(deletedConclusionWarning?.status);

    const deletedQualityWarning = warningsAfterDelete.items.find((w) => w.entity === 'AiQuality' && w.entityId === aiQuality.id);
    expect(deletedQualityWarning).toBeDefined();
    expect(['MISSING', 'TAMPERED']).toContain(deletedQualityWarning?.status);

    // ---------------------------------------------------------------------------------
    // 5. PREVIEW & EXECUTE RECOVERY (CHO CHỌN VÀ KHÔI PHỤC, KHÔNG BÁO LỖI THIẾU DATA)
    // ---------------------------------------------------------------------------------
    const preview = await entityRecovery.previewMany([
      { entity: 'Patient', entityId: patient.id },
      { entity: 'MedicalConclusion', entityId: conclusion.id },
      { entity: 'AiQuality', entityId: aiQuality.id },
    ]);
    expect(preview.items).toHaveLength(3);
    expect(preview.items.every((p) => p.recoverable)).toBe(true);

    const recResult = await entityRecovery.recoverMany(
      [
        { entity: 'Patient', entityId: patient.id },
        { entity: 'MedicalConclusion', entityId: conclusion.id },
        { entity: 'AiQuality', entityId: aiQuality.id },
      ],
      admin.id,
      'Admin requested full clinical recovery after tampering & hard delete',
    );
    expect(recResult.failed).toBe(0);
    expect(recResult.recovered).toBe(3);

    // ---------------------------------------------------------------------------------
    // 6. POST-RECOVERY VERIFICATION (SAU PHỤC HỒI CÒN BÁO LỆCH KHÔNG?)
    // ---------------------------------------------------------------------------------
    const warningsPostRecovery = await entityRecovery.listWarnings();
    const postPatientWarning = warningsPostRecovery.items.find((w) => w.entity === 'Patient' && w.entityId === patient.id);
    expect(postPatientWarning).toBeUndefined(); // Warning is completely GONE!

    const postConclusionWarning = warningsPostRecovery.items.find((w) => w.entity === 'MedicalConclusion' && w.entityId === conclusion.id);
    expect(postConclusionWarning).toBeUndefined(); // Warning is completely GONE!

    const postQualityWarning = warningsPostRecovery.items.find((w) => w.entity === 'AiQuality' && w.entityId === aiQuality.id);
    expect(postQualityWarning).toBeUndefined(); // Warning is completely GONE!

    // Verify DB records match original pristine clinical values
    await expect(entityRecovery.assertTrusted('Patient', patient.id)).resolves.not.toThrow();
    await expect(entityRecovery.assertTrusted('MedicalConclusion', conclusion.id)).resolves.not.toThrow();
    await expect(entityRecovery.assertTrusted('AiQuality', aiQuality.id)).resolves.not.toThrow();

    const restoredPatient = await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } });
    expect(restoredPatient.fullName).toBe('Nguyễn Văn An'); // Restored!
    expect(restoredPatient.phone).toBe('0901234567');

    const restoredConclusion = await prisma.medicalConclusion.findUniqueOrThrow({ where: { id: conclusion.id } });
    expect(restoredConclusion.finalDiagnosis).toBe('Sốt xuất huyết Dengue có dấu hiệu cảnh báo ngày thứ 3 (Mã ICD-10: A97.1)');
    expect(restoredConclusion.treatmentPlan).toContain('Bù dịch Ringer Lactate');
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
