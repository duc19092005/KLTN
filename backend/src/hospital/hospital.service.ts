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
import { EncryptionService } from '../encryption/encryption.service';

@Injectable()
export class HospitalService {
  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
    private encryptionService: EncryptionService,
  ) { }

  // ── READ ──────────────────────────────────────────────────────────────────

  async getDoctors() {
    return this.prisma.doctorProfile.findMany({
      include: {
        user: { select: { id: true, username: true, email: true, status: true } },
      },
    });
  }

  async getDiagnoses(status?: string, doctorId?: string) {
    const where: any = {};
    
    if (status) {
      where.diagnoseStatus = status;
    }
    
    if (doctorId) {
      where.doctorId = doctorId;
    }

    return this.prisma.aiDiagnosis.findMany({
      where,
      include: {
        doctor: true,
        aiModel: true,
        finalConclude: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getBlockchainTransactions() {
    return this.prisma.blockchainHistory.findMany({
      orderBy: { confirmTime: 'desc' },
    });
  }

  async getAiModels() {
    return this.prisma.aiModelRegistry.findMany();
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
    const aiModel = await this.prisma.aiModelRegistry.findUnique({
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

    // 2. Call AI Model API using stored provider config
    let aiResults: any = {};
    let segmentImageHash = crypto.randomBytes(32).toString('hex'); // Mock segment hash for now

    try {
      if (aiModel.ipHashEncrypted) {
        const plainHash = this.encryptionService.decrypt(aiModel.ipHashEncrypted);
        let config;
        try {
          config = JSON.parse(plainHash);
        } catch (e) {
          throw new BadRequestException('Invalid AI Model configuration format');
        }

        if (config && config.apiKey && config.model) {
          let baseUrl = 'https://api.openai.com/v1';
          if (config.baseUrl) {
            baseUrl = config.baseUrl.endsWith('/') ? config.baseUrl.slice(0, -1) : config.baseUrl;
          }
          const apiUrl = `${baseUrl}/chat/completions`;
          
          let authHeader = `Bearer ${config.apiKey}`;
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          };

          if (config.provider === 'anthropic') {
            headers['x-api-key'] = config.apiKey;
            headers['anthropic-version'] = '2023-06-01';
            delete headers['Authorization'];
          }

          const prompt = `Bạn là một bác sĩ chẩn đoán AI. Hãy chẩn đoán dựa trên thông tin sau:
Tên bệnh nhân: ${patientName}
Triệu chứng lâm sàng: ${clinicalSymptoms}
Điều trị sơ bộ: ${preliminaryTreatment}
Ghi chú bác sĩ: ${doctorNotes || 'Không có'}
Mã băm hình ảnh: ${inputImageHash}

Trình bày kết quả chẩn đoán bắt buộc dưới dạng JSON CHUẨN, KHÔNG CÓ BẤT KỲ VĂN BẢN NÀO KHÁC BÊN NGOÀI.
Các key là tên bệnh, value là tỷ lệ phần trăm tự tin (từ 0.0 đến 1.0).
Ví dụ: {"Viêm phổi": 0.85, "Bình thường": 0.15}`;

          const response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model: config.model,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.2
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const content = config.provider === 'anthropic' 
              ? data.content[0].text 
              : data.choices[0].message.content;
            
            // Clean up backticks if model returns markdown block
            const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
            
            try {
              aiResults = JSON.parse(cleanContent);
            } catch (err) {
              console.warn('[Hospital] Failed to parse AI JSON:', cleanContent);
              aiResults = { "Kết quả": cleanContent };
            }
          } else {
            const errorText = await response.text();
            throw new Error(`AI API failed: ${response.status} - ${errorText}`);
          }
        } else {
          throw new BadRequestException('AI Model missing credentials');
        }
      } else {
         throw new BadRequestException('AI Model has no configuration');
      }
    } catch (err) {
      console.warn('[Hospital] AI Provider fetch failed:', err.message);
      throw new BadRequestException(`Không thể kết nối API của AI Model: ${err.message}`);
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
