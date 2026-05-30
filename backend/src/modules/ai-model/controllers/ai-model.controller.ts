import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AiModelQueryDto, CreateAiModelDto, TestAiModelApiDto } from '../dto/ai-model.dto';
import { AiModelService } from '../services/ai-model.service';

@ApiTags('AI Model Registry')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai-models')
export class AiModelController {
  constructor(private readonly service: AiModelService) {}

  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateAiModelDto, @Req() req: any) {
    return this.service.create(dto, req.user.sub);
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
}

