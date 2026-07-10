import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../common/types/auth-user.type';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AiModelQueryDto, CreateAiModelDto, TestAiModelApiDto, RateAiModelDto, UpdateAiModelDto } from '../dto/ai-model.dto';
import { AiModelService } from '../services/ai-model.service';
import { AdministrativeLifecycleService } from '../../../common/lifecycle/administrative-lifecycle.service';

@ApiTags('AI Model Registry')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai-models')
export class AiModelController {
  constructor(private readonly service: AiModelService, private readonly lifecycle: AdministrativeLifecycleService) {}

  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateAiModelDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user.sub);
  }

  @Roles('ADMIN')
  @Post('test-api')
  testApi(@Body() dto: TestAiModelApiDto) {
    return this.service.testApi(dto);
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAiModelDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user.sub);
  }

  @Roles('ADMIN')
  @Patch(':id/hide')
  hide(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.hide(id, user.sub);
  }

  @Roles('ADMIN')
  @Patch(':id/restore')
  restore(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.lifecycle.restore('ai-models', id, user.sub);
  }

  @Roles('ADMIN')
  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.lifecycle.permanentDelete('ai-models', id, user.sub);
  }

  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.lifecycle.softDelete('ai-models', id, user.sub);
  }

  @Roles('ADMIN')
  @Get('audit/history')
  history() {
    return this.service.getHistory();
  }

  @Roles('ADMIN')
  @Get('audit/verify')
  verifyAll() {
    return this.service.verifyAll();
  }

  @Roles('ADMIN', 'DOCTOR')
  @Get('stats/overview')
  getStats() {
    return this.service.getStats();
  }

  @Roles('ADMIN', 'DOCTOR')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles('ADMIN')
  @Get(':id/audit/history')
  historyOne(@Param('id') id: string) {
    return this.service.getHistory(id);
  }

  @Roles('ADMIN')
  @Get(':id/audit/verify')
  verifyOne(@Param('id') id: string) {
    return this.service.verifyAiModel(id);
  }

  @Roles('ADMIN', 'DOCTOR')
  @Get()
  findAll(@Query() query: AiModelQueryDto) {
    return this.service.findAll(query);
  }

  @Roles('DOCTOR')
  @Post(':id/rate')
  rate(@Param('id') id: string, @Body() dto: RateAiModelDto, @CurrentUser() user: AuthUser) {
    return this.service.rateModel(id, user.sub, dto.aiDiagnosisId, dto.satisfied, dto.feedback);
  }
}

