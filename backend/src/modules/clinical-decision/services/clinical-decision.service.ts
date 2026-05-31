import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createDecipheriv, createHash } from 'crypto';
import { AiModelRegistry, VisitStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateMedicalConclusionDto, GenerateAiAnalysisDto, ReviewAiDiagnosisDto } from '../dto/clinical-decision.dto';

const CLINICAL_AI_DISCLAIMER = 'AI chỉ hỗ trợ tham khảo, không thay thế quyết định chuyên môn của bác sĩ. Bác sĩ là người kết luận cuối.';
const CLINICAL_AI_SYSTEM_PROMPT = [
  'Bạn là hệ thống AI hỗ trợ bác sĩ phân tích dữ liệu khám bệnh, bao gồm cả hình ảnh y khoa (X-quang, CT, MRI, siêu âm, ECG...).',
  'Phân tích dựa trên triệu chứng, kết quả cận lâm sàng, ghi chú KTV và CÁC ẢNH ĐƯỢC ĐÍNH KÈM TRỰC TIẾP trong yêu cầu này.',
  'Khi có ảnh, hãy đọc kỹ từng ảnh và mô tả dấu hiệu quan sát được (vị trí, mức độ, bất thường) TRƯỚC khi đưa ra chẩn đoán phân biệt.',
  'Tuyệt đối không bịa ra dấu hiệu không có trên ảnh; chỉ mô tả những gì thực sự quan sát được. Nếu ảnh mờ hoặc không đọc được, nêu rõ trong limitations.',
  'Không tự khẳng định chẩn đoán cuối cùng, không thay bác sĩ ra y lệnh.',
  'Chỉ trả về JSON hợp lệ (không kèm văn bản nào ngoài JSON) với các khóa: summary, imageFindings, diagnosticProbabilities, clinicalConsiderations, riskFlags, recommendedNextSteps, limitations, disclaimer.',
  'imageFindings là mảng mô tả phát hiện trên từng ảnh; mỗi phần tử gồm: modality (loại ảnh, vd "X-quang ngực"), finding (mô tả dấu hiệu), severity ("nhẹ"|"trung bình"|"nặng"|"không rõ"). Nếu không có ảnh, để imageFindings là mảng rỗng [].',
  'diagnosticProbabilities là mảng 3-5 chẩn đoán phân biệt phù hợp nhất, mỗi phần tử gồm: condition, probability, reason.',
  'probability là số 0-100, tổng các probability nên xấp xỉ 100. Nếu chưa đủ dữ liệu, thêm mục "Khác / chưa đủ dữ liệu".',
  'Không trình bày probability như xác suất y khoa chắc chắn; đây chỉ là ước lượng hỗ trợ bác sĩ.',
  `Trường disclaimer phải là: "${CLINICAL_AI_DISCLAIMER}"`,
].join('\n');

type AiProviderResponse = {
  parsed?: Record<string, any>;
  text: string;
  confidence?: number;
};

// A medical image downloaded from (private) Cloudinary storage and inlined as base64 so it can
// be sent as real multimodal input to the AI provider instead of an unreachable text URL.
type AiImageAttachment = { mimeType: string; base64: string; label: string };

@Injectable()
export class ClinicalDecisionService {
  constructor(private readonly prisma: PrismaService) {}

  async getVisitResults(visitId: string, doctorUserId: string) {
    const visit = await this.ensureDoctorVisit(visitId, doctorUserId);
    return this.prisma.visit.findUniqueOrThrow({
      where: { id: visit.id },
      include: this.visitDecisionInclude(),
    });
  }

