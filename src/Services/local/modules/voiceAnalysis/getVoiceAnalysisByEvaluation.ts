import { VoiceAnalysis } from '@/Models/VoiceAnalysis/VoiceAnalysis';
import { VoiceAnalysisRepository } from '@/Repositories/VoiceAnalysisRepository';
import { createLocalLazyQuery } from '@/Services/local/core';
import { PaginatedResponse } from '@/Models/Base/Pagination';

export const useLazyGetVoiceAnalysisByEvaluationQuery = createLocalLazyQuery<
  PaginatedResponse<VoiceAnalysis>,
  number
>(async (evaluationId: number) => {
  const results = await VoiceAnalysisRepository.getVoiceAnalysisByEvaluation(evaluationId);
  return { results, total: results.length };
});
