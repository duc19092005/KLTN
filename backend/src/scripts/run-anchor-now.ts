import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AuditAnchorService } from '../infrastructure/audit/audit-anchor.service';

async function main() {
  console.log('Bootstrapping NestJS context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log('Fetching AuditAnchorService...');
  const auditAnchor = app.get(AuditAnchorService);
  console.log('Running anchorNow()...');
  const res = await auditAnchor.anchorNow();
  console.log('Result:', res);
  await app.close();
}

main().catch((err) => {
  console.error('Fatal error running anchorNow:', err);
  process.exit(1);
});
