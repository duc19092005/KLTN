import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../common/types/auth-user.type';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CreateMedicalOrderDto, CreateMedicalResultDto, MedicalOrderQueryDto, UpdateMedicalOrderStatusDto } from '../dto/medical-order.dto';
import { MedicalOrderService } from '../services/medical-order.service';

const resultFileStorage = memoryStorage();

@ApiTags('Medical Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('medical-orders')
export class MedicalOrderController {
  constructor(private readonly service: MedicalOrderService) {}

  @Roles('DOCTOR')
  @Post()
  create(@Body() dto: CreateMedicalOrderDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user.sub);
  }

  @Roles('ADMIN', 'DOCTOR', 'LAB_MANAGER')
  @Get()
  findAll(@Query() query: MedicalOrderQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.findAll(query, user);
  }

  @Roles('ADMIN', 'DOCTOR', 'LAB_MANAGER')
  @Get('results/files/:fileId/download')
  getResultFileDownloadUrl(@Param('fileId') fileId: string, @CurrentUser() user: AuthUser) {
    return this.service.getResultFileDownloadUrl(fileId, user);
  }

  @Roles('ADMIN', 'LAB_MANAGER')
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateMedicalOrderStatusDto, @CurrentUser() user: AuthUser, @Headers('x-demo-mode') demoMode?: string) {
    return this.service.updateStatus(id, dto.status, user, isDemoModeHeader(demoMode));
  }

  @Roles('LAB_MANAGER')
  @Post(':id/results')
  createResult(@Param('id') id: string, @Body() dto: CreateMedicalResultDto, @CurrentUser() user: AuthUser, @Headers('x-demo-mode') demoMode?: string) {
    return this.service.createResult(id, dto, user, isDemoModeHeader(demoMode));
  }

  @Roles('LAB_MANAGER')
  @Post(':id/results/files')
  @UseInterceptors(FilesInterceptor('files', 10, {
    storage: resultFileStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
      const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      callback(null, allowed.includes(file.mimetype));
    },
  }))
  uploadResultFiles(@Param('id') id: string, @UploadedFiles() files: Array<{ buffer: Buffer; originalname: string; mimetype: string; size: number }>) {
    return this.service.mapUploadedResultFiles(id, files || []);
  }
}

function isDemoModeHeader(value?: string) {
  return value === 'true' || value === '1';
}
