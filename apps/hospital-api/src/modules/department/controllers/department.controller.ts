import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../common/types/auth-user.type';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { DepartmentService } from '../services/department.service';
import { AssignManagerDto, CreateDepartmentDto, DepartmentQueryDto, UpdateDepartmentDto } from '../dto/department.dto';
import { AdministrativeLifecycleService } from '../../../common/lifecycle/administrative-lifecycle.service';
import { EntityIntegrityGuard } from '../../../common/guards/entity-integrity.guard';
import { CheckEntityIntegrity } from '../../../common/decorators/check-entity-integrity.decorator';
import { BulkLifecycleDto } from '../../../common/lifecycle/dto/bulk-lifecycle.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiTags('Departments')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentController {
  constructor(private readonly service: DepartmentService, private readonly lifecycle: AdministrativeLifecycleService) {}

  @Post()
  @ApiOperation({ summary: 'Create a department' })
  create(@Body() dto: CreateDepartmentDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user?.sub);
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
  @UseGuards(EntityIntegrityGuard)
  @CheckEntityIntegrity({ entity: 'Department', paramKey: 'id' })
  @ApiOperation({ summary: 'Update a department' })
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user?.sub);
  }

  @Patch(':id/manager')
  @UseGuards(EntityIntegrityGuard)
  @CheckEntityIntegrity({ entity: 'Department', paramKey: 'id' })
  @ApiOperation({ summary: 'Assign or clear department manager' })
  assignManager(@Param('id') id: string, @Body() dto: AssignManagerDto, @CurrentUser() user: AuthUser) {
    return this.service.assignManager(id, dto, user?.sub);
  }

  @Delete(':id')
  @UseGuards(EntityIntegrityGuard)
  @CheckEntityIntegrity({ entity: 'Department', paramKey: 'id' })
  @ApiOperation({ summary: 'Delete an empty department' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.lifecycle.softDelete('departments', id, user.sub);
  }

  @Patch(':id/restore')
  restore(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.lifecycle.restore('departments', id, user.sub);
  }

  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.lifecycle.permanentDelete('departments', id, user.sub);
  }

  @Post('bulk/soft-delete')
  @ApiOperation({ summary: 'Bulk soft-delete departments (up to 100, per-item isolation)' })
  bulkSoftDelete(@Body() dto: BulkLifecycleDto, @CurrentUser() user: AuthUser) {
    return this.lifecycle.softDeleteMany('departments', dto.ids, user.sub);
  }

  @Post('bulk/restore')
  @ApiOperation({ summary: 'Bulk restore departments from soft-delete (up to 100, per-item isolation)' })
  bulkRestore(@Body() dto: BulkLifecycleDto, @CurrentUser() user: AuthUser) {
    return this.lifecycle.restoreMany('departments', dto.ids, user.sub);
  }

  @Post('bulk/permanent-delete')
  @ApiOperation({ summary: 'Bulk permanent-delete departments (up to 100, per-item isolation)' })
  bulkPermanentDelete(@Body() dto: BulkLifecycleDto, @CurrentUser() user: AuthUser) {
    return this.lifecycle.permanentDeleteMany('departments', dto.ids, user.sub);
  }
}
