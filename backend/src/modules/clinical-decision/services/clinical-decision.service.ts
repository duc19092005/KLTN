import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createDecipheriv } from 'crypto';
import { AiModelRegistry, VisitStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateMedicalConclusionDto, GenerateAiAnalysisDto, ReviewAiDiagnosisDto } from '../dto/clinical-decision.dto';

const CLINICAL_AI_DISCLAIMER = 'AI chỉ hỗ trợ tham khảo, không thay thế quyết định chuyên môn của bác sĩ. Bác sĩ là người kết luận cuối.';
const CLINICAL_AI_SYSTEM_PROMPT = [
  'Bạn là hệ thống AI hỗ trợ bác sĩ phân tích dữ liệu khám bệnh.',
  'Chỉ phân tích dựa trên triệu chứng, kết quả cận lâm sàng và thông tin được cung cấp.',
  'Không tự khẳng định chẩn đoán cuối cùng, không thay bác sĩ ra y lệnh.',
  'Trả về JSON hợp lệ với các khóa: summary, clinicalConsiderations, riskFlags, recommendedNextSteps, limitations, disclaimer.',
  `Trường disclaimer phải là: "${CLINICAL_AI_DISCLAIMER}"`,
].join('\n');

type AiProviderResponse = {
  parsed?: Record<string, any>;
  text: string;
  confidence?: number;
};

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
    const providerResponse = await this.callRegisteredAiModel(aiModel, prompt);
    const result = JSON.stringify({
      source: 'REAL_AI_MODEL',
      isMock: false,
      provider: aiModel.provider || 'other',
      modelName: aiModel.modelName,
      modelVersion: aiModel.modelVersion,
      generatedAt: new Date().toISOString(),
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
      medicalOrders: { include: { targetDepartment: true, results: { include: { performedBy: { select: { id: true, username: true, email: true, role: true } } } } }, orderBy: { orderedAt: 'desc' } },
      aiDiagnoses: { include: { aiModel: true, reviewedByDoctor: { include: { staffProfile: true } } }, orderBy: { createdAt: 'desc' } },
      finalConclusion: { include: { aiDiagnosis: { include: { aiModel: true } } } },
    } as const;
  }

  private buildPrompt(visit: any) {
    const results = visit.medicalOrders.flatMap((order) => order.results.map((result) => ({
      orderType: order.orderType,
      targetDepartment: order.targetDepartment?.name || null,
      resultSummary: result.resultSummary,
      conclusion: result.conclusion || null,
      resultData: result.resultData || null,
    })));

    return [
      `Lượt khám: ${visit.visitCode}`,
      `Bệnh nhân: ${visit.patient.fullName}, giới tính ${visit.patient.gender}, ngày sinh ${visit.patient.birthDate}`,
      `Triệu chứng ban đầu: ${visit.symptoms || 'N/A'}`,
      `Kết quả xét nghiệm/cận lâm sàng dạng JSON: ${JSON.stringify(results)}`,
      'Hãy phân tích hỗ trợ bác sĩ: tóm tắt dữ liệu, điểm cần lưu ý, cảnh báo rủi ro, hướng xử trí cần bác sĩ cân nhắc.',
      'Không đưa ra kết luận cuối cùng thay bác sĩ.',
      CLINICAL_AI_DISCLAIMER,
    ].join('\n');
  }

  private async callRegisteredAiModel(aiModel: AiModelRegistry, prompt: string): Promise<AiProviderResponse> {
    const token = this.decryptSecret(aiModel.ipHashEncrypted);
    const provider = (aiModel.provider || 'other').toLowerCase();

    if (provider === 'gemini') return this.callGemini(aiModel, token, prompt);
    if (provider === 'anthropic') return this.callAnthropic(aiModel, token, prompt);
    return this.callOpenAiCompatible(aiModel, token, prompt);
  }

  private async callOpenAiCompatible(aiModel: AiModelRegistry, token: string, prompt: string): Promise<AiProviderResponse> {
    const response = await this.postJson(aiModel.apiEndpoint!, {
      Authorization: `Bearer ${token}`,
    }, {
      model: aiModel.modelVersion,
      temperature: 0.2,
      messages: [
        { role: 'system', content: CLINICAL_AI_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    });

    const text = this.extractOpenAiCompatibleText(response);
    return this.normalizeProviderResponse(text);
  }

  private async callGemini(aiModel: AiModelRegistry, token: string, prompt: string): Promise<AiProviderResponse> {
    const endpoint = this.withGeminiApiKey(aiModel.apiEndpoint!, token);
    const response = await this.postJson(endpoint, {}, {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${CLINICAL_AI_SYSTEM_PROMPT}\n\n${prompt}` }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    });

    const text = response?.candidates?.[0]?.content?.parts?.map((part) => part.text).filter(Boolean).join('\n');
    return this.normalizeProviderResponse(text || JSON.stringify(response));
  }

  private async callAnthropic(aiModel: AiModelRegistry, token: string, prompt: string): Promise<AiProviderResponse> {
    const response = await this.postJson(aiModel.apiEndpoint!, {
      'x-api-key': token,
      'anthropic-version': '2023-06-01',
    }, {
      model: aiModel.modelVersion,
      max_tokens: 1200,
      temperature: 0.2,
      system: CLINICAL_AI_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response?.content?.map((item) => item.text).filter(Boolean).join('\n');
    return this.normalizeProviderResponse(text || JSON.stringify(response));
  }

  private async postJson(endpoint: string, headers: Record<string, string>, body: Record<string, any>) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);

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

    const [ivHex, encryptedHex] = encryptedValue.split(':');
    if (!ivHex || !encryptedHex) throw new BadRequestException('AI model secret is invalid');

    const key = Buffer.from(rawKey, 'hex');
    if (key.length !== 32) throw new BadRequestException('ENCRYPTION_KEY must be 32 bytes hex for AES-256');

    const decipher = createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString('utf8');
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
