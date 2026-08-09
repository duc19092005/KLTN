import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { AuditLoggerService } from '../infrastructure/audit/audit-logger.service';
import { AuditAnchorService } from '../infrastructure/audit/audit-anchor.service';
import { verifyAuditRow } from '../infrastructure/audit/audit-verification.util';
import { buildVisitSnapshot } from '../modules/visit/domain/visit-snapshot';

/**
 * Re-anchor script for historical Visit audit rows.
 *
 * Problem: old Visit audit entries were written with a limited snapshot
 * (e.g. only visitCode/status). EntityRecoveryService then reports
 * "SNAPSHOT_INCOMPLETE" for those visits because the latest audit row cannot
 * be used as a full recovery source.
 *
 * Fix: for every Visit whose latest audit snapshot is incomplete or stale,
 * append a NEW V2 audit row whose `after` snapshot contains the canonical
 * 8-field Visit snapshot built from the CURRENT database state. The new row
 * becomes the latest trusted source, so verification & recovery work again.
 *
 * The chain (seq/prevHash) is preserved: we only INSERT, never UPDATE/DELETE
 * existing audit rows (those columns are immutable via a DB trigger).
 *
 * Usage:
 *   npx ts-node src/scripts/re-anchor-visit-audit.ts            # real run
 *   npx ts-node src/scripts/re-anchor-visit-audit.ts --dry-run  # preview only
 *
 * Safety: refuses to run when NODE_ENV=production unless FORCE_REMOTE_REANCHOR=true.
 */

const REQUIRED_VISIT_FIELDS = ['visitCode', 'patientId', 'departmentId', 'staffId', 'status', 'source', 'checkInAt', 'completedAt'] as const;

function assertSafeToRun() {
  if (process.env.NODE_ENV === 'production' && process.env.FORCE_REMOTE_REANCHOR !== 'true') {
    throw new Error('Từ chối chạy trong production. Đặt FORCE_REMOTE_REANCHOR=true nếu bạn chắc chắn.');
  }
  const databaseUrl = process.env.DATABASE_URL ?? '';
  const lowered = databaseUrl.toLowerCase();
  const looksRemote =
    lowered.includes('sslmode=require') ||
    lowered.includes('amazonaws') ||
    lowered.includes('supabase') ||
    lowered.includes('neon.tech');
  if (looksRemote && process.env.FORCE_REMOTE_REANCHOR !== 'true') {
    throw new Error('DATABASE_URL có vẻ là DB từ xa. Chỉ đặt FORCE_REMOTE_REANCHOR=true nếu đó là DB dev.');
  }
}

function snapshotComplete(after: unknown): after is Record<string, unknown> {
  if (!after || typeof after !== 'object') return false;
  return REQUIRED_VISIT_FIELDS.every((field) => field in after);
}

function snapshotsMatch(after: Record<string, unknown>, live: Record<string, unknown>): boolean {
  return REQUIRED_VISIT_FIELDS.every((field) => String(after[field] ?? '') === String(live[field] ?? ''));
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  assertSafeToRun();

  console.log('Bootstrapping NestJS context...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const audit = app.get(AuditLoggerService);

  // Resolve a valid actor for the audit trail (must reference an existing User row).
  const systemActor = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  const visits = await prisma.visit.findMany({ orderBy: { checkInAt: 'asc' } });
  console.log(`Found ${visits.length} visits. Mode: ${dryRun ? 'DRY-RUN (no writes)' : 'REAL RUN'}`);

  let toWrite = 0;
  let skipped = 0;
  let failed = 0;

  for (const visit of visits) {
    try {
      const latest = await prisma.blockchainLogger.findFirst({
        where: { entity: 'Visit', entityId: visit.id, seq: { not: null } },
        orderBy: { seq: 'desc' },
      });

      const live = buildVisitSnapshot(visit);

      if (!latest) {
        console.log(`  Visit ${visit.visitCode}: NO audit row -> append full snapshot.`);
        toWrite++;
        continue;
      }

      const verification = verifyAuditRow(latest);
      if (!verification.ok) {
        console.log(`  Visit ${visit.visitCode}: latest audit row TAMPERED (seq=${latest.seq}) -> cannot trust; still re-anchoring from DB.`);
        toWrite++;
        continue;
      }

      const after = verification.decryptedAfter as Record<string, unknown> | null;
      if (snapshotComplete(after) && snapshotsMatch(after, live)) {
        skipped++;
        continue;
      }

      console.log(
        `  Visit ${visit.visitCode}: snapshot ${snapshotComplete(after) ? 'complete but STALE' : 'INCOMPLETE'} (seq=${latest.seq}) -> re-anchor from DB.`,
      );
      toWrite++;
    } catch (error) {
      failed++;
      console.error(`  Visit ${visit.visitCode}: FAILED - ${(error as Error).message}`);
    }
  }

  console.log(`\nSummary: ${toWrite} to re-anchor, ${skipped} already complete, ${failed} failed.`);

  if (dryRun || toWrite === 0) {
    console.log(dryRun ? '✅ DRY-RUN finished — no rows were written.' : '✅ Nothing to write.');
    await app.close();
    return;
  }

  console.log('\nWriting re-anchor rows...');
  let written = 0;
  for (const visit of visits) {
    try {
      const latest = await prisma.blockchainLogger.findFirst({
        where: { entity: 'Visit', entityId: visit.id, seq: { not: null } },
        orderBy: { seq: 'desc' },
      });

      const live = buildVisitSnapshot(visit);
      let needsWrite = !latest;
      if (latest) {
        const verification = verifyAuditRow(latest);
        if (!verification.ok) {
          needsWrite = true;
        } else {
          const after = verification.decryptedAfter as Record<string, unknown> | null;
          needsWrite = !snapshotComplete(after) || !snapshotsMatch(after, live);
        }
      }
      if (!needsWrite) continue;

      const before = latest
        ? (verifyAuditRow(latest).ok ? (verifyAuditRow(latest).decryptedAfter as Record<string, unknown>) : null)
        : null;

      await audit.recordV2({
        entity: 'Visit',
        entityId: visit.id,
        action: 'UPDATE',
        actorId: systemActor?.id ?? null,
        before,
        after: live,
        metadata: { schema: 'KLTN_VISIT_REANCHOR_V1', reason: 'historical-snapshot-incomplete' },
      });
      written++;
    } catch (error) {
      failed++;
      console.error(`  Visit ${visit.visitCode}: WRITE FAILED - ${(error as Error).message}`);
    }
  }

  console.log(`✅ Written ${written} re-anchor row(s), ${failed} failed.`);

  // Anchor the new rows immediately so they become on-chain trusted sources.
  if (written > 0) {
    try {
      const anchor = app.get(AuditAnchorService);
      const res = await anchor.anchorNow();
      console.log('✅ Immediate anchoring triggered:', JSON.stringify(res));
    } catch (error) {
      console.warn(`⚠️ Immediate anchoring failed (rows stay PENDING and will be batched later): ${(error as Error).message}`);
    }
  }

  await app.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
