import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { AuditLoggerService } from '../infrastructure/audit';
import { AuditAnchorService } from '../infrastructure/audit';
import { EntityRecoveryService } from '../infrastructure/audit';
import { buildAiDiagnosisSnapshot } from '../modules/clinical-decision/domain/ai-diagnosis-snapshot';
import { buildVisitSnapshot } from '../modules/visit/domain/visit-snapshot';
import {
  MEDICAL_CONCLUSION_INTEGRITY_ANCHOR,
  MedicalConclusionIntegrityAnchorPort,
} from '../modules/clinical-decision/application/ports/medical-conclusion-integrity-anchor.port';
import {
  DEPARTMENT_INTEGRITY_ANCHOR,
  DepartmentIntegrityAnchorPort,
} from '../modules/department/application/ports/department-integrity-anchor.port';
import {
  DOCTOR_INTEGRITY_ANCHOR,
  DoctorIntegrityAnchorPort,
} from '../modules/doctor/application/ports/doctor-integrity-anchor.port';
import {
  AI_MODEL_INTEGRITY_ANCHOR,
  AiModelIntegrityAnchorPort,
} from '../modules/ai-model/application/ports/ai-model-integrity-anchor.port';

async function main() {
  // This one-shot seed owns batch boundaries explicitly. Disable only the background
  // timer/bootstrap anchor; AuditAnchorService.anchorNow() remains fully operational.
  process.env.AUDIT_BATCH_DISABLED = 'true';
  console.log('🚀 Bootstrapping NestJS application context for Tamper & Recovery Demo...');
  const app = await NestFactory.createApplicationContext(AppModule);

  const prisma = app.get(PrismaService);
  const audit = app.get(AuditLoggerService);
  const anchor = app.get(AuditAnchorService);
  const entityRecovery = app.get(EntityRecoveryService);
  const conclusionIntegrity = app.get<MedicalConclusionIntegrityAnchorPort>(MEDICAL_CONCLUSION_INTEGRITY_ANCHOR);
  const departmentIntegrity = app.get<DepartmentIntegrityAnchorPort>(DEPARTMENT_INTEGRITY_ANCHOR);
  const doctorIntegrity = app.get<DoctorIntegrityAnchorPort>(DOCTOR_INTEGRITY_ANCHOR);
  const aiModelIntegrity = app.get<AiModelIntegrityAnchorPort>(AI_MODEL_INTEGRITY_ANCHOR);

  const anchorRequired = async (label: string) => {
    console.log(` ⏳ ${label}: xác minh neo Sepolia và encrypted artifact trên Pinata...`);
    const newestLog = await prisma.blockchainLogger.findFirst({
      where: { seq: { not: null }, entryHash: { not: null } },
      orderBy: { seq: 'desc' },
      select: { seq: true, batchId: true },
    });
    if (newestLog?.seq == null) throw new Error(`${label} không có audit log hợp lệ để neo.`);

    let batchId = newestLog.batchId;
    let leafCount: number | undefined;
    if (batchId == null) {
      const result = await anchor.anchorNow();
      if (!result.committed || result.batchId == null) {
        throw new Error(`${label} không neo được: ${result.reason ?? 'không rõ nguyên nhân'}`);
      }
      batchId = result.batchId;
      leafCount = result.leafCount;
    }

    const batch = await prisma.auditBatch.findUnique({ where: { batchId } });
    if (
      !batch
      || batch.status !== 'ANCHORED'
      || !batch.artifactHash
      || !batch.artifactUri?.startsWith('ipfs://')
      || !batch.merkleRoot
      || !batch.txHash
      || batch.blockNumber == null
      || batch.toSeq !== newestLog.seq
    ) {
      throw new Error(`${label} thiếu bằng chứng Sepolia/IPFS hoàn chỉnh cho audit log SEQ ${newestLog.seq}.`);
    }
    console.log(` ✅ ${label}: Batch #${batch.batchId}, ${leafCount ?? batch.leafCount} logs, tx ${batch.txHash}, IPFS ${batch.artifactUri}`);
    return batch;
  };

  const runId = `DEMO-${Date.now().toString().slice(-6)}`;
  console.log(`📌 Demo Run ID: ${runId}`);

  // Create shared Admin and Doctor for clinical fixtures
  const adminUser = await prisma.user.create({
    data: {
      username: `admin-${runId}`,
      email: `admin-${runId}@hospital.local`,
      role: 'ADMIN',
      status: 'ACTIVE',
      firstLogin: false,
    },
  });

  const department = await prisma.department.create({
    data: {
      departmentCode: `K-NT-${runId}`,
      name: `Khoa Nội Tổng hợp ${runId}`,
      type: 'CLINICAL',
      canReceiveOrders: true,
    },
  });
  await departmentIntegrity.anchorChange(department, 'CREATE', adminUser.id, null);

  const doctorUser = await prisma.user.create({
    data: {
      username: `doctor-${runId}`,
      email: `doctor-${runId}@hospital.local`,
      role: 'DOCTOR',
      status: 'ACTIVE',
      firstLogin: false,
    },
  });

  const staff = await prisma.staffProfile.create({
    data: {
      userId: doctorUser.id,
      departmentId: department.id,
      employeeCode: `BS-${runId}`,
      fullName: `BS. Nguyễn Văn ${runId}`,
      phone: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
      gender: 'MALE',
      citizenId: String(Date.now()).slice(-12).padStart(12, '0'),
      birthDate: new Date('1985-05-15T00:00:00.000Z'),
      avatarUrl: '/avatars/doctor-default.png',
    },
  });

  const doctor = await prisma.doctorProfile.create({
    data: {
      staffProfileId: staff.id,
      specialty: 'GENERAL_INTERNAL_MEDICINE',
      licenseNumber: `GPH-${runId}`,
      qualification: 'Bác sĩ CKI',
      yearsExperience: 12,
    },
    include: {
      staffProfile: { include: { user: true } },
    },
  });
  await doctorIntegrity.anchorChange(doctor, 'CREATE', adminUser.id, null);

  const patient = await prisma.patient.create({
    data: {
      patientCode: `BN-${runId}`,
      fullName: `Bệnh nhân Nguyễn Thị ${runId}`,
      gender: 'FEMALE',
      birthDate: new Date('1990-08-20T00:00:00.000Z'),
      phone: '0901234567',
      address: '123 ĐườngDemo, Phường 1, TP.HCM',
    },
  });

  const visit = await prisma.visit.create({
    data: {
      visitCode: `LK-${runId}`,
      patientId: patient.id,
      departmentId: department.id,
      staffId: staff.id,
      status: 'IN_PROGRESS',
    },
  });

  const aiModel = await prisma.aiModelRegistry.create({
    data: {
      modelName: `ZKP-DiagAI-${runId}`,
      modelVersion: '2.1.0',
      ipHashEncrypted: `enc-hash-${runId}`,
      ipHashPlain: `plain-hash-${runId}`,
      createdBy: adminUser.id,
      type: 'API',
      status: 'ACTIVE',
      apiEndpoint: 'https://ai.hospital.local/v2/diagnose',
      description: 'Mô hình AI hỗ trợ chẩn đoán ảnh chụp X-Quang phổi',
    },
  });
  await aiModelIntegrity.anchorChange(aiModel, 'CREATE', adminUser.id, null);

  console.log('\n---------------------------------------------------------');
  console.log('🔹 CASE 1 [SỬA]: MedicalConclusion bị thay đổi trái phép');
  const conclusionOriginal = await prisma.medicalConclusion.create({
    data: {
      visitId: visit.id,
      doctorId: doctor.id,
      finalDiagnosis: 'Viêm phế quản cấp tính nhẹ (Chẩn đoán ban đầu chuẩn xác)',
      treatmentPlan: 'Nghỉ ngơi 3 ngày, uống nhiều nước ấm, theo dõi thân nhiệt.',
      prescription: 'Paracetamol 500mg (sáng 1v, chiều 1v), Siro ho Phế Bách Cụ',
      doctorNote: 'Bệnh nhân không có tiền sử dị ứng thuốc.',
    },
  });
  await conclusionIntegrity.anchorChange({
    ...conclusionOriginal,
    visit: { patient: { patientCode: patient.patientCode } },
  }, 'CREATE', doctorUser.id, null);

  await anchorRequired('Case 1 trusted MedicalConclusion');

  // Tamper Case 1: Directly overwrite MedicalConclusion in Postgres without logging audit
  await prisma.medicalConclusion.update({
    where: { id: conclusionOriginal.id },
    data: {
      finalDiagnosis: `HACKED: Viêm phổi vi-rút nguy hiểm tính mạng! (${runId})`,
      treatmentPlan: 'HACKED: Nhập viện cấp cứu gấp, truyền kháng sinh liều cao!',
      prescription: 'HACKED: Đơn thuốc giả mạo 5,000,000 VND',
    },
  });
  console.log(` 💥 [TAMPERED] MedicalConclusion (ID: ${conclusionOriginal.id}) đã bị sửa trực tiếp trong PostgreSQL!`);

  console.log('\n---------------------------------------------------------');
  console.log('🔹 CASE 2 [XÓA]: AiDiagnosis bị xóa cứng, có thể tạo lại trực tiếp');
  const aiDiagnosisOriginal = await prisma.aiDiagnosis.create({
    data: {
      aiModelId: aiModel.id,
      patientId: patient.id,
      visitId: visit.id,
      prompt: 'Phân tích ảnh X-Quang ngực thẳng AP',
      result: '{"finding": "Thâm nhiễm nhẹ thùy dưới phổi phải", "icd10": "J20.9"}',
      confidence: 0.92,
      status: 'DOCTOR_REVIEWED',
      reviewedByDoctorId: doctor.id,
      doctorFeedback: 'Chẩn đoán AI chính xác với hình ảnh lâm sàng',
    },
  });
  await audit.recordV2({
    entity: 'AiDiagnosis',
    entityId: aiDiagnosisOriginal.id,
    action: 'CREATE',
    actorId: doctorUser.id,
    before: null,
    after: buildAiDiagnosisSnapshot(aiDiagnosisOriginal),
  });

  await anchorRequired('Case 2 trusted AiDiagnosis');

  // Tamper Case 2: Hard delete AiDiagnosis record
  await prisma.aiDiagnosis.delete({ where: { id: aiDiagnosisOriginal.id } });
  console.log(` 💥 [DELETED] AiDiagnosis (ID: ${aiDiagnosisOriginal.id}) đã bị xóa cứng khỏi PostgreSQL!`);

  console.log('\n---------------------------------------------------------');
  console.log('🔹 CASE 3 [SỬA]: Department bị thay đổi trái phép');
  const deptTampered = await prisma.department.create({
    data: {
      departmentCode: `K-TM-${runId}`,
      name: `Khoa Tim Mạch ${runId}`,
      type: 'CLINICAL',
      canReceiveOrders: true,
      floor: 'Tầng 4 Khu A',
      description: 'Chuyên khoa Tim mạch và Mạch máu',
    },
  });
  await departmentIntegrity.anchorChange(deptTampered, 'CREATE', adminUser.id, null);

  await anchorRequired('Case 3 trusted Department');

  await prisma.department.update({
    where: { id: deptTampered.id },
    data: {
      name: `Khoa Tim Mạch (HACKER ĐÃ ĐỔI TÊN ${runId})`,
      floor: 'Tầng 99 (Sai lệch)',
    },
  });
  console.log(` 💥 [TAMPERED] Department (ID: ${deptTampered.id}) đã bị sửa trực tiếp trong PostgreSQL!`);

  console.log('\n---------------------------------------------------------');
  console.log('🔹 CASE 4 [XÓA]: MedicalConclusion + Visit cha (khôi phục chuỗi phụ thuộc)');
  const patient4 = await prisma.patient.create({
    data: {
      patientCode: `BN-NEG-${runId}`,
      fullName: `Bệnh nhân Thử Nghiệm Chặn ${runId}`,
      gender: 'MALE',
      birthDate: new Date('1988-12-12T00:00:00.000Z'),
    },
  });
  const visit4 = await prisma.visit.create({
    data: {
      visitCode: `LK-NEG-${runId}`,
      patientId: patient4.id,
      departmentId: department.id,
      staffId: staff.id,
    },
  });
  const conclusionBlocked = await prisma.medicalConclusion.create({
    data: {
      visitId: visit4.id,
      doctorId: doctor.id,
      finalDiagnosis: 'Kết luận thử nghiệm khôi phục bị chặn do đứt quan hệ',
    },
  });
  await audit.recordV2({
    entity: 'Visit',
    entityId: visit4.id,
    action: 'CREATE',
    actorId: doctorUser.id,
    before: null,
    after: buildVisitSnapshot(visit4),
    metadata: { schema: 'KLTN_VISIT_CREATE_AUDIT_V3', demoCase: 'CASE_4_DELETED_PARENT' },
  });
  await conclusionIntegrity.anchorChange({
    ...conclusionBlocked,
    visit: { patient: { patientCode: patient4.patientCode } },
  }, 'CREATE', doctorUser.id, null);

  await anchorRequired('Case 4 trusted Visit + MedicalConclusion dependency chain');

  // Tamper Case 4: Delete BOTH conclusion AND its visit in an audit-authorized transaction
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.audit_recovery_authorized', 'true', true)`;
    await tx.medicalConclusion.delete({ where: { id: conclusionBlocked.id } });
    await tx.visit.delete({ where: { id: visit4.id } });
  });
  console.log(` 💥 [DELETED BOTH] MedicalConclusion (${conclusionBlocked.id}) và Visit (${visit4.id}) đã bị xóa!`);

  console.log('\n---------------------------------------------------------');
  console.log('🔹 CASE 5 [SỬA + XÓA AUDIT]: BlockchainLogger trong một batch bị can thiệp');
  const probe1 = await audit.recordV2({
    entity: 'DemoProbe',
    entityId: `probe-1-${runId}`,
    action: 'CREATE',
    actorId: adminUser.id,
    before: null,
    after: { test: 'Probe log 1' },
  });
  const probe2 = await audit.recordV2({
    entity: 'DemoProbe',
    entityId: `probe-2-${runId}`,
    action: 'CREATE',
    actorId: adminUser.id,
    before: null,
    after: { test: 'Probe log 2' },
  });

  const auditBatch5 = await anchorRequired('Case 5 trusted audit batch');

  if (auditBatch5) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.audit_recovery_authorized', 'true', true)`;
      // Alter entryHash of probe 1
      await tx.blockchainLogger.update({
        where: { id: probe1.id },
        data: { entryHash: 'f'.repeat(64) },
      });
      // Delete probe 2
      await tx.blockchainLogger.delete({ where: { id: probe2.id } });
    });
    console.log(` 💥 [AUDIT TAMPERED] Audit Batch #${auditBatch5.batchId} đã bị hacker sửa entryHash và xóa 1 log row!`);
  }

  console.log('\n=========================================================');
  console.log('📊 TỔNG HỢP CÁC CASE DEMO ĐÃ TẠO SẴN TRÊN POSTGRESQL');
  console.log('=========================================================');

  const warnings = await entityRecovery.listWarnings();

  console.log(`\nDanh sách Cảnh báo Tính toàn vẹn (Integrity Warnings) phát hiện: ${warnings.items.length} mục`);
  warnings.items.forEach((item, idx) => {
    console.log(`  ${idx + 1}. [${item.entity}] ID: ${item.entityId}`);
    console.log(`     Status: ${item.status} | Recoverable: ${item.recoverable}`);
    console.log(`     Message: ${item.message}`);
  });

  console.log('\n---------------------------------------------------------');
  console.log('📋 HƯỚNG DẪN MANUAL TEST TRÊN GIAO DIỆN ADMIN (GUI):');
  console.log(` 1. Mở trang Admin Audit Logs: http://localhost:5173/admin (hoặc /admin/audit-logs)`);
  console.log(` 2. Chuyển sang Tab "Cảnh báo dữ liệu / Integrity Warnings":`);
  console.log(`    - Case 1 (MedicalConclusion: ${conclusionOriginal.id}): Thấy trạng thái TAMPERED. Click "Khôi phục" -> Chẩn đoán vi-rút sẽ được phục hồi lại về phế quản ban đầu.`);
  console.log(`    - Case 2 (AiDiagnosis: ${aiDiagnosisOriginal.id}): Thấy trạng thái MISSING, preview RECREATE. Click "Tạo lại từ IPFS" -> Kết quả AI tạo lại khớp 100% FK.`);
  console.log(`    - Case 3 (Department: ${deptTampered.id}): Thấy trạng thái TAMPERED. Click "Khôi phục" -> Tên khoa được sửa lại đúng.`);
  console.log(`    - Case 4 [XÓA CHUỖI] MedicalConclusion: ${conclusionBlocked.id}; Visit: ${visit4.id}. Trạng thái MISSING + DEPENDENCY_CHAIN. Click "Khôi phục chuỗi phụ thuộc" để tạo Visit trước rồi Conclusion.`);
  console.log(` 3. Chuyển sang Tab "Audit Batches":`);
  console.log(`    - Case 5 (Batch #${auditBatch5?.batchId}): Thấy trạng thái Batch nghi sửa đổi/Lệch hash. Thực hiện Batch Recovery để khôi phục nhật ký từ Sepolia/Pinata.`);
  console.log('=========================================================\n');

  await app.close();
}

main().catch((err) => {
  console.error('❌ Lỗi khi khởi tạo Tamper Recovery Demo:', err);
  process.exit(1);
});
