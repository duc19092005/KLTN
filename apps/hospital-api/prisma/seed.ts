import '../src/config/load-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { AuditLoggerService } from '../src/infrastructure/audit';
import { AuditAnchorService } from '../src/infrastructure/audit';
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
  console.log('================================================================================');
  console.log('🏥 KHỞI TẠO DỮ LIỆU ĐẦY ĐỦ LUỒNG CHẨN ĐOÁN LÂM SÀNG & TỰ ĐỘNG NEO BLOCKCHAIN');
  console.log('================================================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const prisma = app.get(PrismaService);
  const audit = app.get(AuditLoggerService);
  const anchor = app.get(AuditAnchorService);

  const defaultPassword = 'Hospital@123';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);
  const rawInviteToken = process.env.SEED_ADMIN_INVITE_TOKEN || 'admin-bootstrap-token';
  const inviteToken = `sha256:${crypto.createHash('sha256').update(rawInviteToken).digest('hex')}`;

  // ---------------------------------------------------------------------------------
  // 1. KIỂM TRA TÀI KHOẢN ADMIN THỰC TẾ TRONG DATABASE
  // ---------------------------------------------------------------------------------
  console.log('🔍 [Bước 1/6] Kiểm tra tài khoản Quản trị viên (Admin) trong DB...');
  let admin = await prisma.user.findFirst({
    where: {
      OR: [
        { role: UserRole.ADMIN },
        { adminProfile: { isNot: null } },
        { username: 'admin' },
      ],
    },
    include: { adminProfile: true },
  });

  if (!admin) {
    admin = await prisma.user.create({
      data: {
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
      include: { adminProfile: true },
    });
    console.log(`   ➕ Tạo mới tài khoản Admin mặc định: "${admin.username}" (ID: ${admin.id})`);
  } else {
    console.log(`   ✅ Đã phát hiện tài khoản Admin có sẵn trong DB: "${admin.username || admin.email}" (ID: ${admin.id})`);
  }

  // ---------------------------------------------------------------------------------
  // 2. KHỞI TẠO 3 PHÒNG BAN CHUẨN QUY TRÌNH BỆNH VIỆN
  // ---------------------------------------------------------------------------------
  console.log('\n🏢 [Bước 2/6] Khởi tạo & Đối soát 3 Phòng ban chức năng...');
  const departmentsData = [
    {
      departmentCode: 'PB-RECEP',
      name: 'Phòng Tiếp Đón & Đăng Ký Khám',
      floor: '1',
      type: DepartmentType.CLINICAL,
      canReceiveOrders: false,
      description: 'Tiếp nhận bệnh nhân, tạo hồ sơ y tế, cấp số thứ tự và phân luồng khám bệnh ban đầu.',
    },
    {
      departmentCode: 'PB-CLINIC',
      name: 'Phòng Khám Nội Tổng Quát',
      floor: '2',
      type: DepartmentType.CLINICAL,
      canReceiveOrders: false,
      description: 'Khám lâm sàng, chẩn đoán ban đầu, chỉ định cận lâm sàng và kê đơn kết luận điều trị.',
    },
    {
      departmentCode: 'PB-LAB',
      name: 'Khoa Xét Nghiệm & Huyết Học',
      floor: '3',
      type: DepartmentType.CLINICAL,
      canReceiveOrders: true,
      description: 'Tiếp nhận y lệnh, thực hiện xét nghiệm huyết học, sinh hóa, miễn dịch và trả kết quả.',
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
      console.log(`   ➕ Đã tạo và ghi log Audit V2 cho Phòng ban: ${dept.name} (${dept.departmentCode})`);
    } else {
      console.log(`   ✅ Phòng ban đã tồn tại: ${dept.name} (${dept.departmentCode})`);
    }
    deptMap.set(item.departmentCode, dept);
  }

  // ---------------------------------------------------------------------------------
  // 3. KHỞI TẠO 3 NHÂN SỰ ĐẠI DIỆN 3 VAI TRÒ
  // ---------------------------------------------------------------------------------
  console.log('\n👥 [Bước 3/6] Khởi tạo & Đối soát 3 Nhân sự đại diện các vai trò...');

  // 3.1 Lễ tân (Receptionist)
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
      address: '123 Cách Mạng Tháng 8, Phường 5, Quận 3, TP.HCM',
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
    console.log(`   ➕ Đã tạo Lễ tân: ${recepStaff.fullName} (${recepStaff.employeeCode})`);
  } else {
    console.log(`   ✅ Đã tìm thấy Lễ tân: ${recepStaff.fullName} (${recepStaff.employeeCode})`);
  }

  // 3.2 Bác sĩ Nội khoa (Doctor)
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
      address: '456 Nguyễn Đình Chiểu, Phường Đa Kao, Quận 1, TP.HCM',
      avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d',
      employeeCode: 'BS-NOI-001',
      position: 'Bác sĩ điều trị Nội khoa Tổng quát',
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
    console.log(`   ➕ Đã tạo Bác sĩ: ${doctorStaff.fullName} (CCHND: ${doctorProfile.licenseNumber})`);
  } else {
    console.log(`   ✅ Đã tìm thấy Bác sĩ: ${doctorStaff.fullName} (CCHND: ${doctorProfile.licenseNumber})`);
  }

  // 3.3 Kỹ thuật viên Xét nghiệm (Lab Tech / Lab Manager)
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
      address: '789 Lý Thường Kiệt, Phường 11, Quận 10, TP.HCM',
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
    console.log(`   ➕ Đã tạo Kỹ thuật viên Xét nghiệm: ${labStaff.fullName} (${labStaff.employeeCode})`);
  } else {
    console.log(`   ✅ Đã tìm thấy Kỹ thuật viên: ${labStaff.fullName} (${labStaff.employeeCode})`);
  }

  // ---------------------------------------------------------------------------------
  // 4. KHỞI TẠO MÔ HÌNH AI CHẨN ĐOÁN
  // ---------------------------------------------------------------------------------
  console.log('\n🤖 [Bước 4/6] Khởi tạo & Đối soát Mô hình AI Chẩn đoán...');
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
    console.log(`   ➕ Đã đăng ký Mô hình AI: ${aiModel.modelName} (Phiên bản: ${aiModel.modelVersion})`);
  } else {
    console.log(`   ✅ Mô hình AI đã tồn tại: ${aiModel.modelName} (Phiên bản: ${aiModel.modelVersion})`);
  }

  // ---------------------------------------------------------------------------------
  // 5. THỰC THI TOÀN BỘ CHU TRÌNH LÂM SÀNG 6 BƯỚC VỚI PROMPT VÀ KẾT QUẢ ĐẦY ĐỦ
  // ---------------------------------------------------------------------------------
  console.log('\n🩺 [Bước 5/6] Thực thi trọn vẹn Luồng Chẩn đoán Lâm sàng 6 bước...');

  // Bước 5.1: Tiếp tân tiếp đón & Tạo hồ sơ bệnh nhân
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
    console.log(`   👉 [5.1 - Lễ tân] Đã tạo Bệnh nhân: ${patient.fullName} (${patient.patientCode})`);
  } else {
    console.log(`   ✅ [5.1 - Lễ tân] Bệnh nhân đã tồn tại: ${patient.fullName} (${patient.patientCode})`);
  }

  // Bước 5.2: Lễ tân tạo lượt khám và chuyển đến Bác sĩ Nội
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
    console.log(`   👉 [5.2 - Lễ tân] Đăng ký Lượt khám: ${visit.visitCode} tại ${deptMap.get('PB-CLINIC').name}`);
  } else {
    console.log(`   ✅ [5.2 - Lễ tân] Lượt khám đã tồn tại: ${visit.visitCode}`);
  }

  // Bước 5.3: Bác sĩ khám lâm sàng & Tạo y lệnh xét nghiệm gửi Khoa Xét nghiệm
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
      clinicalNote: 'Bệnh nhân sốt cao liên tục 3 ngày (39°C), đau nhức cơ khớp và hốc mắt. Chỉ định khẩn: Tổng phân tích tế bào máu ngoại vi + Test nhanh Dengue NS1 Ag.',
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
    console.log(`   👉 [5.3 - Bác sĩ] Chỉ định Y lệnh xét nghiệm: ${medicalOrder.orderCode} gửi ${deptMap.get('PB-LAB').name}`);
  } else {
    console.log(`   ✅ [5.3 - Bác sĩ] Y lệnh xét nghiệm đã tồn tại: ${medicalOrder.orderCode}`);
  }

  // Bước 5.4: Kỹ thuật viên Khoa Xét nghiệm nhận mẫu, chạy xét nghiệm và trả kết quả kèm file đính kèm
  let medicalResult = await prisma.medicalResult.findUnique({ where: { resultCode: 'RES-2026-0001' } });
  if (!medicalResult) {
    const resultData = {
      resultCode: 'RES-2026-0001',
      orderId: medicalOrder.id,
      performedById: labUser.id,
      note: 'Tiểu cầu (PLT) giảm thấp: 102 G/L (Ngưỡng chuẩn: 150-450). Bạch cầu (WBC): 3.1 G/L. Hct: 43.5% (Cô đặc máu nhẹ). Dengue NS1 Ag: DƯƠNG TÍNH (+).',
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
    console.log(`   👉 [5.4 - Xét nghiệm] Đã trả Kết quả xét nghiệm: ${medicalResult.resultCode} (Kèm 2 files đính kèm PDF & PNG)`);
  } else {
    console.log(`   ✅ [5.4 - Xét nghiệm] Kết quả xét nghiệm đã tồn tại: ${medicalResult.resultCode}`);
  }

  // Bước 5.5: Mô hình AI phân tích dữ liệu với Prompt & Bác sĩ đánh giá chất lượng AI
  let aiDiag = await prisma.aiDiagnosis.findFirst({ where: { visitId: visit.id } });
  if (!aiDiag) {
    const clinicalPrompt = `[THÔNG TIN BỆNH NHÂN & LÂM SÀNG]
- Bệnh nhân: Nguyễn Văn An (34 tuổi, Nam)
- Lý do khám: Sốt cao liên tục ngày 3 (39.2°C), đau mỏi cơ, nhức 2 hốc mắt, mệt lả.
- Dấu hiệu sinh tồn: Mạch 88 lần/phút, Huyết áp 115/75 mmHg, Nhiệt độ 38.8°C, SpO2 98%.

[KẾT QUẢ CẬN LÂM SÀNG]
- Tiểu cầu (PLT): 102 G/L (Giảm mạnh)
- Bạch cầu (WBC): 3.1 G/L (Giảm)
- Hct: 43.5% (Dấu hiệu cô đặc máu)
- Dengue NS1 Ag: DƯƠNG TÍNH (+)

[YÊU CẦU ĐÁNH GIÁ AI]
1. Đưa ra chẩn đoán xác định và phân giai đoạn bệnh.
2. Cảnh báo nguy cơ biến chứng và hướng xử trí.`;

    const aiDiagnosisResult = {
      primaryDiagnosis: 'Sốt xuất huyết Dengue ngày thứ 3 có dấu hiệu cảnh báo (ICD-10: A97.1)',
      diseaseStage: 'Giai đoạn nguy hiểm (Critical Phase: Ngày 3 - Ngày 7)',
      riskLevel: 'MEDIUM_HIGH',
      warningSigns: [
        'Tiểu cầu giảm nhanh 102 G/L',
        'Hct tăng 43.5% có nguy cơ thoát huyết tương',
        'Bạch cầu giảm 3.1 G/L',
      ],
      recommendations: {
        hydration: 'Bù dịch sớm bằng Oresol 245 uống rải rác trong ngày (1.5 - 2 lít). Nếu không uống được hoặc nôn ói, chỉ định truyền tĩnh mạch Ringer Lactate.',
        antipyretic: 'Hạ sốt an toàn bằng Paracetamol 500mg (cách 6h), TUYỆT ĐỐI KHÔNG dùng Aspirin hoặc Ibuprofen.',
        monitoring: 'Theo dõi sát tri giác, mạch, huyết áp và kiểm tra công thức máu mỗi 12-24h.',
      },
      confidence: 0.96,
    };

    const diagData = {
      aiModelId: aiModel.id,
      patientId: patient.id,
      visitId: visit.id,
      prompt: clinicalPrompt,
      result: JSON.stringify(aiDiagnosisResult),
      confidence: 0.96,
      status: 'DOCTOR_REVIEWED',
      reviewedByDoctorId: doctorProfile.id,
      doctorFeedback: 'Đồng thuận với gợi ý chẩn đoán của AI. Dữ liệu phân tích khớp hoàn toàn với triệu chứng lâm sàng và cận lâm sàng.',
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
    console.log(`   👉 [5.5a - AI Engine] Sinh chẩn đoán AI: "Sốt xuất huyết Dengue ngày 3" (Độ tin cậy: 96%)`);

    const qualityData = {
      doctorId: doctorProfile.id,
      aiModelId: aiModel.id,
      aiDiagnosisId: aiDiag.id,
      doctorConclusionAboutModel: 'Mô hình phát hiện chính xác dấu hiệu cảnh báo hạ tiểu cầu ở giai đoạn nguy hiểm ngày thứ 3, đề xuất phác đồ bù dịch hợp lý.',
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
    console.log(`   👉 [5.5b - Bác sĩ] Đã đánh giá chất lượng Mô hình AI: 96.0% (Đạt tiêu chuẩn xuất sắc)`);
  } else {
    console.log(`   ✅ [5.5 - AI & Đánh giá] Chẩn đoán AI và đánh giá chất lượng đã tồn tại`);
  }

  // Bước 5.6: Bác sĩ kết luận ca khám, kê đơn thuốc và hoàn tất ca khám
  let conclusion = await prisma.medicalConclusion.findUnique({ where: { visitId: visit.id } });
  if (!conclusion) {
    const conclusionData = {
      visitId: visit.id,
      doctorId: doctorProfile.id,
      aiDiagnosisId: aiDiag?.id || null,
      finalDiagnosis: 'Sốt xuất huyết Dengue có dấu hiệu cảnh báo ngày thứ 3 (Mã ICD-10: A97.1)',
      treatmentPlan: 'Bù dịch Ringer Lactate đường uống và truyền tĩnh mạch theo phác đồ Bộ Y Tế. Theo dõi sát mạch, huyết áp, tri giác và tiểu cầu mỗi 12h.',
      prescription: '1. Paracetamol 500mg (Hộp 20 viên): Uống 1 viên khi sốt >= 38.5°C, cách ít nhất 6 giờ, không quá 4 viên/ngày.\n2. Oresol 245 (Hộp 10 gói): Pha 1 gói trong 200ml nước đun sôi để nguội, uống rải rác trong ngày.',
      followUpNote: 'Tái khám ngay tại khoa Cấp cứu nếu xuất hiện đau bụng nhiều, nôn ói liên tục, chảy máu chân răng/cam hoặc mệt lả.',
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
    console.log(`   👉 [5.6 - Bác sĩ] Hoàn tất Kết luận Điều trị & Đơn thuốc cho Bệnh nhân: ${patient.fullName}`);
  } else {
    console.log(`   ✅ [5.6 - Bác sĩ] Kết luận ca khám đã tồn tại`);
  }

  // ---------------------------------------------------------------------------------
  // 6. TỰ ĐỘNG CHUẨN HÓA CHUỖI HASH VÀ NEO LÊN SMART CONTRACT TRÊN BLOCKCHAIN
  // ---------------------------------------------------------------------------------
  console.log('\n🔗 [Bước 6/6] Tự động chuẩn hóa chuỗi băm và neo dữ liệu lên Smart Contract & IPFS...');
  await anchor.rechainLocalBlockchainLogger();
  const anchorResult = await anchor.anchorNowWithinRecovery();

  if (anchorResult.committed) {
    console.log(`\n🎉 THÀNH CÔNG! Batch #${anchorResult.batchId} đã được NEO & XÁC THỰC TRÊN BLOCKCHAIN với ${anchorResult.leafCount} bản ghi audit logs!`);
  } else {
    console.log(`\nℹ️ Trạng thái neo Blockchain: ${anchorResult.reason || 'Tất cả bản ghi đã được neo trước đó'}`);
  }

  console.log('\n================================================================================');
  console.log('🌟 [HOÀN TẤT SEED DATA] HỆ THỐNG ĐÃ CÓ ĐẦY ĐỦ 3 PHÒNG BAN, NHÂN SỰ & LUỒNG KHÁM!');
  console.log('================================================================================\n');

  await app.close();
}

seed().catch((err) => {
  console.error('\n❌ Seed thất bại với lỗi:', err);
  process.exit(1);
});
