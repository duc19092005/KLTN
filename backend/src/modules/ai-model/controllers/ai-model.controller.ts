import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AiModelQueryDto, CreateAiModelDto } from '../dto/ai-model.dto';
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

  @Roles('ADMIN', 'DOCTOR')
  @Get()
  findAll(@Query() query: AiModelQueryDto) {
    return this.service.findAll(query);
  }

  @Roles('ADMIN', 'DOCTOR')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
