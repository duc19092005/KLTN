import * as dotenv from 'dotenv';
import { resolve } from 'node:path';
import { assertFunctionalTestEnvironment } from './support/test-environment';

dotenv.config({ path: resolve(__dirname, '../../.env.test'), override: true });
process.env.NODE_ENV = 'test';
process.env.SKIP_PRISMA_CONNECT = 'false';
process.env.AUDIT_BATCH_DISABLED = 'true';

assertFunctionalTestEnvironment();
