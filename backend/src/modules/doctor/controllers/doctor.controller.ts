import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AssignClinicalRoomDto, CreateDoctorDto, CreateDoctorWithStaffDto, DoctorQueryDto, UpdateDoctorDto } from '../dto/doctor.dto';
import { DoctorService } from '../services/doctor.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiTags('Doctors')
@ApiBearerAuth()
@Controller('doctors')
export class DoctorController {
  constructor(private readonly service: DoctorService) {}

  @Post()
  @ApiOperation({ summary: 'Create a doctor profile for a staff profile with DOCTOR role' })
  create(@Body() dto: CreateDoctorDto) {
    return this.service.create(dto);
  }

  @Post('full')
  @ApiOperation({ summary: 'Create doctor user, staff profile, doctor profile, and optional room assignment in one transaction' })
  createFull(@Body() dto: CreateDoctorWithStaffDto) {
    return this.service.createWithStaff(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List doctors with pagination, specialty filter, and search' })
  findAll(@Query() query: DoctorQueryDto) {
    return this.service.findAll(query);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update doctor specialty, license, qualification, or experience' })
  update(@Param('id') id: string, @Body() dto: UpdateDoctorDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/clinical-room')
  @ApiOperation({ summary: 'Assign, move, or clear a doctor clinical room' })
  assignRoom(@Param('id') id: string, @Body() dto: AssignClinicalRoomDto) {
    return this.service.assignRoom(id, dto);
  }
}
