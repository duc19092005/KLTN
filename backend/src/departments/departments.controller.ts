import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AssignDepartmentManagerDto, CreateDepartmentDto, UpdateDepartmentDto } from './department.dto';
import { DepartmentsService } from './departments.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('departments')
export class DepartmentsController {
  constructor(private departmentsService: DepartmentsService) {}

  @Post()
  create(@Body() dto: CreateDepartmentDto, @Req() req: any) {
    return this.departmentsService.create(dto, req.user?.sub);
  }

  @Get()
  findAll() {
    return this.departmentsService.findAll();
  }

  @Get(':id/staffs')
  findStaffs(@Param('id') id: string) {
    return this.departmentsService.findStaffs(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto, @Req() req: any) {
    return this.departmentsService.update(id, dto, req.user?.sub);
  }

  @Patch(':id/manager')
  assignManager(@Param('id') id: string, @Body() dto: AssignDepartmentManagerDto, @Req() req: any) {
    return this.departmentsService.assignManager(id, dto, req.user?.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.departmentsService.remove(id, req.user?.sub);
  }
}
