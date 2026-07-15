import { Global, Module } from '@nestjs/common';
import { AdministrativeLifecycleService } from './administrative-lifecycle.service';

@Global()
@Module({
  providers: [AdministrativeLifecycleService],
  exports: [AdministrativeLifecycleService],
})
export class AdministrativeLifecycleModule {}
