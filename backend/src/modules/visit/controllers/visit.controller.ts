import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
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
  create(@Body() dto: CreateVisitDto) {
    return this.visitService.create(dto);
  }

  @Roles('ADMIN', 'RECEPTIONIST', 'DOCTOR')
  @Get()
  findAll(@Query() query: VisitQueryDto, @Req() req: any) {
    return this.visitService.findAll(query, req.user);
  }

  @Roles('ADMIN', 'RECEPTIONIST')
  @Get('suggest-rooms')
  suggestRooms(@Query('specialty') specialty = '') {
    return this.visitService.suggestRooms(specialty);
  }

  @Roles('ADMIN', 'RECEPTIONIST', 'DOCTOR')
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateVisitStatusDto, @Req() req: any) {
    return this.visitService.updateStatus(id, dto.status, req.user);
  }
}
