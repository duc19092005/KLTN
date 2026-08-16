import '../src/config/load-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { AuditLoggerService } from '../src/infrastructure/audit/audit-logger.service';
import { AuditAnchorService } from '../src/infrastructure/audit/audit-anchor.service';
import {
  DepartmentType,
  LabSpecialty,
  MedicalOrderStatus,
  MedicalSpecialty,
  OperationalStatus,
  UserRole,
  UserStatus,
  VisitSource,
  VisitStatus,
} from '@prisma/client';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { buildDepartmentSnapshot } from '../src/modules/department/domain/department-snapshot';
import { buildStaffSnapshot } from '../src/modules/staff/domain/staff-snapshot';
import { buildUnifiedDoctorSnapshot } from '../src/modules/doctor/domain/doctor-snapshot';
import { buildAiModelSnapshot } from '../src/modules/ai-model/domain/ai-model-snapshot';
import { buildPatientSnapshot } from '../src/modules/patient/domain/patient-snapshot';
import { buildVisitSnapshot } from '../src/modules/visit/domain/visit-snapshot';
import { buildMedicalOrderSnapshot } from '../src/modules/medical-order/domain/medical-order-snapshot';
import { buildMedicalResultSnapshot } from '../src/modules/medical-order/domain/medical-result-snapshot';
import { buildAiDiagnosisSnapshot } from '../src/modules/clinical-decision/domain/ai-diagnosis-snapshot';
import { buildAiQualitySnapshot } from '../src/modules/ai-model/domain/ai-quality-snapshot';
import { buildMedicalConclusionSnapshot } from '../src/modules/clinical-decision/domain/medical-conclusion-snapshot';

