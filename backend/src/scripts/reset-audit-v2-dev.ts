import { PrismaClient } from '@prisma/client';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

/**
 * Local-only development helper for resetting Blockchain Audit V2 state.
 *
 * This intentionally does NOT reset medical/business tables. It clears audit rows,
 * audit batches and audit-related integrity columns so a developer can reseed or
 * replay V2 flows from a clean chain while preserving application data.
 */
const prisma = new PrismaClient();

function assertLocalOnly() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run audit reset in production.');
  }

  if (process.env.ALLOW_DEV_AUDIT_RESET !== 'true') {
    throw new Error('Set ALLOW_DEV_AUDIT_RESET=true to acknowledge this local-only destructive reset.');
  }

  const databaseUrl = process.env.DATABASE_URL ?? '';
  const lowered = databaseUrl.toLowerCase();
  const looksRemote = lowered.includes('sslmode=require') || lowered.includes('amazonaws') || lowered.includes('supabase') || lowered.includes('neon.tech');
  if (looksRemote && process.env.FORCE_REMOTE_DEV_AUDIT_RESET !== 'true') {
    throw new Error('DATABASE_URL looks remote. Set FORCE_REMOTE_DEV_AUDIT_RESET=true only for disposable dev databases.');
  }
}

async function confirmReset() {
  if (process.env.SKIP_DEV_AUDIT_RESET_PROMPT === 'true') return;
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question('Type RESET AUDIT V2 to clear local audit chain/batches: ');
    if (answer !== 'RESET AUDIT V2') {
      throw new Error('Confirmation mismatch. Reset aborted.');
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

  console.log('✅ Local Blockchain Audit V2 state reset. Re-run seed or replay critical flows to regenerate V2 logs.');
}

main()
  .catch((error) => {
    console.error('❌ Audit V2 reset failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
