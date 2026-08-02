import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { AuditLoggerService } from '../infrastructure/audit/audit-logger.service';
import { AuditAnchorService } from '../infrastructure/audit/audit-anchor.service';
import { AuditRecoveryService } from '../infrastructure/audit/audit-recovery.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const audit = app.get(AuditLoggerService);
  const anchor = app.get(AuditAnchorService);
  const recovery = app.get(AuditRecoveryService);

  const chain = await audit.verifyChain();
  console.log('Initial chain:', chain);
  if (chain.ok || chain.brokenAtSeq == null) {
    console.log('Audit chain is already valid.');
    await app.close();
    return;
  }

  const brokenBatch = await prisma.auditBatch.findFirst({
    where: {
      status: 'ANCHORED',
      fromSeq: { lte: chain.brokenAtSeq },
      toSeq: { gte: chain.brokenAtSeq },
    },
    orderBy: { batchId: 'desc' },
  });
  if (!brokenBatch || brokenBatch.toSeq == null) {
    throw new Error(`Cannot map broken seq ${chain.brokenAtSeq} to an anchored batch.`);
  }

  const newestDemoAdmin = await prisma.user.findFirst({
    where: { username: { startsWith: 'admin-DEMO-' } },
    orderBy: { createdAt: 'desc' },
  });
  const runId = newestDemoAdmin?.username?.replace(/^admin-/, '') ?? null;
  console.log(`Broken batch #${brokenBatch.batchId}; failed demo run: ${runId ?? 'not found'}`);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.audit_recovery_authorized', 'true', true)`;
    const pending = await tx.blockchainLogger.deleteMany({
      where: { seq: { gt: brokenBatch.toSeq! }, batchId: null },
    });
    console.log(`Removed ${pending.count} unanchored audit rows created on the corrupted chain tail.`);

    if (!runId) return;
    const doctorUser = await tx.user.findFirst({ where: { username: `doctor-${runId}` } });
    const staff = doctorUser
      ? await tx.staffProfile.findUnique({ where: { userId: doctorUser.id } })
      : null;

    await tx.medicalConclusion.deleteMany({
      where: { OR: [
        { finalDiagnosis: { contains: runId } },
        { visit: { visitCode: { contains: runId } } },
      ] },
    });
    await tx.aiDiagnosis.deleteMany({
      where: { OR: [
        { visit: { visitCode: { contains: runId } } },
        { aiModel: { modelName: { contains: runId } } },
      ] },
    });
    await tx.visit.deleteMany({ where: { visitCode: { contains: runId } } });
    await tx.patient.deleteMany({ where: { patientCode: { contains: runId } } });
    if (staff) await tx.doctorProfile.deleteMany({ where: { staffProfileId: staff.id } });
    if (doctorUser) await tx.staffProfile.deleteMany({ where: { userId: doctorUser.id } });
    await tx.aiModelRegistry.deleteMany({ where: { modelName: { contains: runId } } });
    await tx.department.deleteMany({ where: { departmentCode: { contains: runId } } });
    await tx.user.updateMany({
      where: { username: { in: [`admin-${runId}`, `doctor-${runId}`] } },
      data: { status: 'DELETE', deletedAt: new Date() },
    });
  });

  const trustedAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN', status: 'ACTIVE', username: { not: { startsWith: 'admin-DEMO-' } } },
    orderBy: { createdAt: 'asc' },
  });
  if (!trustedAdmin) throw new Error('No active non-demo admin is available for audit recovery evidence.');

  const result = await recovery.recover(
    brokenBatch.batchId,
    trustedAdmin.id,
    'Repair local demo audit checkpoint before rebuilding tamper/recovery fixtures',
  );
  console.log('Recovery result:', result);

  const anchored = await anchor.anchorNow();
  console.log('Recovery evidence anchor:', anchored);
  console.log('Final chain:', await audit.verifyChain());
  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
