import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AssignRoomDoctorDto, ClinicalRoomQueryDto, CreateClinicalRoomDto, UpdateClinicalRoomDto } from '../dto/clinical-room.dto';
import { ClinicalRoomService } from '../services/clinical-room.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiTags('Clinical Rooms')
@ApiBearerAuth()
@Controller('clinical-rooms')
export class ClinicalRoomController {
  constructor(private readonly service: ClinicalRoomService) {}

  @Post()
  @ApiOperation({ summary: 'Create a clinical room' })
  create(@Body() dto: CreateClinicalRoomDto, @Req() req: any) {
    return this.service.create(dto, req.user?.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List clinical rooms with pagination, filters, and search' })
  findAll(@Query() query: ClinicalRoomQueryDto) {
    return this.service.findAll(query);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a clinical room' })
  update(@Param('id') id: string, @Body() dto: UpdateClinicalRoomDto, @Req() req: any) {
    return this.service.update(id, dto, req.user?.sub);
  }

  @Patch(':id/doctor')
  @ApiOperation({ summary: 'Assign, move, or clear the doctor responsible for a room' })
  assignDoctor(@Param('id') id: string, @Body() dto: AssignRoomDoctorDto, @Req() req: any) {
    return this.service.assignDoctor(id, dto, req.user?.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a clinical room' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user?.sub);
  }
}
