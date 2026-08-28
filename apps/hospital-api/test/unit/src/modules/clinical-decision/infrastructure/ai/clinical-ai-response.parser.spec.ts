import { ClinicalAiResponseParser } from '../../../../../../../src/modules/clinical-decision/infrastructure/ai/clinical-ai-response.parser';

describe('ClinicalAiResponseParser', () => {
  const parser = new ClinicalAiResponseParser();

  it('normalizes a valid provider JSON response and overwrites the disclaimer', () => {
    const result = parser.normalize(JSON.stringify({
      confidence: 82,
      diagnosticProbabilities: [{ condition: 'Influenza', probability: '75%' }],
      disclaimer: 'untrusted provider text',
    }));

    expect(result.confidence).toBe(0.82);
    expect(result.parsed?.disclaimer).toContain('AI chỉ hỗ trợ tham khảo');
  });

  it('extracts JSON safely from a fenced response and uses the strongest diagnosis probability', () => {
    const result = parser.normalize('```json\n{"diagnosticProbabilities":[{"probability": "45%"},{"probability": 90}]}\n```');

    expect(result.confidence).toBe(0.9);
    expect(result.parsed?.diagnosticProbabilities).toHaveLength(2);
  });

  it('preserves non-JSON provider text without manufacturing an analysis object', () => {
    const result = parser.normalize('The model returned a non-JSON response.');

    expect(result.text).toBe('The model returned a non-JSON response.');
    expect(result.parsed).toBeUndefined();
    expect(result.confidence).toBeUndefined();
  });
});