  async generateAiAnalysis(dto: GenerateAiAnalysisDto, doctorUserId: string) {
    const visit = await this.ensureDoctorVisit(dto.visitId, doctorUserId);
    const fullVisit = await this.prisma.visit.findUniqueOrThrow({ where: { id: visit.id }, include: this.visitDecisionInclude() });
    this.assertReadyForClinicalDecision(fullVisit.status);

    const aiModel = dto.aiModelId
      ? await this.prisma.aiModelRegistry.findUnique({ where: { id: dto.aiModelId } })
      : await this.prisma.aiModelRegistry.findFirst({
        where: {
          type: 'API',
          apiEndpoint: { not: null },
          OR: [
            { recommendedSpecialty: { contains: fullVisit.doctor.specialty, mode: 'insensitive' } },
            { recommendedSpecialty: null },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });

    if (!aiModel) throw new NotFoundException('No AI model registered');
    if (aiModel.type !== 'API') throw new BadRequestException('Selected model is not API-backed and cannot generate live AI analysis');
    if (!aiModel.apiEndpoint) throw new BadRequestException('Selected AI model does not have an API endpoint configured');

    const prompt = this.buildPrompt(fullVisit);
    // Pull the actual image bytes so the model can SEE the X-ray/MRI, not just a private URL.
    const images = await this.collectImageAttachments(fullVisit);
    const providerResponse = await this.callRegisteredAiModel(aiModel, prompt, images);
    const result = JSON.stringify({
      source: 'REAL_AI_MODEL',
      isMock: false,
      provider: aiModel.provider || 'other',
      modelName: aiModel.modelName,
      modelVersion: aiModel.modelVersion,
      generatedAt: new Date().toISOString(),
      imageCount: images.length,
      analysis: providerResponse.parsed || providerResponse.text,
      disclaimer: CLINICAL_AI_DISCLAIMER,
    });

    return this.prisma.aiDiagnosis.create({
      data: {
        aiModelId: aiModel.id,
        patientId: fullVisit.patientId,
        visitId: fullVisit.id,
        prompt,
        result,
        ...(providerResponse.confidence !== undefined ? { confidence: providerResponse.confidence } : {}),
        status: 'AI_SUGGESTED',
      },
      include: { aiModel: true },
    });
  }

  async reviewAiDiagnosis(id: string, dto: ReviewAiDiagnosisDto, doctorUserId: string) {
    const doctor = await this.getDoctorByUserId(doctorUserId);
    const diagnosis = await this.prisma.aiDiagnosis.findUnique({ where: { id }, include: { visit: true } });
    if (!diagnosis) throw new NotFoundException('AI diagnosis not found');
    if (!diagnosis.visit || diagnosis.visit.doctorId !== doctor.id) throw new BadRequestException('Doctor can only review own visit AI analysis');

    return this.prisma.aiDiagnosis.update({
      where: { id },
      data: {
        status: 'DOCTOR_REVIEWED',
        reviewedByDoctorId: doctor.id,
        doctorFeedback: dto.doctorFeedback?.trim() || null,
      },
      include: { aiModel: true, reviewedByDoctor: { include: { staffProfile: true } } },
    });
  }

  async createConclusion(dto: CreateMedicalConclusionDto, doctorUserId: string) {
    const visit = await this.ensureDoctorVisit(dto.visitId, doctorUserId);
    this.assertReadyForClinicalDecision(visit.status);

    if (dto.aiDiagnosisId) {
      const aiDiagnosis = await this.prisma.aiDiagnosis.findUnique({ where: { id: dto.aiDiagnosisId } });
      if (!aiDiagnosis || aiDiagnosis.visitId !== visit.id) throw new BadRequestException('AI diagnosis does not belong to this visit');
    }

    return this.prisma.$transaction(async (tx) => {
      const conclusion = await tx.medicalConclusion.upsert({
        where: { visitId: visit.id },
        create: {
          visitId: visit.id,
          doctorId: visit.doctorId,
          aiDiagnosisId: dto.aiDiagnosisId || null,
          finalDiagnosis: dto.finalDiagnosis.trim(),
          treatmentPlan: dto.treatmentPlan?.trim() || null,
          prescription: dto.prescription?.trim() || null,
          followUpNote: dto.followUpNote?.trim() || null,
          doctorNote: dto.doctorNote?.trim() || null,
        },
        update: {
          aiDiagnosisId: dto.aiDiagnosisId || null,
          finalDiagnosis: dto.finalDiagnosis.trim(),
          treatmentPlan: dto.treatmentPlan?.trim() || null,
          prescription: dto.prescription?.trim() || null,
          followUpNote: dto.followUpNote?.trim() || null,
          doctorNote: dto.doctorNote?.trim() || null,
          concludedAt: new Date(),
        },
        include: { aiDiagnosis: { include: { aiModel: true } }, doctor: { include: { staffProfile: true } } },
      });

      await tx.visit.update({
        where: { id: visit.id },
        data: { status: VisitStatus.COMPLETED, completedAt: new Date() },
      });

      return conclusion;
    });
  }

  private async ensureDoctorVisit(visitId: string, doctorUserId: string) {
    const doctor = await this.getDoctorByUserId(doctorUserId);
    const visit = await this.prisma.visit.findUnique({ where: { id: visitId } });
    if (!visit) throw new NotFoundException('Visit not found');
    if (visit.doctorId !== doctor.id) throw new BadRequestException('Doctor can only access own visit');
    return visit;
  }

  private assertReadyForClinicalDecision(status: VisitStatus) {
    if (status === VisitStatus.WAITING_CONCLUSION || status === VisitStatus.COMPLETED) return;
    throw new BadRequestException('Cần đủ kết quả cận lâm sàng trước khi AI phân tích hoặc bác sĩ kết luận');
  }

  private async getDoctorByUserId(userId: string) {
    const doctor = await this.prisma.doctorProfile.findFirst({ where: { staffProfile: { userId } } });
    if (!doctor) throw new BadRequestException('Current user does not have doctor profile');
    return doctor;
  }

  private visitDecisionInclude() {
    return {
      patient: true,
      doctor: { include: { staffProfile: { include: { department: true } } } },
      clinicalRoom: true,
      medicalOrders: {
        include: {
          targetDepartment: true,
          results: {
            include: {
              files: true,
              performedBy: { select: { id: true, username: true, email: true, role: true } },
            },
          },
        },
        orderBy: { orderedAt: 'desc' },
      },
      aiDiagnoses: { include: { aiModel: true, reviewedByDoctor: { include: { staffProfile: true } } }, orderBy: { createdAt: 'desc' } },
      finalConclusion: { include: { aiDiagnosis: { include: { aiModel: true } } } },
    } as const;
  }

  private buildPrompt(visit: any) {
    const results = visit.medicalOrders.flatMap((order) => order.results.map((result) => ({
      orderType: order.orderType,
      targetDepartment: order.targetDepartment?.name || null,
      note: result.note || null,
      // URLs are private (authenticated Cloudinary) and unreachable by the model, so we only
      // describe the files here; image bytes are attached separately as multimodal input.
      files: result.files?.map((file) => ({
        originalName: file.originalName,
        mimeType: file.mimeType,
        imageAttached: this.isAnalyzableImage(file.mimeType),
      })) || [],
    })));

    return [
      `Lượt khám: ${visit.visitCode}`,
      `Bệnh nhân: ${visit.patient.fullName}, giới tính ${visit.patient.gender}, ngày sinh ${visit.patient.birthDate}`,
      `Kết quả xét nghiệm/cận lâm sàng dạng JSON: ${JSON.stringify(results)}`,
      'Các ảnh y khoa (nếu có) được ĐÍNH KÈM TRỰC TIẾP ngay sau phần mô tả này — hãy phân tích trực tiếp trên ảnh, không yêu cầu hay chờ URL.',
      'Hãy phân tích hỗ trợ bác sĩ: tóm tắt dữ liệu, mô tả phát hiện trên ảnh (imageFindings), ước lượng khả năng chẩn đoán, điểm cần lưu ý, cảnh báo rủi ro, hướng xử trí cần bác sĩ cân nhắc.',
      'Trường diagnosticProbabilities phải là danh sách bệnh/nghi ngờ bệnh kèm phần trăm và lý do ngắn gọn.',
      'Không đưa ra kết luận cuối cùng thay bác sĩ và không khẳng định phần trăm là xác suất chắc chắn.',
      CLINICAL_AI_DISCLAIMER,
    ].join('\n');
  }

  private isAnalyzableImage(mimeType?: string | null) {
    return Boolean(mimeType && mimeType.startsWith('image/'));
  }

  // Walk the visit's result files, download each image from private Cloudinary storage and
  // inline it as base64. Capped in count + size to protect the provider token budget.
  private async collectImageAttachments(visit: any): Promise<AiImageAttachment[]> {
    const MAX_IMAGES = 6;
    const MAX_BYTES = 8 * 1024 * 1024;
    const attachments: AiImageAttachment[] = [];

    for (const order of visit.medicalOrders || []) {
      for (const result of order.results || []) {
        for (const file of result.files || []) {
          if (attachments.length >= MAX_IMAGES) return attachments;
          if (!this.isAnalyzableImage(file.mimeType)) continue;
          const base64 = await this.downloadResultImageAsBase64(file, MAX_BYTES);
          if (base64) {
            attachments.push({ mimeType: file.mimeType, base64, label: `${order.orderType} - ${file.originalName}` });
          }
        }
      }
    }
    return attachments;
  }

  private async downloadResultImageAsBase64(file: any, maxBytes: number): Promise<string | null> {
    try {
      const url = this.buildSignedCloudinaryImageUrl(file);
      if (!url) return null;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > maxBytes) return null;
        return Buffer.from(arrayBuffer).toString('base64');
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      return null;
    }
  }

  // Mirrors the signed-download approach used by MedicalOrderService: result files are stored
  // as `authenticated` (private) Cloudinary assets, so a signed, short-lived URL is required.
  private buildSignedCloudinaryImageUrl(file: any): string | null {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret || !file.fileName) return null;

    const format = this.extractFileFormat(file.originalName, file.mimeType);
    const timestamp = Math.floor(Date.now() / 1000);
    const expiresAt = timestamp + 300; // 5-minute TTL
    const params: Record<string, string> = {
      expires_at: String(expiresAt),
      public_id: file.fileName,
      timestamp: String(timestamp),
      type: 'authenticated',
    };
    if (format) params.format = format;

    const signature = this.signCloudinaryParams(params, apiSecret);
    const query = new URLSearchParams({ ...params, signature, api_key: apiKey }).toString();
    return `https://api.cloudinary.com/v1_1/${cloudName}/image/download?${query}`;
  }

