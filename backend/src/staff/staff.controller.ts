import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateStaffDto, UpdateStaffDto } from './staff.dto';
import { StaffService } from './staff.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('staff')
export class StaffController {
  constructor(private staffService: StaffService) {}

  @Post()
  create(@Body() dto: CreateStaffDto, @Req() req: any) {
    return this.staffService.create(dto, req.user?.sub);
  }

  @Get()
  search(
    @Query('employeeCode') employeeCode?: string,
    @Query('fullName') fullName?: string,
    @Query('department') department?: string,
    @Query('role') role?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.staffService.search({ employeeCode, fullName, department, role, page: Number(page), limit: Number(limit) });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStaffDto, @Req() req: any) {
    return this.staffService.update(id, dto, req.user?.sub);
  }

  @Patch(':id/lock')
  lock(@Param('id') id: string, @Req() req: any) {
    return this.staffService.setStatus(id, UserStatus.INACTIVE, req.user?.sub);
  }

  @Patch(':id/unlock')
  unlock(@Param('id') id: string, @Req() req: any) {
    return this.staffService.setStatus(id, UserStatus.ACTIVE, req.user?.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.staffService.remove(id, req.user?.sub);
  }
}
