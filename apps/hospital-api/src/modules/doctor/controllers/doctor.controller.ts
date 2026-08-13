import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../common/types/auth-user.type';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CreateDoctorDto, CreateDoctorWithStaffDto, DoctorQueryDto, UpdateDoctorDto } from '../dto/doctor.dto';
import { DoctorService } from '../services/doctor.service';
import { uploadAvatarToCloudinary } from '../../../infrastructure/storage/cloudinary-avatar-uploader';
import { AdministrativeLifecycleService } from '../../../common/lifecycle/administrative-lifecycle.service';
import { BulkLifecycleDto } from '../../../common/lifecycle/dto/bulk-lifecycle.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiTags('Doctors')
@ApiBearerAuth()
@Controller('doctors')
export class DoctorController {
  constructor(private readonly service: DoctorService, private readonly lifecycle: AdministrativeLifecycleService) { }

  @Post('upload-avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        callback(null, allowed.includes(file.mimetype));
      },
    }),
  )
  @ApiOperation({ summary: 'Upload doctor/staff avatar to Cloudinary' })
  async uploadAvatar(@UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number }) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn ảnh hợp lệ (PNG, JPG, WEBP).');
    }
    const url = await uploadAvatarToCloudinary(file);
    return { url };
  }

  @Post()
  @ApiOperation({ summary: 'Create a doctor profile for a staff profile with DOCTOR role' })
  create(@Body() dto: CreateDoctorDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user?.sub);
  }

  @Post('full')
  @ApiOperation({ summary: 'Create doctor user, staff profile, and doctor profile in one transaction' })
  createFull(@Body() dto: CreateDoctorWithStaffDto, @CurrentUser() user: AuthUser) {
    return this.service.createWithStaff(dto, user?.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List doctors with pagination, specialty filter, and search' })
  findAll(@Query() query: DoctorQueryDto) {
    return this.service.findAll(query);
  }

  @Get('audit/history')
  @ApiOperation({ summary: 'Change history of all doctors (blockchain logger)' })
  history() {
    return this.service.getHistory();
  }

  @Get('audit/verify')
  @ApiOperation({ summary: 'Verify integrity of all doctors against blockchain' })
  verifyAll() {
    return this.service.verifyAll();
  }

  @Roles('ADMIN', 'RECEPTIONIST', 'DOCTOR', 'LAB_MANAGER')
  @Get(':id')
  @ApiOperation({ summary: 'Get doctor profile details with audit integrity verification' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/audit/history')
  @ApiOperation({ summary: 'Change history of one doctor' })
  historyOne(@Param('id') id: string) {
    return this.service.getHistory(id);
  }

  @Get(':id/audit/verify')
  @ApiOperation({ summary: 'Verify integrity of one doctor against blockchain' })
  verifyOne(@Param('id') id: string) {
    return this.service.verifyDoctor(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update doctor specialty, license, qualification, or experience' })
  update(@Param('id') id: string, @Body() dto: UpdateDoctorDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user?.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.lifecycle.softDelete('doctors', id, user.sub);
  }

  @Patch(':id/restore')
  restore(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.lifecycle.restore('doctors', id, user.sub);
  }

  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.lifecycle.permanentDelete('doctors', id, user.sub);
  }

  @Post('bulk/soft-delete')
  @ApiOperation({ summary: 'Bulk soft-delete doctors (up to 100, per-item isolation)' })
  bulkSoftDelete(@Body() dto: BulkLifecycleDto, @CurrentUser() user: AuthUser) {
    return this.lifecycle.softDeleteMany('doctors', dto.ids, user.sub);
  }

  @Post('bulk/restore')
  @ApiOperation({ summary: 'Bulk restore doctors from soft-delete (up to 100, per-item isolation)' })
  bulkRestore(@Body() dto: BulkLifecycleDto, @CurrentUser() user: AuthUser) {
    return this.lifecycle.restoreMany('doctors', dto.ids, user.sub);
  }

  @Post('bulk/permanent-delete')
  @ApiOperation({ summary: 'Bulk permanent-delete doctors (up to 100, per-item isolation)' })
  bulkPermanentDelete(@Body() dto: BulkLifecycleDto, @CurrentUser() user: AuthUser) {
    return this.lifecycle.permanentDeleteMany('doctors', dto.ids, user.sub);
  }
}
