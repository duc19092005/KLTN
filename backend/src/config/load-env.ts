import * as dotenv from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

const envFiles = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '..', '.env'),
  resolve(process.cwd(), 'blockchain', '.env'),
  resolve(process.cwd(), '..', 'blockchain', '.env'),
];

for (const envFile of Array.from(new Set(envFiles))) {
  if (existsSync(envFile)) {
    dotenv.config({ path: envFile });
  }
}
