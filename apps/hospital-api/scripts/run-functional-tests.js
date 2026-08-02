const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

const backendDir = path.resolve(__dirname, '..');
const projectRoot = path.resolve(backendDir, '..', '..');
const envPath = path.join(backendDir, '.env.test');
const resultPath = path.join(projectRoot, 'docs', 'testing', 'functional-test-results.json');
const jestResultPath = path.join(backendDir, 'test', 'functional', '.jest-results.json');
const suiteSizes = [12, 12, 16, 13, 12, 22, 17, 10, 11];
const expectedIds = suiteSizes.flatMap((size, suiteIndex) =>
  Array.from({ length: size }, (_, caseIndex) => `TC${suiteIndex + 1}.${String(caseIndex + 1).padStart(2, '0')}`),
);

dotenv.config({ path: envPath, override: true });
process.env.NODE_ENV = 'test';

function assertTestTarget() {
  const url = new URL(process.env.DATABASE_URL || '');
  const database = url.pathname.replace(/^\//, '');
  const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (url.protocol !== 'postgresql:' || !isLocalHost || url.port !== '5434' || database !== 'kltn_test') {
    throw new Error('Refusing to run functional tests outside postgresql://localhost:5434/kltn_test.');
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: backendDir,
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function collectDeclaredIds(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectDeclaredIds(entryPath);
    if (!entry.isFile() || !entry.name.endsWith('.functional-spec.ts')) return [];
    return [...fs.readFileSync(entryPath, 'utf8').matchAll(/\[?(TC\d+\.\d+)\]?/g)].map((match) => match[1]);
  });
}

function executedCasesFromJest() {
  if (!fs.existsSync(jestResultPath)) return new Map();
  const jestRun = JSON.parse(fs.readFileSync(jestResultPath, 'utf8'));
  const outcomes = new Map();
  for (const suite of jestRun.testResults || []) {
    for (const assertion of suite.assertionResults || []) {
      const match = assertion.fullName.match(/\[?(TC\d+\.\d+)\]?/);
      if (match) outcomes.set(match[1], assertion.status === 'passed' ? 'PASSED' : 'FAILED');
    }
  }
  return outcomes;
}

function writeManifest(exitCode) {
  const declared = collectDeclaredIds(path.join(backendDir, 'test', 'functional'));
  const executed = executedCasesFromJest();
  const duplicateIds = declared.filter((id, index) => declared.indexOf(id) !== index);
  const undeclaredIds = expectedIds.filter((id) => !declared.includes(id));
  const cases = expectedIds.map((id) => ({
    id,
    status: executed.get(id) || 'PENDING',
    execution: executed.has(id) ? 'functional-jest' : null,
  }));

  fs.mkdirSync(path.dirname(resultPath), { recursive: true });
  fs.writeFileSync(
    resultPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        environment: 'local-test',
        testCommand: 'npm run test:functional',
        expectedCaseCount: expectedIds.length,
        declaredCaseCount: declared.length,
        declaredUniqueCaseCount: new Set(declared).size,
        duplicateIds,
        pendingIds: undeclaredIds,
        cases,
      },
      null,
      2,
    ),
  );

  return duplicateIds.length ? 1 : exitCode;
}

try {
  assertTestTarget();
  fs.rmSync(jestResultPath, { force: true });
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const prismaStatus = run(npx, ['prisma', 'db', 'push', '--skip-generate']);
  if (prismaStatus !== 0) process.exit(writeManifest(prismaStatus));
  const jestStatus = run(npx, [
    'jest',
    '--config',
    './test/jest-functional.json',
    '--runInBand',
    '--json',
    '--outputFile=./test/functional/.jest-results.json',
  ]);
  process.exit(writeManifest(jestStatus));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(writeManifest(1));
}
