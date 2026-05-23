import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { HospitalService } from './hospital.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateDoctorDto } from './dto/create-doctor.dto';

/** Minimal Multer file interface (avoids needing @types/multer) */
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Controller('hospital')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HospitalController {
  constructor(private readonly hospitalService: HospitalService) {}

  // ── READ ─────────────────────────────────────────────────────────────────

  @Get('doctors')
  @Roles('ADMIN', 'DOCTOR')
  async getDoctors() {
    return this.hospitalService.getDoctors();
  }

  @Get('diagnoses')
  @Roles('ADMIN', 'DOCTOR')
  async getDiagnoses() {
    return this.hospitalService.getDiagnoses();
  }

  @Get('transactions')
  @Roles('ADMIN', 'DOCTOR')
  async getTransactions() {
    return this.hospitalService.getBlockchainTransactions();
  }

  @Get('aimodels')
  @Roles('ADMIN', 'DOCTOR')
  async getAiModels() {
    return this.hospitalService.getAiModels();
  }

  // ── CREATE DOCTOR ─────────────────────────────────────────────────────────

  /**
   * POST /api/hospital/doctors
   * Content-Type: multipart/form-data
   * Fields: all CreateDoctorDto fields + optional portrait (image file)
   */
  @Post('doctors')
  @Roles('ADMIN')
  @UseInterceptors(
    FileInterceptor('portrait', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('Only image files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  async createDoctor(
    @Body() dto: CreateDoctorDto,
    @UploadedFile() portrait?: MulterFile,
  ) {
    return this.hospitalService.createDoctor(dto, portrait?.buffer ?? null);
  }
}
