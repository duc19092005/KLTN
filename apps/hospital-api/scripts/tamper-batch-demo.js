const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const batch1 = await prisma.auditBatch.findUnique({ where: { batchId: 1 } });
  if (!batch1) {
    console.log('⚠️ Không tìm thấy Batch #1 trong DB local.');
    return;
  }

  console.log(`📌 Merkle Root hiện tại của Batch #1: ${batch1.merkleRoot}`);

  const tamperedRoot = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
  await prisma.auditBatch.update({
    where: { batchId: 1 },
    data: { merkleRoot: tamperedRoot },
  });

  console.log(`\n💥 ĐÃ GIẢ MẠO THÀNH CÔNG Merkle Root của Batch #1 thành: ${tamperedRoot}`);
  console.log('👉 Mở Web Admin (/admin/audit-logs) -> Quét khuôn mặt -> Bấm "Kiểm tra chi tiết từng Batch" để test khôi phục!\n');
}

main()
  .catch((err) => {
    console.error('❌ Lỗi:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
