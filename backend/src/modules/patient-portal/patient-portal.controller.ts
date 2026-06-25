import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/types/auth-user.type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PatientPortalService } from './patient-portal.service';

@ApiTags('Patient Portal')
@ApiBearerAuth()
@Controller('patient/me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PATIENT')
export class PatientPortalController {
  constructor(private readonly patientPortalService: PatientPortalService) {}

  @Get('profiles')
  profiles(@CurrentUser() user: AuthUser) {
    return this.patientPortalService.getProfiles(user.sub);
  }

  @Get('profiles/:patientId')
  profile(@CurrentUser() user: AuthUser, @Param('patientId') patientId: string) {
    return this.patientPortalService.getProfile(user.sub, patientId);
  }

  @Get('profiles/:patientId/visits')
  visits(@CurrentUser() user: AuthUser, @Param('patientId') patientId: string) {
    return this.patientPortalService.getVisits(user.sub, patientId);
  }

  @Get('profiles/:patientId/visits/:visitId')
  visitDetail(
    @CurrentUser() user: AuthUser,
    @Param('patientId') patientId: string,
    @Param('visitId') visitId: string,
  ) {
    return this.patientPortalService.getVisitDetail(user.sub, patientId, visitId);
  }

  @Get('profiles/:patientId/files/:fileId/download')
  fileDownloadUrl(
    @CurrentUser() user: AuthUser,
    @Param('patientId') patientId: string,
    @Param('fileId') fileId: string,
  ) {
    return this.patientPortalService.getResultFileDownloadUrl(user.sub, patientId, fileId);
  }
}
