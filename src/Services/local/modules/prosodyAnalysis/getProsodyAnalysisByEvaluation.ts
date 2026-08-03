import { ProsodyAnalysis } from '@/Models/ProsodyAnalysis/ProsodyAnalysis';
import { ProsodyAnalysisRepository } from '@/Repositories/ProsodyAnalysisRepository';
import { createLocalLazyQuery } from '@/Services/local/core';
import { PaginatedResponse } from '@/Models/Base/Pagination';

export const useLazyGetProsodyAnalysisByEvaluationQuery = createLocalLazyQuery<
  PaginatedResponse<ProsodyAnalysis>,
  number
>(async (evaluationId: number) => {
  const results = await ProsodyAnalysisRepository.getProsodyAnalysisByEvaluation(evaluationId);
  return { results, total: results.length };
});
