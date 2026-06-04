import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../common/types/auth-user.type';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AiModelQueryDto, CreateAiModelDto, TestAiModelApiDto, RateAiModelDto } from '../dto/ai-model.dto';
import { AiModelService } from '../services/ai-model.service';

@ApiTags('AI Model Registry')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai-models')
export class AiModelController {
  constructor(private readonly service: AiModelService) {}

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
    return this.service.rateModel(id, user.sub, dto.satisfied, dto.feedback);
  }
}

