import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CreateMedicalConclusionDto, GenerateAiAnalysisDto, ReviewAiDiagnosisDto } from '../dto/clinical-decision.dto';
import { ClinicalDecisionService } from '../services/clinical-decision.service';

@ApiTags('Clinical Decision')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clinical-decisions')
export class ClinicalDecisionController {
  constructor(private readonly service: ClinicalDecisionService) {}

  @Roles('DOCTOR')
  @Get('visits/:visitId/results')
  getVisitResults(@Param('visitId') visitId: string, @Req() req: any) {
    return this.service.getVisitResults(visitId, req.user.sub);
  }

  @Roles('DOCTOR')
  @Post('ai-analysis')
  generateAiAnalysis(@Body() dto: GenerateAiAnalysisDto, @Req() req: any) {
    return this.service.generateAiAnalysis(dto, req.user.sub);
  }

  @Roles('DOCTOR')
  @Patch('ai-diagnoses/:id/review')
  reviewAiDiagnosis(@Param('id') id: string, @Body() dto: ReviewAiDiagnosisDto, @Req() req: any) {
    return this.service.reviewAiDiagnosis(id, dto, req.user.sub);
  }

  @Roles('DOCTOR')
  @Post('conclusions')
  createConclusion(@Body() dto: CreateMedicalConclusionDto, @Req() req: any) {
    return this.service.createConclusion(dto, req.user.sub);
  }
}
