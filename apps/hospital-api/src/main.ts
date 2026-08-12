import * as crypto from 'crypto';
if (!global.crypto) {
  Object.defineProperty(global, 'crypto', {
    value: crypto.webcrypto || crypto,
  });
}

import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.use(cookieParser());

  const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173,http://localhost:3000,http://localhost:8081')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) => new BadRequestException(formatValidationErrors(errors)),
    }),
  );

  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('API bệnh viện AI Blockchain')
    .setDescription('API quản trị nhân sự, phòng ban, bác sĩ và phòng khám của bệnh viện')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Backend đang chạy tại http://localhost:${port}`);
}
bootstrap();

function formatValidationErrors(errors: ValidationError[]): string[] {
  const messages: string[] = [];
  const visit = (items: ValidationError[]) => {
    for (const error of items) {
      const label = fieldLabel(error.property);
      const constraints = Object.keys(error.constraints || {});
      for (const constraint of constraints) {
        messages.push(validationMessage(label, constraint));
      }
      if (error.children?.length) visit(error.children);
    }
  };

  visit(errors);
  return messages.length ? messages : ['Dữ liệu gửi lên không hợp lệ.'];
}

function fieldLabel(property: string): string {
  const labels: Record<string, string> = {
    username: 'Tên đăng nhập',
    email: 'Email',
    password: 'Mật khẩu',
    currentPassword: 'Mật khẩu hiện tại',
    newPassword: 'Mật khẩu mới',
    confirmPassword: 'Mật khẩu xác nhận',
    inviteToken: 'Mã mời',
    walletAddress: 'Địa chỉ ví',
    signature: 'Chữ ký ví',
    message: 'Nội dung xác thực',
    faceEmbedding: 'Dữ liệu khuôn mặt',
    samples: 'Mẫu khuôn mặt',
    fullName: 'Họ và tên',
    phone: 'Số điện thoại',
    gender: 'Giới tính',
    citizenId: 'CCCD/CMND',
    birthDate: 'Ngày sinh',
    address: 'Địa chỉ',
    emergencyContact: 'Số điện thoại người liên hệ khẩn cấp',
    avatarUrl: 'URL ảnh đại diện',
    departmentId: 'Phòng ban',
    role: 'Vai trò',
    status: 'Trạng thái',
    specialty: 'Chuyên khoa',
    licenseNumber: 'Số chứng chỉ hành nghề',
    qualification: 'Trình độ',
    yearsExperience: 'Số năm kinh nghiệm',
    patientId: 'Bệnh nhân',
    doctorId: 'Bác sĩ',
    visitId: 'Lượt khám',
    orderId: 'Phiếu chỉ định',
    targetDepartmentId: 'Phòng ban nhận chỉ định',
    orderType: 'Loại chỉ định',
    priority: 'Độ ưu tiên',
    clinicalNote: 'Ghi chú lâm sàng',
    finalDiagnosis: 'Chẩn đoán cuối',
    treatmentPlan: 'Phác đồ điều trị',
    prescription: 'Đơn thuốc',
    followUpNote: 'Ghi chú tái khám',
    doctorNote: 'Ghi chú bác sĩ',
    modelName: 'Tên mô hình',
    modelVersion: 'Phiên bản mô hình',
    provider: 'Nền tảng AI',
    apiEndpoint: 'Điểm cuối API',
    secretOrIpHash: 'Khóa API hoặc dấu vân tay',
  };
  return labels[property] || property;
}

function validationMessage(label: string, constraint: string): string {
  const messages: Record<string, string> = {
    isNotEmpty: `${label} không được để trống.`,
    isString: `${label} phải là chuỗi ký tự.`,
    isEmail: `${label} phải là email hợp lệ.`,
    isUUID: `${label} phải là UUID hợp lệ.`,
    isEnum: `${label} không nằm trong danh sách cho phép.`,
    isIn: `${label} không nằm trong danh sách cho phép.`,
    isDateString: `${label} phải là ngày hợp lệ.`,
    isInt: `${label} phải là số nguyên.`,
    isNumber: `${label} phải là số.`,
    isBoolean: `${label} phải là đúng hoặc sai.`,
    isArray: `${label} phải là danh sách.`,
    min: `${label} nhỏ hơn giá trị tối thiểu cho phép.`,
    max: `${label} lớn hơn giá trị tối đa cho phép.`,
    maxLength: `${label} vượt quá độ dài cho phép.`,
    matches:
      label === 'Số điện thoại người liên hệ khẩn cấp'
        ? 'Số điện thoại người liên hệ khẩn cấp phải gồm 10 chữ số và đúng đầu số Việt Nam, ví dụ: 0912345678.'
        : `${label} không đúng định dạng yêu cầu.`,
    isEthereumAddress: `${label} phải là địa chỉ ví Ethereum hợp lệ.`,
    whitelistValidation: `${label} không được phép gửi lên hệ thống.`,
  };
  return messages[constraint] || `${label} không hợp lệ.`;
}
