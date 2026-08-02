import { URL } from 'node:url';

const REQUIRED_DATABASE = 'kltn_test';
const REQUIRED_PORT = '5434';
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

/**
 * Refuses to let destructive functional fixtures operate anywhere except the
 * disposable local PostgreSQL database defined by compose.test.yml.
 */
export function assertFunctionalTestEnvironment(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Functional tests require NODE_ENV=test.');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Functional tests require DATABASE_URL.');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error('Functional tests require a valid PostgreSQL DATABASE_URL.');
  }

  const databaseName = parsedUrl.pathname.replace(/^\//, '');
  if (
    !['postgresql:', 'postgres:'].includes(parsedUrl.protocol) ||
    !LOCAL_HOSTS.has(parsedUrl.hostname) ||
    parsedUrl.port !== REQUIRED_PORT ||
    databaseName !== REQUIRED_DATABASE
  ) {
    throw new Error(
      'Functional tests only run against postgresql://localhost:5434/kltn_test. Refusing this database target.',
    );
  }
}
