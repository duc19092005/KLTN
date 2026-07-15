import api from '../../../shared/apis/api';

export const clinicalDecisionService = {
  getVisitResults: (visitId) => api.get(`/clinical-decisions/visits/${visitId}/results`),
  generateAiAnalysis: (payload) => api.post('/clinical-decisions/ai-analysis', payload),
  reviewAiDiagnosis: (id, payload) => api.patch(`/clinical-decisions/ai-diagnoses/${id}/review`, payload),
  createConclusion: (payload, stepUpTicket) =>
    api.post('/clinical-decisions/conclusions', payload, stepUpTicket ? { headers: { 'x-stepup-ticket': stepUpTicket } } : undefined),
};
