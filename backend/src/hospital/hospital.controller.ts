import {
  Controller,
  Get,
  Post,
  Body,
  Query,
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
  constructor(private readonly hospitalService: HospitalService) { }

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

  /**
   * GET /api/hospital/patients?search=...
   * Proxy to PATIENT_API_URL to avoid CORS from frontend
   */
  @Get('patients')
  @Roles('ADMIN', 'DOCTOR')
  async searchPatients(@Query('search') search?: string) {
    let baseUrl = (process.env.PATIENT_API_URL || 'http://localhost:8001/patients').replace(/\/$/, '');
    
    // BẮT BUỘC ĐỂ CHẠY ĐƯỢC TRONG DOCKER LINUX:
    if (baseUrl.includes('localhost')) {
      baseUrl = baseUrl.replace('localhost', '172.17.0.1');
    }
    
    const url = search ? `${baseUrl}?search=${encodeURIComponent(search)}` : baseUrl;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Patient API error: ${res.status}`);
      return res.json();
    } catch (err: any) {
      console.error('Patient API Proxy Error:', err.message);
      throw new BadRequestException(`Cannot reach patient API: ${err.message}`);
    }
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

  // ── DIAGNOSIS WORKFLOW ────────────────────────────────────────────────────

  /**
   * POST /api/hospital/diagnose
   * STEP 1: AI Preliminary Diagnosis
   * Content-Type: multipart/form-data
   * Fields: patientName, clinicalSymptoms, preliminaryTreatment, doctorNotes, aiModelId, doctorId, image (file)
   */
  @Post('diagnose')
  @Roles('DOCTOR')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('Only image files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  async createDiagnosis(
    @Body()
    body: {
      patientName: string;
      clinicalSymptoms: string;
      preliminaryTreatment: string;
      doctorNotes?: string;
      aiModelId: string;
      doctorId: string;
    },
    @UploadedFile() image: MulterFile,
  ) {
    if (!image) {
      throw new BadRequestException('Image file is required');
    }

    return this.hospitalService.createAiDiagnosis(
      body.doctorId,
      body.aiModelId,
      body.patientName,
      body.clinicalSymptoms,
      body.preliminaryTreatment,
      body.doctorNotes || '',
      image.buffer,
    );
  }

  /**
   * POST /api/hospital/conclude
   * STEP 2: Doctor Final Conclusion & Blockchain Recording
   * Body: { diagnosisId, finalConclusion, treatmentRegimen, note? }
   */
  @Post('conclude')
  @Roles('DOCTOR')
  async createConclude(
    @Body()
    body: {
      diagnosisId: string;
      finalConclusion: string;
      treatmentRegimen: string;
      note?: string;
    },
  ) {
    return this.hospitalService.createDoctorConclude(
      body.diagnosisId,
      body.finalConclusion,
      body.treatmentRegimen,
      body.note,
    );
  }
}
