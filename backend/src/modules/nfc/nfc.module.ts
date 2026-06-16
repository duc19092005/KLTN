import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { PatientModule } from '../patient/patient.module';
import { MobilePatientNfcController } from './controllers/mobile-patient-nfc.controller';
import { NfcSessionController } from './controllers/nfc-session.controller';
import { NfcSessionService } from './services/nfc-session.service';

@Module({
  imports: [PrismaModule, PatientModule],
  controllers: [NfcSessionController, MobilePatientNfcController],
  providers: [NfcSessionService],
})
export class NfcModule {}
