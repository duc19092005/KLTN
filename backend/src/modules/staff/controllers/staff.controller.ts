import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CreateStaffDto, StaffQueryDto, UpdateStaffDto } from '../dto/staff.dto';
import { StaffService } from '../services/staff.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiTags('Staff')
@ApiBearerAuth()
@Controller('staff')
export class StaffController {
  constructor(private readonly service: StaffService) {}

  @Post()
  @ApiOperation({ summary: 'Create staff profile and login user account' })
  create(@Body() dto: CreateStaffDto, @Req() req: any) {
    return this.service.create(dto, req.user?.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List staff with pagination, filters, and search' })
  findAll(@Query() query: StaffQueryDto) {
    return this.service.findAll(query);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update staff profile and linked user account' })
  update(@Param('id') id: string, @Body() dto: UpdateStaffDto, @Req() req: any) {
    return this.service.update(id, dto, req.user?.sub);
  }

  @Patch(':id/lock')
  @ApiOperation({ summary: 'Lock a staff account' })
  lock(@Param('id') id: string, @Req() req: any) {
    return this.service.setStatus(id, UserStatus.INACTIVE, req.user?.sub);
  }

  @Patch(':id/unlock')
  @ApiOperation({ summary: 'Unlock a staff account' })
  unlock(@Param('id') id: string, @Req() req: any) {
    return this.service.setStatus(id, UserStatus.ACTIVE, req.user?.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete staff by marking account inactive' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user?.sub);
  }
}
