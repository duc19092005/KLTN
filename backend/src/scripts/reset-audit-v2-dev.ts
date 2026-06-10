import { PrismaClient } from '@prisma/client';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

/**
 * Công cụ chỉ dùng cho môi trường phát triển cục bộ để đặt lại trạng thái
 * Blockchain Audit V2.
 *
 * Script này KHÔNG xóa dữ liệu nghiệp vụ/y tế. Nó chỉ xóa log audit,
 * batch audit và các cột hash kiểm chứng liên quan để lập trình viên có thể
 * seed lại hoặc chạy lại các luồng V2 từ một chuỗi sạch.
 */
const prisma = new PrismaClient();

function assertLocalOnly() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Từ chối reset audit trong môi trường production.');
  }

  if (process.env.ALLOW_DEV_AUDIT_RESET !== 'true') {
    throw new Error('Hãy đặt ALLOW_DEV_AUDIT_RESET=true để xác nhận thao tác reset local có tính phá hủy.');
  }

  const databaseUrl = process.env.DATABASE_URL ?? '';
  const lowered = databaseUrl.toLowerCase();
  const looksRemote = lowered.includes('sslmode=require') || lowered.includes('amazonaws') || lowered.includes('supabase') || lowered.includes('neon.tech');
  if (looksRemote && process.env.FORCE_REMOTE_DEV_AUDIT_RESET !== 'true') {
    throw new Error('DATABASE_URL có vẻ là cơ sở dữ liệu từ xa. Chỉ đặt FORCE_REMOTE_DEV_AUDIT_RESET=true nếu đó là DB dev dùng để xóa được.');
  }
}

async function confirmReset() {
  if (process.env.SKIP_DEV_AUDIT_RESET_PROMPT === 'true') return;
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question('Nhập XOA AUDIT V2 để xóa chuỗi/batch audit local: ');
    if (answer !== 'XOA AUDIT V2') {
      throw new Error('Cụm xác nhận không khớp. Đã hủy reset.');
    }
  } finally {
    rl.close();
  }
}

async function main() {
  assertLocalOnly();
  await confirmReset();

  await prisma.$transaction(async (tx) => {
    await tx.blockchainLogger.deleteMany({});
    await tx.auditBatch.deleteMany({});

    await tx.patient.updateMany({ data: { hash256: null, dataSalt: null } });
    await tx.staffProfile.updateMany({ data: { hash256: null, dataSalt: null } });
    await tx.doctorProfile.updateMany({ data: { hash256: null, dataSalt: null } });
    await tx.department.updateMany({ data: { hash256: null, dataSalt: null } });
    await tx.medicalConclusion.updateMany({ data: { hash256: null, dataSalt: null } });
    await tx.aiModelRegistry.updateMany({ data: { hash256: null, dataSalt: null } });
  });

  console.log('✅ Đã đặt lại trạng thái Blockchain Audit V2 local. Hãy seed lại hoặc chạy lại các luồng quan trọng để tạo log V2 mới.');
}

main()
  .catch((error) => {
    console.error('❌ Reset Audit V2 thất bại:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
