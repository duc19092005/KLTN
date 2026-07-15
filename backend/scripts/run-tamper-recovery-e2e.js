const { spawnSync } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');

const backendDir = path.resolve(__dirname, '..');
const envPath = path.join(backendDir, '.env.test');
dotenv.config({ path: envPath, override: true });

for (const name of ['DATABASE_URL', 'AUDIT_ANCHOR_ADDRESS', 'IPFS_API_URL']) {
  if (!process.env[name]) {
    console.error(`${name} is missing. Start test infrastructure and run npm run deploy:test-env in blockchain first.`);
    process.exit(1);
  }
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const run = (args) => {
  const result = spawnSync(npx, args, {
    cwd: backendDir,
    env: { ...process.env, RUN_TAMPER_RECOVERY_E2E: 'true' },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status || 1);
};

run(['prisma', 'db', 'push', '--skip-generate']);
run([
  'jest',
  '--config',
  './test/jest-integration.json',
  'test/integration/tamper-recovery/tamper-recovery.integration-spec.ts',
  '--runInBand',
]);
