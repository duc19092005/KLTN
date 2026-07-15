import { Injectable } from '@nestjs/common';
import { CLINICAL_AI_DISCLAIMER } from '../../domain/clinical-ai.constants';

/**
 * Builds the per-visit user prompt for clinical AI analysis. Logic copied
 * verbatim from the former ClinicalDecisionService.buildPrompt(); image bytes
 * are attached separately as multimodal input (not as URLs).
 */
@Injectable()
export class ClinicalPromptBuilder {
  isAnalyzableImage(mimeType?: string | null): boolean {
    return Boolean(mimeType && mimeType.startsWith('image/'));
  }

  build(visit: any): string {
    const results = visit.medicalOrders.flatMap((order: any) =>
      order.results.map((result: any) => ({
        orderType: order.orderType,
        targetDepartment: order.targetDepartment?.name || null,
        note: result.note || null,
        // URLs are private object-storage links and unreachable by the model, so we only
        // describe the files here; image bytes are attached separately as multimodal input.
        files:
          result.files?.map((file: any) => ({
            originalName: file.originalName,
            mimeType: file.mimeType,
            imageAttached: this.isAnalyzableImage(file.mimeType),
          })) || [],
      })),
    );

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
}
