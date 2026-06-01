import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../common/types/auth-user.type';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { FaceStepUpGuard } from '../../../common/stepup/face-stepup.guard';
import { RequireFaceStepUp } from '../../../common/stepup/require-face-stepup.decorator';
import { CreateStaffDto, StaffQueryDto, UpdateStaffDto } from '../dto/staff.dto';
import { StaffService } from '../services/staff.service';

@UseGuards(JwtAuthGuard, RolesGuard, FaceStepUpGuard)
@Roles('ADMIN')
@ApiTags('Staff')
@ApiBearerAuth()
@Controller('staff')
export class StaffController {
  constructor(private readonly service: StaffService) {}

  @Post()
  @ApiOperation({ summary: 'Create staff profile and login user account' })
  create(@Body() dto: CreateStaffDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user?.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List staff with pagination, filters, and search' })
  findAll(@Query() query: StaffQueryDto) {
    return this.service.findAll(query);
  }

  @Get('audit/history')
  @ApiOperation({ summary: 'Change history of all staff (blockchain logger)' })
  history() {
    return this.service.getHistory();
  }

  @Get('audit/verify')
  @ApiOperation({ summary: 'Verify integrity of all staff against blockchain' })
  verifyAll() {
    return this.service.verifyAll();
  }

  @Roles('ADMIN', 'RECEPTIONIST', 'DOCTOR', 'LAB_MANAGER')
  @Get(':id')
  @ApiOperation({ summary: 'Get staff profile details with audit integrity verification' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/audit/history')
  @ApiOperation({ summary: 'Change history of one staff' })
  historyOne(@Param('id') id: string) {
    return this.service.getHistory(id);
  }

  @Get(':id/audit/verify')
  @ApiOperation({ summary: 'Verify integrity of one staff against blockchain' })
  verifyOne(@Param('id') id: string) {
    return this.service.verifyStaff(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update staff profile and linked user account' })
  update(@Param('id') id: string, @Body() dto: UpdateStaffDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user?.sub);
  }

  @Patch(':id/lock')
  @ApiOperation({ summary: 'Lock a staff account' })
  lock(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.setStatus(id, UserStatus.INACTIVE, user?.sub);
  }

  @Patch(':id/unlock')
  @ApiOperation({ summary: 'Unlock a staff account' })
  unlock(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.setStatus(id, UserStatus.ACTIVE, user?.sub);
  }

  @Delete(':id')
  @RequireFaceStepUp('DELETE_STAFF')
  @ApiOperation({ summary: 'Soft-delete staff by marking account inactive (requires face step-up)' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user?.sub);
  }
}

