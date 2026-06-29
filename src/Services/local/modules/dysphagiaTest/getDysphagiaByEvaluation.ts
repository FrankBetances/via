import { DysphagiaTest } from '@/Models/DysphagiaTest/DysphagiaTest';
import { DysphagiaTestRepository } from '@/Repositories/DysphagiaTestRepository';
import { createLocalLazyQuery } from '@/Services/local/core';
import { PaginatedResponse } from '@/Models/Base/Pagination';

export const useLazyGetDysphagiaByEvaluationQuery = createLocalLazyQuery<
  PaginatedResponse<DysphagiaTest>,
  number
>(async (evaluationId: number) => {
  const results = await DysphagiaTestRepository.getDysphagiaByEvaluation(evaluationId);
  return { results, total: results.length };
});
