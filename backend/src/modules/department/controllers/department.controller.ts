import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { FaceStepUpGuard } from '../../../common/stepup/face-stepup.guard';
import { RequireFaceStepUp } from '../../../common/stepup/require-face-stepup.decorator';
import { DepartmentService } from '../services/department.service';
import { AssignManagerDto, CreateDepartmentDto, DepartmentQueryDto, UpdateDepartmentDto } from '../dto/department.dto';

@UseGuards(JwtAuthGuard, RolesGuard, FaceStepUpGuard)
@Roles('ADMIN')
@ApiTags('Departments')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentController {
  constructor(private readonly service: DepartmentService) {}

  @Post()
  @ApiOperation({ summary: 'Create a department' })
  create(@Body() dto: CreateDepartmentDto, @Req() req: any) {
    return this.service.create(dto, req.user?.sub);
  }

  @Roles('ADMIN', 'RECEPTIONIST', 'DOCTOR', 'LAB_MANAGER')
  @Get()
  @ApiOperation({ summary: 'List departments with pagination and search' })
  findAll(@Query() query: DepartmentQueryDto) {
    return this.service.findAll(query);
  }

  @Get('audit/history')
  @ApiOperation({ summary: 'Change history of all departments (blockchain logger)' })
  history() {
    return this.service.getHistory();
  }

  @Get('audit/verify')
  @ApiOperation({ summary: 'Verify integrity of all departments against blockchain' })
  verifyAll() {
    return this.service.verifyAll();
  }

  @Get(':id/audit/history')
  @ApiOperation({ summary: 'Change history of one department' })
  historyOne(@Param('id') id: string) {
    return this.service.getHistory(id);
  }

  @Get(':id/audit/verify')
  @ApiOperation({ summary: 'Verify integrity of one department against blockchain' })
  verifyOne(@Param('id') id: string) {
    return this.service.verifyDepartment(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a department' })
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto, @Req() req: any) {
    return this.service.update(id, dto, req.user?.sub);
  }

  @Patch(':id/manager')
  @ApiOperation({ summary: 'Assign or clear department manager' })
  assignManager(@Param('id') id: string, @Body() dto: AssignManagerDto, @Req() req: any) {
    return this.service.assignManager(id, dto, req.user?.sub);
  }

  @Delete(':id')
  @RequireFaceStepUp('DELETE_DEPARTMENT')
  @ApiOperation({ summary: 'Delete an empty department (requires face step-up)' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user?.sub);
  }
}
