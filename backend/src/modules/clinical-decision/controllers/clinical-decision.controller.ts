import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../common/types/auth-user.type';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { FaceStepUpGuard } from '../../../common/stepup/face-stepup.guard';
import { CreateMedicalConclusionDto, GenerateAiAnalysisDto, ReviewAiDiagnosisDto } from '../dto/clinical-decision.dto';
import { ClinicalDecisionService } from '../services/clinical-decision.service';

@ApiTags('Clinical Decision')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, FaceStepUpGuard)
@Controller('clinical-decisions')
export class ClinicalDecisionController {
  constructor(private readonly service: ClinicalDecisionService) {}

  @Roles('DOCTOR')
  @Get('visits/:visitId/results')
  getVisitResults(@Param('visitId') visitId: string, @CurrentUser() user: AuthUser) {
    return this.service.getVisitResults(visitId, user.sub);
  }

  @Roles('DOCTOR')
  @Post('ai-analysis')
  generateAiAnalysis(@Body() dto: GenerateAiAnalysisDto, @CurrentUser() user: AuthUser) {
    return this.service.generateAiAnalysis(dto, user.sub);
  }

  @Roles('DOCTOR')
  @Patch('ai-diagnoses/:id/review')
  reviewAiDiagnosis(@Param('id') id: string, @Body() dto: ReviewAiDiagnosisDto, @CurrentUser() user: AuthUser) {
    return this.service.reviewAiDiagnosis(id, dto, user.sub);
  }

  @Roles('DOCTOR')
  @Post('conclusions')
  createConclusion(@Body() dto: CreateMedicalConclusionDto, @CurrentUser() user: AuthUser) {
    return this.service.createConclusion(dto, user.sub);
  }
}
