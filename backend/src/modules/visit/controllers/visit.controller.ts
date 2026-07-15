import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../common/types/auth-user.type';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CreateVisitDto, UpdateVisitStatusDto, VisitQueryDto } from '../dto/visit.dto';
import { VisitService } from '../services/visit.service';

@ApiTags('Visits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('visits')
export class VisitController {
  constructor(private readonly visitService: VisitService) {}

  @Roles('ADMIN', 'RECEPTIONIST')
  @Post()
  create(@Body() dto: CreateVisitDto, @CurrentUser() user: AuthUser) {
    return this.visitService.create(dto, user);
  }

  @Roles('ADMIN', 'RECEPTIONIST', 'DOCTOR')
  @Get()
  findAll(@Query() query: VisitQueryDto, @CurrentUser() user: AuthUser) {
    return this.visitService.findAll(query, user);
  }

  @Roles('ADMIN', 'RECEPTIONIST')
  @Get('suggest-departments')
  suggestDepartments(@Query('specialty') specialty = '') {
    return this.visitService.suggestDepartments(specialty);
  }

  @Roles('ADMIN', 'RECEPTIONIST', 'DOCTOR')
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateVisitStatusDto, @CurrentUser() user: AuthUser) {
    return this.visitService.updateStatus(id, dto.status, user);
  }
}
