import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { VerifyPatientPublicUseCase } from '../application/use-cases/verify-patient-public.use-case';

/**
 * Public controller (NO authentication guards). Patients enter their
 * patientCode from their physical medical book to view and verify
 * their complete visit history against the blockchain audit trail.
 */
@ApiTags('Patient Verification (Public)')
@Controller('patient-verify')
export class PatientVerifyController {
  constructor(private readonly verifyUseCase: VerifyPatientPublicUseCase) {}

  @Get(':patientCode')
  @ApiOperation({
    summary: 'Public: Verify patient records via blockchain audit trail',
    description: 'No login required. Patient enters their book code (e.g. BN-0001) to see visit history with blockchain verification status.',
  })
  verify(@Param('patientCode') patientCode: string) {
    return this.verifyUseCase.execute(patientCode);
  }

  @Get('conclusion/:conclusionId/verify')
  @ApiOperation({
    summary: 'Public: Verify a single medical conclusion on-chain',
    description: 'No login required. Cryptographically verifies a single medical conclusion and retrieves Merkle proof details.',
  })
  verifyConclusion(@Param('conclusionId') conclusionId: string) {
    return this.verifyUseCase.verifyConclusion(conclusionId);
  }
}
