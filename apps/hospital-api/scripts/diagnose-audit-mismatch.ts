/**
 * Diagnostic (read-only): compare live MedicalResult / MedicalOrder snapshots
 * against the latest ANCHORED audit row to pinpoint exact mismatched fields.
 *
 * Run from apps/hospital-api:
 *   npx ts-node --transpile-only scripts/diagnose-audit-mismatch.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { canonicalize, computeAfterHashV2 } from '../src/infrastructure/audit/audit-hash.util';
import { buildAuditEncryptionAad, decryptAuditSnapshot, parseJsonSnapshot } from '../src/infrastructure/audit/audit-encryption.util';
import { buildMedicalResultSnapshot } from '../src/modules/medical-order/domain/medical-result-snapshot';
import { buildMedicalOrderSnapshot } from '../src/modules/medical-order/domain/medical-order-snapshot';

const p = new PrismaClient();

async function loadLive(entity: string, entityId: string): Promise<Record<string, unknown> | null> {
  if (entity === 'MedicalResult') {
    const row = await p.medicalResult.findUnique({
      where: { id: entityId },
      include: { files: true, order: { select: { visitId: true, status: true } } },
    });
    if (!row) return null;
    return buildMedicalResultSnapshot({ ...row, visitId: row.order?.visitId ?? null }) as Record<string, unknown>;
  }
  if (entity === 'MedicalOrder') {
    const row = await p.medicalOrder.findUnique({ where: { id: entityId } });
    return row ? (buildMedicalOrderSnapshot(row) as Record<string, unknown>) : null;
  }
  return null;
}

function diffFields(audit: Record<string, unknown>, live: Record<string, unknown>) {
  const keys = Array.from(new Set([...Object.keys(audit), ...Object.keys(live)])).sort();
  const out: Array<{ field: string; audit: unknown; live: unknown }> = [];
  for (const k of keys) {
    const av = audit[k] ?? null;
    const lv = live[k] ?? null;
    if (canonicalize(av) !== canonicalize(lv)) out.push({ field: k, audit: av, live: lv });
  }
  return out;
}

async function main() {
  try {
    const rows = await p.blockchainLogger.findMany({
      where: { entity: { in: ['MedicalResult', 'MedicalOrder'] } },
      orderBy: { seq: 'desc' },
      take: 30,
      select: {
        seq: true, entity: true, entityId: true, batchId: true, onChainStatus: true,
        createdAt: true, afterHash: true, afterEncrypted: true, action: true,
      },
    });

    console.log('=== Latest audit rows (MedicalResult/MedicalOrder) ===');
    for (const r of rows) {
      console.log(`SEQ ${r.seq} ${r.entity} ${r.action} ${r.entityId} batch=${r.batchId} chain=${r.onChainStatus} at=${r.createdAt?.toISOString?.()}`);
    }

    for (const entity of ['MedicalResult', 'MedicalOrder'] as const) {
      const latest = rows.find((r) => r.entity === entity && r.onChainStatus === 'ANCHORED' && r.afterEncrypted != null);
      if (!latest) {
        console.log(`\n${entity}: no ANCHORED row with afterEncrypted`);
        continue;
      }
      const live = await loadLive(entity, latest.entityId);
      if (!live) {
        console.log(`\n${entity}: live row MISSING (${latest.entityId})`);
        continue;
      }

      let auditAfter: Record<string, unknown>;
      try {
        const aad = buildAuditEncryptionAad({
          seq: latest.seq!,
          entity: latest.entity,
          entityId: latest.entityId ?? null,
          action: latest.action,
          createdAtIso: latest.createdAt.toISOString(),
        });
        auditAfter = parseJsonSnapshot(decryptAuditSnapshot(latest.afterEncrypted as never, aad)) as Record<string, unknown>;
      } catch (e) {
        console.log(`\n${entity}: decrypt failed: ${(e as Error).message}`);
        continue;
      }

      const liveHash = computeAfterHashV2(entity, latest.entityId, live);
      console.log(`\n=== ${entity} ${latest.entityId} ===`);
      console.log(`audit.afterHash: ${latest.afterHash}`);
      console.log(`live   afterHash: ${liveHash}`);
      console.log(`match: ${liveHash === latest.afterHash}`);
      const diffs = diffFields(auditAfter, live);
      if (diffs.length === 0) {
        console.log('No field differences.');
      } else {
        for (const d of diffs) {
          console.log(`- ${d.field}:`);
          console.log(`    audit: ${JSON.stringify(d.audit)}`);
          console.log(`    live : ${JSON.stringify(d.live)}`);
        }
      }
    }
  } finally {
    await p.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
