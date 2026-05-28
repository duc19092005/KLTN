import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { VisitController } from './controllers/visit.controller';
import { VisitService } from './services/visit.service';

@Module({
  imports: [PrismaModule],
  controllers: [VisitController],
  providers: [VisitService],
  exports: [VisitService],
})
export class VisitModule {}
