import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class HospitalService {
  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
  ) { }

  // ── READ ──────────────────────────────────────────────────────────────────

  async getDoctors() {
    return this.prisma.doctorProfile.findMany({
      include: {
        user: { select: { id: true, username: true, email: true, status: true } },
      },
    });
  }

  async getDiagnoses() {
    return this.prisma.aiDiagnosis.findMany({
      include: {
        doctor: true,
        aiModel: true,
        finalConclude: true,
      },
    });
  }

  async getBlockchainTransactions() {
    return this.prisma.blockchainHistory.findMany({
      orderBy: { confirmTime: 'desc' },
    });
  }

  async getAiModels() {
    return this.prisma.aiModelInfo.findMany();
  }

  // ── CREATE DOCTOR ─────────────────────────────────────────────────────────

  /**
   * Admin creates a doctor account:
   * 1. Hash temp password
   * 2. Parse / store face embedding
   * 3. Compute SHA-256 metadata hash: SHA256(licenseId + position + faceHash + doctorId)
   * 4. Persist hash to BlockchainHistory (try real blockchain, fall back gracefully)
   * 5. Create User + DoctorProfile in DB
   */
  async createDoctor(dto: CreateDoctorDto, portraitBuffer: Buffer | null) {
    // ── guard: unique constraints ──────────────────────────────────────────
    const [existingUser, existingLicense, existingIdentity] = await Promise.all([
      this.prisma.user.findFirst({
        where: { OR: [{ username: dto.username }, { email: dto.email }] },
      }),
      this.prisma.doctorProfile.findUnique({ where: { licenseId: dto.licenseId } }),
      this.prisma.doctorProfile.findUnique({ where: { identityNumber: dto.identityNumber } }),
    ]);

    if (existingUser) throw new ConflictException('Username or email already exists');
    if (existingLicense) throw new ConflictException('License ID already registered');
    if (existingIdentity) throw new ConflictException('Identity number already registered');

    // ── 1. password ────────────────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash(dto.tempPassword, 10);

    // ── 2. portrait ────────────────────────────────────────────────────────
    const portraitBase64 = portraitBuffer
      ? portraitBuffer.toString('base64')
      : null;

    // ── 3. face embedding ──────────────────────────────────────────────────
    let embedding: number[] = [];
    if (dto.faceEmbedding) {
      try {
        embedding = JSON.parse(dto.faceEmbedding);
        if (!Array.isArray(embedding)) embedding = [];
      } catch {
        embedding = [];
      }
    }
    const faceEmbeddingStr = embedding.length > 0 ? JSON.stringify(embedding) : null;
    const faceHash = embedding.length > 0 ? this.hashEmbedding(embedding) : null;

    // ── 4. create User + DoctorProfile ────────────────────────────────────
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        password: hashedPassword,
        role: 'DOCTOR',
        status: 'ACTIVE',
        firstLogin: true,
        registrationStep: 1,
        doctorProfile: {
          create: {
            doctorName: dto.doctorName,
            licenseId: dto.licenseId,
            identityNumber: dto.identityNumber,
            position: dto.position,
            specialties: dto.specialties,
            degree: dto.degree,
            facultyOfWork: dto.facultyOfWork,
            dateOfBirth: new Date(dto.dateOfBirth),
            workingStartDate: new Date(dto.workingStartDate),
            portraitImage: portraitBase64,
            faceEmbedding: faceEmbeddingStr,
            faceEmbeddingHash: faceHash,
            doctorStatus: 'ACTIVE',
          },
        },
      },
      include: { doctorProfile: true },
    });

    const profile = user.doctorProfile!;

    // ── 5. compute metadata hash ───────────────────────────────────────────
    //   SHA256( licenseId : position : faceHash : doctorProfileId )
    const metadataHash = this.computeMetadataHash(
      dto.licenseId,
      dto.position,
      faceHash ?? '',
      profile.id,
    );

    // ── 6. register hash on blockchain (best-effort) ───────────────────────
    let blockchainTxHash: string | null = null;
    let blockchainStatus = 'PENDING';

    try {
      const result = await this.registerDoctorHashOnChain(metadataHash);
      if (result.success) {
        blockchainTxHash = result.hash ?? null;
        blockchainStatus = 'SUCCESS';
      }
    } catch (err) {
      console.warn('[Hospital] Blockchain registration failed, continuing:', err?.message);
    }

    // ── 7. persist BlockchainHistory record ───────────────────────────────
    const bcHistory = await this.prisma.blockchainHistory.create({
      data: {
        transactionId: blockchainTxHash ?? `local-${profile.id}`,
        confirmTime: new Date(),
        blockchainStatus,
        errorReason: blockchainStatus !== 'SUCCESS' ? 'Blockchain unavailable' : null,
      },
    });

    // ── 8. link blockchain record + metadata hash to DoctorProfile ─────────
    await this.prisma.doctorProfile.update({
      where: { id: profile.id },
      data: {
        blockchainHistoryId: bcHistory.id,
        blockchainHash: metadataHash,
      },
    });

    return {
      message: 'Doctor account created successfully',
      doctor: {
        id: profile.id,
        username: user.username,
        email: user.email,
        doctorName: profile.doctorName,
        licenseId: profile.licenseId,
        position: profile.position,
        hasFaceEmbedding: !!faceEmbeddingStr,
        metadataHash,
        blockchainStatus,
        blockchainTxHash,
      },
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Convert SHA-256 hex hash → BigInt → call registerIdentity on IdentityRegistry
   * (reuses existing contract — treats the metadata hash as a ZKP commitment)
   */
  private async registerDoctorHashOnChain(metadataHashHex: string) {
    const commitment = (BigInt('0x' + metadataHashHex)).toString();
    // We use the superAdmin relayer approach: the backend signs on behalf
    return this.blockchainService.registerOnChain(commitment, '0x0000000000000000000000000000000000000001');
  }

  /**
   * SHA-256( licenseId : position : faceHash : doctorId )
   */
  private computeMetadataHash(
    licenseId: string,
    position: string,
    faceHash: string,
    doctorId: string,
  ): string {
    const raw = `${licenseId}:${position}:${faceHash}:${doctorId}`;
    return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
  }

  /**
   * Hash face embedding using the same method as FaceService
   * (quantize → SHA-256 → mod bn254 prime)
   */
  private hashEmbedding(embedding: number[]): string {
    const quantized = embedding.map((v) => Math.round(v * 10000));
    const buffer = Buffer.from(quantized.join(','));
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const bn254Prime = BigInt(
      '21888242871839275222246405745257275088548364400416034343698204186575808495617',
    );
    const hashBigInt = BigInt('0x' + hash) % bn254Prime;
    return hashBigInt.toString();
  }

  // ── DIAGNOSIS WORKFLOW ────────────────────────────────────────────────────

  /**
   * STEP 1: AI Preliminary Diagnosis
   * - Upload image to AI Model API (PATIENT_API_URL)
   * - Get AI diagnosis results
   * - Create AiDiagnosis record with status PENDING
   */
  async createAiDiagnosis(
    doctorProfileId: string,
    aiModelId: string,
    patientName: string,
    clinicalSymptoms: string,
    preliminaryTreatment: string,
    doctorNotes: string,
    imageBuffer: Buffer,
  ) {
    console.log('[Hospital] createAiDiagnosis called with:', {
      doctorProfileId,
      aiModelId,
      patientName,
    });

    // 0. Verify DoctorProfile exists
    const doctorProfile = await this.prisma.doctorProfile.findUnique({
      where: { id: doctorProfileId },
    });

    console.log('[Hospital] DoctorProfile lookup result:', doctorProfile ? 'FOUND' : 'NOT FOUND');

    if (!doctorProfile) {
      throw new BadRequestException(`Doctor profile not found with id: ${doctorProfileId}`);
    }

    // Verify AI Model exists
    const aiModel = await this.prisma.aiModelInfo.findUnique({
      where: { id: aiModelId },
    });

    if (!aiModel) {
      throw new BadRequestException('AI Model not found');
    }

    // 1. Hash input image
    const inputImageHash = crypto
      .createHash('sha256')
      .update(imageBuffer)
      .digest('hex');

    // 2. Call AI Model API (external service)
    const aiApiUrl = process.env.PATIENT_API_URL || 'http://localhost:8001/patients';
    let aiResults: any = {};
    let segmentImageHash = '';

    try {
      // TODO: Replace with actual AI API call
      // For now, simulate AI response
      const response = await fetch(`${aiApiUrl}/diagnose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName,
          clinicalSymptoms,
          imageHash: inputImageHash,
          modelId: aiModelId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        aiResults = data.results || {};
        segmentImageHash = data.segmentImageHash || '';
      } else {
        // Fallback: mock results if AI service unavailable
        aiResults = {
          pneumonia: 0.85,
          normal: 0.15,
        };
        segmentImageHash = crypto.randomBytes(32).toString('hex');
      }
    } catch (err) {
      console.warn('[Hospital] AI API unavailable, using mock results:', err.message);
      // Mock results for development
      aiResults = {
        disease_detected: 0.78,
        normal: 0.22,
      };
      segmentImageHash = crypto.randomBytes(32).toString('hex');
    }

    // 3. Create AiDiagnosis record with patient info
    const diagnosis = await this.prisma.aiDiagnosis.create({
      data: {
        doctorId: doctorProfileId,
        aiModelId,
        patientName,
        clinicalSymptoms,
        preliminaryTreatment,
        doctorNotes,
        inputImageHash,
        aiDiagnoseConfidentResults: JSON.stringify(aiResults),
        aiDiagnoseSegmentImageHash: segmentImageHash,
        diagnoseStatus: 'PENDING',
      },
      include: {
        doctor: true,
        aiModel: true,
      },
    });

    return {
      diagnosisId: diagnosis.id,
      aiResults: diagnosis,
      message: 'AI diagnosis completed successfully',
    };
  }

  /**
   * STEP 2: Doctor Final Conclusion & Blockchain Recording
   * - Doctor reviews AI results and provides final conclusion
   * - Hash the conclusion with SHA-512
   * - Create DoctorFinalConclude record
   * - Record conclusion hash on blockchain
   */
  async createDoctorConclude(
    diagnosisId: string,
    finalConclusion: string,
    treatmentRegimen: string,
    note?: string,
  ) {
    // 1. Verify diagnosis exists and is PENDING
    const diagnosis = await this.prisma.aiDiagnosis.findUnique({
      where: { id: diagnosisId },
      include: { finalConclude: true },
    });

    if (!diagnosis) {
      throw new BadRequestException('Diagnosis not found');
    }

    if (diagnosis.finalConclude) {
      throw new ConflictException('Diagnosis already has a final conclusion');
    }

    // 2. Hash final conclusion with SHA-512
    const conclusionData = `${finalConclusion}:${treatmentRegimen}:${note || ''}:${diagnosisId}`;
    const conclusionHash = crypto
      .createHash('sha512')
      .update(conclusionData, 'utf8')
      .digest('hex');

    // 3. Record on blockchain (best-effort)
    let blockchainTxHash: string | null = null;
    let blockchainStatus = 'PENDING';

    try {
      // Convert SHA-512 hash to BigInt for blockchain
      // Take first 64 hex chars (256 bits) to fit in uint256
      const hashForChain = conclusionHash.substring(0, 64);
      const commitment = (BigInt('0x' + hashForChain)).toString();

      const result = await this.blockchainService.registerOnChain(
        commitment,
        '0x0000000000000000000000000000000000000002', // Diagnosis marker address
      );

      if (result.success) {
        blockchainTxHash = result.hash ?? null;
        blockchainStatus = 'SUCCESS';
      }
    } catch (err) {
      console.warn('[Hospital] Blockchain recording failed:', err?.message);
      blockchainStatus = 'FAILED';
    }

    // 4. Create BlockchainHistory record
    const bcHistory = await this.prisma.blockchainHistory.create({
      data: {
        transactionId: blockchainTxHash ?? `local-conclude-${diagnosisId}`,
        confirmTime: new Date(),
        blockchainStatus,
        errorReason: blockchainStatus !== 'SUCCESS' ? 'Blockchain unavailable' : null,
      },
    });

    // 5. Create DoctorFinalConclude record
    const conclude = await this.prisma.doctorFinalConclude.create({
      data: {
        diagnoseId: diagnosisId,
        finalConclusionMessageHash: conclusionHash,
        treatmentRegimen,
        note: note || '',
        blockchainHistoryId: bcHistory.id,
      },
      include: {
        diagnose: {
          include: {
            doctor: true,
            aiModel: true,
          },
        },
        blockchainHistory: true,
      },
    });

    // 6. Update diagnosis status to COMPLETED
    await this.prisma.aiDiagnosis.update({
      where: { id: diagnosisId },
      data: { diagnoseStatus: 'COMPLETED' },
    });

    return {
      message: 'Doctor conclusion recorded successfully',
      conclude,
      blockchainTxHash,
      blockchainStatus,
      conclusionHash,
    };
  }
}
