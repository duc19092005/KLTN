import { Body, Controller, NotFoundException, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { VerifyPatientPublicUseCase } from '../../patient/application/use-cases/verify-patient-public.use-case';
import { PatientNfcLoginDto } from '../dto/nfc-session.dto';

@ApiTags('Mobile Patient NFC')
@Controller('mobile/patient')
export class MobilePatientNfcController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly verifyPatientPublicUseCase: VerifyPatientPublicUseCase,
  ) {}

  @Post('nfc-login')
  @ApiOperation({
    summary: 'Patient mobile app logs in with a KLTN_CCCD NFC payload and receives the same verified history as Home',
  })
  async loginWithNfc(@Body() dto: PatientNfcLoginDto) {
    const citizenId = dto.card.citizenId.trim();
    const patient = await this.prisma.patient.findFirst({
      where: { citizenId },
      select: { patientCode: true },
    });

    if (!patient) {
      throw new NotFoundException('Khong tim thay ho so benh nhan voi CCCD tren the NFC.');
    }

    const verification = await this.verifyPatientPublicUseCase.execute(patient.patientCode);
    return {
      authMethod: 'NFC_CCCD',
      card: {
        type: dto.card.type,
        version: dto.card.version,
        citizenId: dto.card.citizenId,
        fullName: dto.card.fullName,
      },
      verification,
    };
  }
}