async function seed() {
  console.log('🌱 Starting full Hospital & Clinical Flow Seed with V2 Audit Logging...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const prisma = app.get(PrismaService);
  const audit = app.get(AuditLoggerService);
  const anchor = app.get(AuditAnchorService);

  const passwordHash = await bcrypt.hash('Hospital@123', 10);
  const rawInviteToken = process.env.SEED_ADMIN_INVITE_TOKEN || 'admin-bootstrap-token';
  const inviteToken = `sha256:${crypto.createHash('sha256').update(rawInviteToken).digest('hex')}`;

  // -------------------------------------------------------------
  // 1. Seed Admin User
  // -------------------------------------------------------------
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { role: UserRole.ADMIN, status: UserStatus.ACTIVE, firstLogin: false },
    create: {
      username: 'admin',
      email: 'admin@hospital.local',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      firstLogin: false,
      passwordHash,
      inviteToken,
      adminProfile: {
        create: {
          adminUserName: 'admin',
        },
      },
    },
  });
  console.log('👤 Admin user ready:', admin.username);

  // -------------------------------------------------------------
  // 2. Seed 3 Departments (Hành chính / Tiếp đón, Khám bệnh, Xét nghiệm)
  // -------------------------------------------------------------
  const departmentsData = [
    {
      departmentCode: 'PB-RECEP',
      name: 'Phòng Tiếp Đón & Đăng Ký Khám',
      floor: '1',
      type: DepartmentType.CLINICAL,
      canReceiveOrders: false,
      description: 'Tiếp nhận bệnh nhân, tạo hồ sơ và phân luồng khám bệnh ban đầu.',
    },
    {
      departmentCode: 'PB-CLINIC',
      name: 'Phòng Khám Nội Tổng Quát',
      floor: '2',
      type: DepartmentType.CLINICAL,
      canReceiveOrders: false,
      description: 'Khám lâm sàng, chẩn đoán ban đầu và chỉ định cận lâm sàng.',
    },
    {
      departmentCode: 'PB-LAB',
      name: 'Khoa Xét Nghiệm & Huyết Học',
      floor: '3',
      type: DepartmentType.CLINICAL,
      canReceiveOrders: true,
      description: 'Thực hiện xét nghiệm máu, sinh hóa, miễn dịch và trả kết quả.',
    },
  ];

  const deptMap = new Map<string, any>();

  for (const item of departmentsData) {
    let dept = await prisma.department.findUnique({ where: { departmentCode: item.departmentCode } });
    if (!dept) {
      const integrity = audit.hashSnapshot(buildDepartmentSnapshot({ ...item, status: OperationalStatus.ACTIVE }));
      dept = await prisma.department.create({
        data: {
          ...item,
          status: OperationalStatus.ACTIVE,
          hash256: integrity.hash,
          dataSalt: integrity.salt,
        },
      });

      await audit.recordV2({
        entity: 'Department',
        entityId: dept.id,
        action: 'CREATE',
        actorId: admin.id,
        before: null,
        after: buildDepartmentSnapshot(dept),
      });
      console.log(`🏢 Seeded Department: ${dept.name} (${dept.departmentCode})`);
    }
    deptMap.set(item.departmentCode, dept);
  }

  // -------------------------------------------------------------
  // 3. Seed 3 Staff Roles (Lễ tân, Bác sĩ Nội, Kỹ thuật viên Xét nghiệm)
  // -------------------------------------------------------------

  // 3.1 Receptionist (Tiếp tân tại PB-RECEP)
  let recepUser = await prisma.user.findUnique({ where: { username: 'receptionist' } });
  if (!recepUser) {
    recepUser = await prisma.user.create({
      data: {
        username: 'receptionist',
        email: 'letan@hospital.local',
        phone: '0901000001',
        phoneNormalized: '+84901000001',
        role: UserRole.RECEPTIONIST,
        status: UserStatus.ACTIVE,
        firstLogin: false,
        passwordHash,
      },
    });
  }

  let recepStaff = await prisma.staffProfile.findUnique({ where: { employeeCode: 'NV-RECEP-001' } });
  if (!recepStaff) {
    const staffData = {
      userId: recepUser.id,
      departmentId: deptMap.get('PB-RECEP').id,
      fullName: 'Trần Thị Mai',
      phone: '0901000001',
      gender: 'FEMALE',
      citizenId: '079195000001',
      birthDate: new Date('1995-04-12'),
      address: '123 Cách Mạng Tháng 8, Q.3, TP.HCM',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2',
      employeeCode: 'NV-RECEP-001',
      position: 'Nhân viên tiếp đón & điều phối bệnh nhân',
    };
    const integrity = audit.hashSnapshot(buildStaffSnapshot(staffData));
    recepStaff = await prisma.staffProfile.create({
      data: { ...staffData, hash256: integrity.hash, dataSalt: integrity.salt },
    });
    await audit.recordV2({
      entity: 'StaffProfile',
      entityId: recepStaff.id,
      action: 'CREATE',
      actorId: admin.id,
      before: null,
      after: buildStaffSnapshot(recepStaff),
    });
    console.log(`👩‍💼 Seeded Receptionist: ${recepStaff.fullName}`);
  }

  // 3.2 Doctor (Bác sĩ Nội tại PB-CLINIC)
  let doctorUser = await prisma.user.findUnique({ where: { username: 'doctor_noi' } });
  if (!doctorUser) {
    doctorUser = await prisma.user.create({
      data: {
        username: 'doctor_noi',
        email: 'bacsi.noi@hospital.local',
        phone: '0902000002',
        phoneNormalized: '+84902000002',
        role: UserRole.DOCTOR,
        status: UserStatus.ACTIVE,
        firstLogin: false,
        passwordHash,
      },
    });
  }

  let doctorStaff = await prisma.staffProfile.findUnique({ where: { employeeCode: 'BS-NOI-001' } });
  if (!doctorStaff) {
    const staffData = {
      userId: doctorUser.id,
      departmentId: deptMap.get('PB-CLINIC').id,
      fullName: 'BS. CKI Nguyễn Văn Hoàng',
      phone: '0902000002',
      gender: 'MALE',
      citizenId: '079185000002',
      birthDate: new Date('1985-08-20'),
      address: '456 Nguyễn Đình Chiểu, Q.1, TP.HCM',
      avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d',
      employeeCode: 'BS-NOI-001',
      position: 'Bác sĩ điều trị Nội khoa',
    };
    const integrity = audit.hashSnapshot(buildStaffSnapshot(staffData));
    doctorStaff = await prisma.staffProfile.create({
      data: { ...staffData, hash256: integrity.hash, dataSalt: integrity.salt },
    });
    await audit.recordV2({
      entity: 'StaffProfile',
      entityId: doctorStaff.id,
      action: 'CREATE',
      actorId: admin.id,
      before: null,
      after: buildStaffSnapshot(doctorStaff),
    });
  }

  let doctorProfile = await prisma.doctorProfile.findUnique({ where: { licenseNumber: 'CCHND-001234' } });
  if (!doctorProfile) {
    const docData = {
      staffProfileId: doctorStaff.id,
      specialty: MedicalSpecialty.GENERAL_INTERNAL_MEDICINE,
      licenseNumber: 'CCHND-001234',
      qualification: 'Bác sĩ Chuyên khoa I Nội Tổng Quát - ĐH Y Dược TP.HCM',
      yearsExperience: 12,
    };
    const integrity = audit.hashSnapshot(buildUnifiedDoctorSnapshot({ ...docData, staffProfile: doctorStaff }));
    doctorProfile = await prisma.doctorProfile.create({
      data: { ...docData, hash256: integrity.hash, dataSalt: integrity.salt },
    });
    await audit.recordV2({
      entity: 'DoctorProfile',
      entityId: doctorProfile.id,
      action: 'CREATE',
      actorId: admin.id,
      before: null,
      after: buildUnifiedDoctorSnapshot({ ...doctorProfile, staffProfile: doctorStaff }),
    });
    console.log(`👨‍⚕️ Seeded Doctor: ${doctorStaff.fullName} (${doctorProfile.licenseNumber})`);
  }

  // 3.3 Lab Technician (Kỹ thuật viên tại PB-LAB)
  let labUser = await prisma.user.findUnique({ where: { username: 'lab_tech' } });
  if (!labUser) {
    labUser = await prisma.user.create({
      data: {
        username: 'lab_tech',
        email: 'xetnghiem@hospital.local',
        phone: '0903000003',
        phoneNormalized: '+84903000003',
        role: UserRole.LAB_MANAGER,
        status: UserStatus.ACTIVE,
        firstLogin: false,
        passwordHash,
      },
    });
  }

  let labStaff = await prisma.staffProfile.findUnique({ where: { employeeCode: 'KTV-LAB-001' } });
  if (!labStaff) {
    const staffData = {
      userId: labUser.id,
      departmentId: deptMap.get('PB-LAB').id,
      fullName: 'KTV. Lê Văn Hùng',
      phone: '0903000003',
      gender: 'MALE',
      citizenId: '079190000003',
      birthDate: new Date('1990-11-05'),
      address: '789 Lý Thường Kiệt, Q.10, TP.HCM',
      avatarUrl: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54',
      employeeCode: 'KTV-LAB-001',
      position: 'Kỹ thuật viên trưởng Khoa Xét nghiệm',
      labSpecialty: LabSpecialty.LABORATORY,
    };
    const integrity = audit.hashSnapshot(buildStaffSnapshot(staffData));
    labStaff = await prisma.staffProfile.create({
      data: { ...staffData, hash256: integrity.hash, dataSalt: integrity.salt },
    });
    await audit.recordV2({
      entity: 'StaffProfile',
      entityId: labStaff.id,
      action: 'CREATE',
      actorId: admin.id,
      before: null,
      after: buildStaffSnapshot(labStaff),
    });
    console.log(`🔬 Seeded Lab Technician: ${labStaff.fullName}`);
  }

  // -------------------------------------------------------------
  // 4. Seed AI Model Registry
  // -------------------------------------------------------------
  let aiModel = await prisma.aiModelRegistry.findFirst({ where: { modelName: 'Dengue Diagnostic AI Model' } });
  if (!aiModel) {
    const modelData = {
      modelName: 'Dengue Diagnostic AI Model',
      modelVersion: '1.0.0',
      recommendedSpecialty: MedicalSpecialty.GENERAL_INTERNAL_MEDICINE,
      type: 'API',
      provider: 'Hospital Clinical AI Engine',
      apiEndpoint: 'https://ai-engine.hospital.local/v1/dengue/predict',
      ipHashEncrypted: 'enc-dengue-model-ip-v100',
      ipHashPlain: 'plain-dengue-model-ip-v100',
      description: 'Mô hình AI hỗ trợ phát hiện sớm Sốt xuất huyết Dengue từ kết quả công thức máu.',
      status: OperationalStatus.ACTIVE,
      createdBy: admin.id,
    };
    const integrity = audit.hashSnapshot(buildAiModelSnapshot(modelData));
    aiModel = await prisma.aiModelRegistry.create({
      data: { ...modelData, hash256: integrity.hash, dataSalt: integrity.salt },
    });
    await audit.recordV2({
      entity: 'AiModelRegistry',
      entityId: aiModel.id,
      action: 'CREATE',
      actorId: admin.id,
      before: null,
      after: buildAiModelSnapshot(aiModel),
    });
    console.log(`🤖 Seeded AI Model: ${aiModel.modelName}`);
  }

  // -------------------------------------------------------------
  // 5. Seed Full Clinical Workflow
  // (Lễ tân -> Bệnh nhân -> Ca khám -> Y lệnh xét nghiệm -> Trả KQ -> AI chẩn đoán & đánh giá -> Bác sĩ Kết luận)
  // -------------------------------------------------------------
  let patient = await prisma.patient.findUnique({ where: { patientCode: 'BN-2026-0001' } });
  if (!patient) {
    const patientData = {
      patientCode: 'BN-2026-0001',
      fullName: 'Nguyễn Văn An',
      gender: 'MALE',
      birthDate: new Date('1990-05-15'),
      citizenId: '079090123456',
      phone: '0901234567',
      address: '123 Nguyễn Trãi, Phường 2, Quận 5, TP. Hồ Chí Minh',
      insuranceNumber: 'DN4790901234567',
      emergencyContact: 'Vợ: Trần Thị Lan - SĐT: 0909876543',
    };
    const integrity = audit.hashSnapshot(buildPatientSnapshot(patientData));
    patient = await prisma.patient.create({
      data: { ...patientData, hash256: integrity.hash, dataSalt: integrity.salt },
    });
    await audit.recordV2({
      entity: 'Patient',
      entityId: patient.id,
      action: 'CREATE',
      actorId: recepUser.id,
      before: null,
      after: buildPatientSnapshot(patient),
    });
    console.log(`🏥 [Step 1: Receptionist] Created Patient: ${patient.fullName} (${patient.patientCode})`);
  }

  let visit = await prisma.visit.findUnique({ where: { visitCode: 'LK-2026-0001' } });
  if (!visit) {
    const visitData = {
      visitCode: 'LK-2026-0001',
      patientId: patient.id,
      departmentId: deptMap.get('PB-CLINIC').id,
      staffId: recepStaff.id,
      status: VisitStatus.IN_PROGRESS,
      source: VisitSource.WALK_IN,
      checkInAt: new Date(),
    };
    visit = await prisma.visit.create({ data: visitData });
    await audit.recordV2({
      entity: 'Visit',
      entityId: visit.id,
      action: 'CREATE',
      actorId: recepUser.id,
      before: null,
      after: buildVisitSnapshot(visit),
    });
    console.log(`📋 [Step 2: Receptionist] Registered Visit: ${visit.visitCode} at ${deptMap.get('PB-CLINIC').name}`);
  }

  let medicalOrder = await prisma.medicalOrder.findUnique({ where: { orderCode: 'ORD-2026-0001' } });
  if (!medicalOrder) {
    const orderData = {
      orderCode: 'ORD-2026-0001',
      visitId: visit.id,
      patientId: patient.id,
      doctorId: doctorProfile.id,
      targetDepartmentId: deptMap.get('PB-LAB').id,
      orderType: 'XÉT NGHIỆM HUYẾT HỌC & MIỄN DỊCH',
      priority: 'URGENT',
      clinicalNote: 'Bệnh nhân sốt cao liên tục 3 ngày, đau nhức cơ khớp, nghi ngờ nhiễm Dengue. Yêu cầu: Tổng phân tích tế bào máu ngoại vi + Dengue NS1 Ag nhanh.',
      status: MedicalOrderStatus.RESULT_READY,
    };
    medicalOrder = await prisma.medicalOrder.create({ data: orderData });
    await audit.recordV2({
      entity: 'MedicalOrder',
      entityId: medicalOrder.id,
      action: 'CREATE',
      actorId: doctorUser.id,
      before: null,
      after: buildMedicalOrderSnapshot(medicalOrder),
    });
    console.log(`🩺 [Step 3: Doctor] Created Medical Order: ${medicalOrder.orderCode} sent to ${deptMap.get('PB-LAB').name}`);
  }

  let medicalResult = await prisma.medicalResult.findUnique({ where: { resultCode: 'RES-2026-0001' } });
  if (!medicalResult) {
    const resultData = {
      resultCode: 'RES-2026-0001',
      orderId: medicalOrder.id,
      performedById: labUser.id,
      note: 'Tiểu cầu (PLT) giảm: 102 G/L (Bình thường: 150-450). Bạch cầu (WBC): 3.1 G/L. Hct: 43.5%. Dengue NS1 Ag: DƯƠNG TÍNH (+).',
      returnedAt: new Date(),
      files: {
        create: [
          {
            fileName: 'phieu_xet_nghiem_huyet_hoc_BN20260001.pdf',
            originalName: 'Phieu_Ket_Qua_Xet_Nghiem_BN20260001.pdf',
            mimeType: 'application/pdf',
            size: 1450000,
            storageProvider: 'CLOUDINARY',
            url: 'https://res.cloudinary.com/hospital/raw/upload/v1/xet_nghiem_BN20260001.pdf',
            sha256: crypto.createHash('sha256').update('pdf-result-seed-content').digest('hex'),
          },
          {
            fileName: 'bieu_do_cong_thuc_mau.png',
            originalName: 'Bieu_Do_Cong_Thuc_Mau.png',
            mimeType: 'image/png',
            size: 2100000,
            storageProvider: 'CLOUDINARY',
            url: 'https://res.cloudinary.com/hospital/image/upload/v1/bieu_do_BN20260001.png',
            sha256: crypto.createHash('sha256').update('png-result-seed-content').digest('hex'),
          },
        ],
      },
    };
    medicalResult = await prisma.medicalResult.create({
      data: resultData,
      include: { files: true },
    });
    await audit.recordV2({
      entity: 'MedicalResult',
      entityId: medicalResult.id,
      action: 'CREATE',
      actorId: labUser.id,
      before: null,
      after: buildMedicalResultSnapshot({ ...medicalResult, visitId: visit.id }),
    });
    console.log(`🧪 [Step 4: Lab Tech] Performed & Returned Result: ${medicalResult.resultCode} (with 2 attached files)`);
  }

  let aiDiag = await prisma.aiDiagnosis.findFirst({ where: { visitId: visit.id } });
  if (!aiDiag) {
    const diagData = {
      aiModelId: aiModel.id,
      patientId: patient.id,
      visitId: visit.id,
      prompt: 'Phân tích công thức máu: PLT 102 G/L, WBC 3.1 G/L, Hct 43.5%, Dengue NS1 (+), sốt ngày 3.',
      result: JSON.stringify({
        primaryDiagnosis: 'Sốt xuất huyết Dengue ngày thứ 3 có dấu hiệu cảnh báo',
        riskLevel: 'MEDIUM_HIGH',
        recommendation: 'Theo dõi sát dấu hiệu cảnh báo, bù dịch đường uống/truyền tĩnh mạch, kiểm tra tiểu cầu mỗi 12-24h.',
        confidence: 0.96,
      }),
      confidence: 0.96,
      status: 'DOCTOR_REVIEWED',
      reviewedByDoctorId: doctorProfile.id,
      doctorFeedback: 'Đồng thuận với gợi ý chẩn đoán của AI. Dữ liệu khớp triệu chứng lâm sàng.',
    };
    aiDiag = await prisma.aiDiagnosis.create({ data: diagData });
    await audit.recordV2({
      entity: 'AiDiagnosis',
      entityId: aiDiag.id,
      action: 'CREATE',
      actorId: doctorUser.id,
      before: null,
      after: buildAiDiagnosisSnapshot(aiDiag),
    });
    console.log(`🤖 [Step 5: AI Engine] Generated Diagnosis (Confidence: 96%)`);

    const qualityData = {
      doctorId: doctorProfile.id,
      aiModelId: aiModel.id,
      aiDiagnosisId: aiDiag.id,
      doctorConclusionAboutModel: 'Mô hình phát hiện chính xác dấu hiệu cảnh báo hạ tiểu cầu ở giai đoạn nguy hiểm ngày thứ 3.',
      trustablePercent: 96.0,
    };
    const integrityQuality = audit.hashSnapshot(qualityData);
    const aiQuality = await prisma.aiQuality.create({
      data: { ...qualityData, hash256: integrityQuality.hash, dataSalt: integrityQuality.salt },
    });
    await audit.recordV2({
      entity: 'AiQuality',
      entityId: aiQuality.id,
      action: 'AI_MODEL_RATED',
      actorId: doctorUser.id,
      before: null,
      after: buildAiQualitySnapshot(aiQuality),
    });
    console.log(`⭐ [Step 5b: Doctor] Rated AI Diagnosis Quality: 96%`);
  }

  let conclusion = await prisma.medicalConclusion.findUnique({ where: { visitId: visit.id } });
  if (!conclusion) {
    const conclusionData = {
      visitId: visit.id,
      doctorId: doctorProfile.id,
      aiDiagnosisId: aiDiag?.id || null,
      finalDiagnosis: 'Sốt xuất huyết Dengue có dấu hiệu cảnh báo ngày thứ 3 (Mã ICD-10: A97.1)',
      treatmentPlan: 'Bù dịch Ringer Lactate đường uống và truyền tĩnh mạch theo phác đồ Bộ Y Tế. Theo dõi sát mạch, huyết áp, tri giác và tiểu cầu mỗi 12h.',
      prescription: '1. Paracetamol 500mg (Hộp 20 viên): Uống 1 viên khi sốt >= 38.5°C, cách ít nhất 6 giờ, không quá 4 viên/ngày.\n2. Oresol 245 (Gói 10 gói): Pha 1 gói trong 200ml nước đun sôi để nguội, uống rải rác trong ngày.',
      followUpNote: 'Tái khám ngay tại khoa cấp cứu nếu xuất hiện đau bụng nhiều, nôn ói liên tục, chảy máu chân răng/cam hoặc mệt lả.',
      doctorNote: 'Bệnh nhân tỉnh táo, tiếp xúc tốt, chưa ghi nhận xuất huyết dưới da tự phát.',
      concludedAt: new Date(),
    };
    const integrity = audit.hashSnapshot({ ...conclusionData, patientCode: patient.patientCode });
    conclusion = await prisma.medicalConclusion.create({
      data: { ...conclusionData, hash256: integrity.hash, dataSalt: integrity.salt },
    });

    await prisma.visit.update({
      where: { id: visit.id },
      data: { status: VisitStatus.COMPLETED, completedAt: new Date() },
    });

    await audit.recordV2({
      entity: 'MedicalConclusion',
      entityId: conclusion.id,
      action: 'CREATE',
      actorId: doctorUser.id,
      before: null,
      after: buildMedicalConclusionSnapshot({ ...conclusion, visit: { patient } }),
    });
    console.log(`✅ [Step 6: Doctor] Concluded Visit & Prescribed Treatment for Patient: ${patient.fullName}`);
  }

  // -------------------------------------------------------------
  // 6. Anchor All Seed Logs to Blockchain Checkpoint
  // -------------------------------------------------------------
  console.log('🔗 Sealing and Anchoring all Seed Logs to Blockchain & IPFS...');
  await anchor.rechainLocalBlockchainLogger();
  const anchorResult = await anchor.anchorNowWithinRecovery();
  if (anchorResult.committed) {
    console.log(`🎉 Batch #${anchorResult.batchId} ANCHORED & COMMITTED ON-CHAIN successfully with ${anchorResult.leafCount} audit records!`);
  } else {
    console.log(`ℹ️ Anchor status: ${anchorResult.reason || 'No unanchored records'}`);
  }

  console.log('\n🌟 [SEED COMPLETED] System is fully configured with 3 Departments, All Staff Roles, AI Model, and Completed Clinical Flow!');
  await app.close();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
