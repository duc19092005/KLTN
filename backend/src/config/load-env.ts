import * as dotenv from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

// Backend owns only backend/.env. Do not implicitly load root, frontend, or
// blockchain env files; docker-compose and native runs should keep boundaries
// explicit per service folder.
const envFiles = [
  resolve(__dirname, '..', '..', '.env'),
  resolve(process.cwd(), 'backend', '.env'),
];

for (const envFile of Array.from(new Set(envFiles))) {
  if (existsSync(envFile)) {
    dotenv.config({ path: envFile });
  }
}
