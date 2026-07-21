import * as dotenv from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

// The API owns only apps/hospital-api/.env. Compose and native runs keep
// environment boundaries explicit per application.
const envFiles = [
  ...(process.env.NODE_ENV === 'test'
    ? [
        resolve(__dirname, '..', '..', '.env.test'),
        resolve(process.cwd(), 'apps', 'hospital-api', '.env.test'),
      ]
    : []),
  resolve(__dirname, '..', '..', '.env'),
  resolve(process.cwd(), 'apps', 'hospital-api', '.env'),
];
for (const envFile of Array.from(new Set(envFiles))) {
  if (existsSync(envFile)) {
    dotenv.config({ path: envFile });
  }
}
