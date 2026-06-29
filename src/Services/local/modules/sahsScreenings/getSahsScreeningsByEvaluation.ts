import { SahsScreening } from '@/Models/SahsScreening/SahsScreening';
import { SahsScreeningRepository } from '@/Repositories/SahsScreeningRepository';
import { createLocalLazyQuery } from '@/Services/local/core';
import { PaginatedResponse } from '@/Models/Base/Pagination';

export const useLazyGetSahsScreeningsByEvaluationQuery = createLocalLazyQuery<
  PaginatedResponse<SahsScreening>,
  number
>(async (evaluationId: number) => {
  const results = await SahsScreeningRepository.getSahsScreeningsByEvaluation(evaluationId);
  return {
    results,
    total: results.length,
  };
});
