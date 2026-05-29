import { Body, Controller, Get, Param, Patch, Post, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CreateMedicalOrderDto, CreateMedicalResultDto, MedicalOrderQueryDto, UpdateMedicalOrderStatusDto } from '../dto/medical-order.dto';
import { MedicalOrderService } from '../services/medical-order.service';

const resultFileStorage = diskStorage({
  destination: './uploads/medical-results',
  filename: (_req, file, callback) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    callback(null, `${unique}${extname(file.originalname)}`);
  },
});

@ApiTags('Medical Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('medical-orders')
export class MedicalOrderController {
  constructor(private readonly service: MedicalOrderService) {}

  @Roles('DOCTOR')
  @Post()
  create(@Body() dto: CreateMedicalOrderDto, @Req() req: any) {
    return this.service.create(dto, req.user.sub);
  }

  @Roles('ADMIN', 'DOCTOR', 'LAB_MANAGER')
  @Get()
  findAll(@Query() query: MedicalOrderQueryDto, @Req() req: any) {
    return this.service.findAll(query, req.user);
  }

  @Roles('ADMIN', 'LAB_MANAGER')
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateMedicalOrderStatusDto, @Req() req: any) {
    return this.service.updateStatus(id, dto.status, req.user);
  }

  @Roles('LAB_MANAGER')
  @Post(':id/results')
  createResult(@Param('id') id: string, @Body() dto: CreateMedicalResultDto, @Req() req: any) {
    return this.service.createResult(id, dto, req.user);
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
  uploadResultFiles(@Param('id') id: string, @UploadedFiles() files: Array<{ filename: string; originalname: string; mimetype: string; size: number }>) {
    return this.service.mapUploadedResultFiles(id, files || []);
  }
}
