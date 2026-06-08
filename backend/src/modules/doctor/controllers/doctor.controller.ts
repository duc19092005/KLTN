import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../common/types/auth-user.type';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { FaceStepUpGuard } from '../../../common/stepup/face-stepup.guard';
import { RequireStepUpSession } from '../../../common/stepup/require-stepup-session.decorator';
import { CreateDoctorDto, CreateDoctorWithStaffDto, DoctorQueryDto, UpdateDoctorDto } from '../dto/doctor.dto';
import { DoctorService } from '../services/doctor.service';
import { uploadAvatarToCloudinary } from '../../../infrastructure/storage/cloudinary-uploader';

@UseGuards(JwtAuthGuard, RolesGuard, FaceStepUpGuard)
@Roles('ADMIN')
@ApiTags('Doctors')
@ApiBearerAuth()
@Controller('doctors')
export class DoctorController {
  constructor(private readonly service: DoctorService) { }

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
  async uploadAvatar(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn ảnh hợp lệ (PNG, JPG, WEBP).');
    }
    const url = await uploadAvatarToCloudinary(file);
    return { url };
  }

  @Post()
  @RequireStepUpSession()
  @ApiOperation({ summary: 'Create a doctor profile for a staff profile with DOCTOR role' })
  create(@Body() dto: CreateDoctorDto) {
    return this.service.create(dto);
  }

  @Post('full')
  @RequireStepUpSession()
  @ApiOperation({ summary: 'Create doctor user, staff profile, and doctor profile in one transaction' })
  createFull(@Body() dto: CreateDoctorWithStaffDto) {
    return this.service.createWithStaff(dto);
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
  @RequireStepUpSession()
  @ApiOperation({ summary: 'Update doctor specialty, license, qualification, or experience' })
  update(@Param('id') id: string, @Body() dto: UpdateDoctorDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user?.sub);
  }

}
