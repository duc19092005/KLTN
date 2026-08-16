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

const node = process.execPath;
const run = (script, args) => {
  const result = spawnSync(node, [script, ...args], {
    cwd: backendDir,
    env: { ...process.env, RUN_TAMPER_RECOVERY_E2E: 'true' },
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status || 1);
};

const extraArgs = process.argv.slice(2);
run(require.resolve('prisma/build/index.js'), ['db', 'push', '--skip-generate', '--accept-data-loss']);
run(path.join(path.dirname(require.resolve('jest/package.json')), 'bin', 'jest.js'), [
  '--config',
  './test/jest-integration.json',
  'test/integration/tamper-recovery/tamper-recovery.integration-spec.ts',
  '--runInBand',
  ...extraArgs,
]);