  private extractFileFormat(originalName?: string, mimeType?: string) {
    const ext = originalName?.includes('.') ? originalName.split('.').pop()!.toLowerCase() : '';
    if (ext) return ext;
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    return (mimeType && map[mimeType]) || '';
  }

  private signCloudinaryParams(params: Record<string, string>, apiSecret: string) {
    const payload = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');
    return createHash('sha1').update(`${payload}${apiSecret}`).digest('hex');
  }

  private async callRegisteredAiModel(aiModel: AiModelRegistry, prompt: string, images: AiImageAttachment[]): Promise<AiProviderResponse> {
    const token = this.decryptSecret(aiModel.ipHashEncrypted);
    const provider = (aiModel.provider || 'other').toLowerCase();

    if (provider === 'gemini') return this.callGemini(aiModel, token, prompt, images);
    if (provider === 'anthropic') return this.callAnthropic(aiModel, token, prompt, images);
    return this.callOpenAiCompatible(aiModel, token, prompt, images);
  }

  private async callOpenAiCompatible(aiModel: AiModelRegistry, token: string, prompt: string, images: AiImageAttachment[]): Promise<AiProviderResponse> {
    // OpenAI-compatible vision: user content becomes an array of text + image_url(data URL) parts.
    const userContent = images.length
      ? [
        { type: 'text', text: prompt },
        ...images.map((img) => ({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.base64}` } })),
      ]
      : prompt;

    const response = await this.postJson(aiModel.apiEndpoint!, {
      Authorization: `Bearer ${token}`,
    }, {
      model: aiModel.modelVersion,
      temperature: 0.2,
      messages: [
        { role: 'system', content: CLINICAL_AI_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    });

    const text = this.extractOpenAiCompatibleText(response);
    return this.normalizeProviderResponse(text);
  }

  private async callGemini(aiModel: AiModelRegistry, token: string, prompt: string, images: AiImageAttachment[]): Promise<AiProviderResponse> {
    const endpoint = this.withGeminiApiKey(this.withGeminiModel(aiModel.apiEndpoint!, aiModel.modelVersion), token);
    // Gemini vision: append each image as an inlineData part alongside the text part.
    const parts: any[] = [{ text: `${CLINICAL_AI_SYSTEM_PROMPT}\n\n${prompt}` }];
    for (const img of images) parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });

    const response = await this.postJson(endpoint, {}, {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    });

    const text = response?.candidates?.[0]?.content?.parts?.map((part) => part.text).filter(Boolean).join('\n');
    return this.normalizeProviderResponse(text || JSON.stringify(response));
  }

  private async callAnthropic(aiModel: AiModelRegistry, token: string, prompt: string, images: AiImageAttachment[]): Promise<AiProviderResponse> {
    // Claude vision: content is an array of text + base64 image source blocks.
    const content: any[] = [{ type: 'text', text: prompt }];
    for (const img of images) content.push({ type: 'image', source: { type: 'base64', media_type: img.mimeType, data: img.base64 } });

    const response = await this.postJson(aiModel.apiEndpoint!, {
      'x-api-key': token,
      'anthropic-version': '2023-06-01',
    }, {
      model: aiModel.modelVersion,
      max_tokens: 1200,
      temperature: 0.2,
      system: CLINICAL_AI_SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    });

    const text = response?.content?.map((item) => item.text).filter(Boolean).join('\n');
    return this.normalizeProviderResponse(text || JSON.stringify(response));
  }

  private async postJson(endpoint: string, headers: Record<string, string>, body: Record<string, any>) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...headers,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const responseText = await response.text();
      const responseJson = this.tryParseJson(responseText);

      if (!response.ok) {
        throw new BadRequestException(`AI provider request failed (${response.status}): ${this.extractProviderError(responseJson, responseText)}`);
      }

      return responseJson || { text: responseText };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      const message = error instanceof Error ? error.message : 'Unknown AI provider error';
      throw new BadRequestException(`AI provider request failed: ${this.truncate(message)}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private decryptSecret(encryptedValue: string) {
    const rawKey = process.env.ENCRYPTION_KEY;
    if (!rawKey) throw new BadRequestException('ENCRYPTION_KEY is not configured');

    const key = Buffer.from(rawKey, 'hex');
    if (key.length !== 32) throw new BadRequestException('ENCRYPTION_KEY must be 32 bytes hex for AES-256');

    // Expected format: v1:ivHex:tagHex:cipherHex (AES-256-GCM, authenticated).
    if (!encryptedValue.startsWith('v1:')) throw new BadRequestException('AI model secret is invalid or uses a legacy format; please re-enter the API key');
    const [, ivHex, tagHex, cipherHex] = encryptedValue.split(':');
    if (!ivHex || !tagHex || !cipherHex) throw new BadRequestException('AI model secret is invalid');

    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(cipherHex, 'hex')), decipher.final()]).toString('utf8');
  }

  private withGeminiApiKey(endpoint: string, token: string) {
    try {
      const url = new URL(endpoint);
      if (!url.searchParams.has('key')) url.searchParams.set('key', token);
      return url.toString();
    } catch {
      throw new BadRequestException('Selected Gemini API endpoint is invalid');
    }
  }

  private withGeminiModel(endpoint: string, modelVersion: string) {
    return endpoint.includes(':generateContent')
      ? endpoint.replace(/models\/[^/:]+:generateContent/, `models/${modelVersion}:generateContent`)
      : endpoint;
  }

  private extractOpenAiCompatibleText(response: any) {
    return response?.choices?.[0]?.message?.content
      || response?.choices?.[0]?.text
      || response?.output_text
      || response?.text
      || JSON.stringify(response);
  }

  private normalizeProviderResponse(text: string): AiProviderResponse {
    const parsed = this.extractJsonObject(text);
    const confidence = this.extractConfidence(parsed);
    const analysis = parsed ? { ...parsed, disclaimer: CLINICAL_AI_DISCLAIMER } : undefined;
    return { text, parsed: analysis, ...(confidence !== undefined ? { confidence } : {}) };
  }

  private extractJsonObject(text: string) {
    const trimmed = text.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
    const candidates = [trimmed, fenced, trimmed.slice(trimmed.indexOf('{'), trimmed.lastIndexOf('}') + 1)].filter(Boolean);

    for (const candidate of candidates) {
      const parsed = this.tryParseJson(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    }
    return undefined;
  }

  private tryParseJson(value: string) {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }

  private extractConfidence(parsed?: Record<string, any>) {
    const value = Number(parsed?.confidence);
    if (!Number.isFinite(value)) return undefined;
    if (value < 0 || value > 1) return undefined;
    return value;
  }

  private extractProviderError(responseJson: any, responseText: string) {
    const message = responseJson?.error?.message || responseJson?.message || responseText || 'Provider returned an error';
    return this.truncate(String(message));
  }

  private truncate(value: string, maxLength = 800) {
    return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
  }
}
