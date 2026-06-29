import { ArticulationTest } from '@/Models/ArticulationTest/ArticulationTest';
import { ArticulationTestRepository } from '@/Repositories/ArticulationTestRepository';
import { createLocalLazyQuery } from '@/Services/local/core';
import { PaginatedResponse } from '@/Models/Base/Pagination';

export const useLazyGetArticulationByEvaluationQuery = createLocalLazyQuery<
  PaginatedResponse<ArticulationTest>,
  number
>(async (evaluationId: number) => {
  const results = await ArticulationTestRepository.getArticulationByEvaluation(evaluationId);
  return {
    results,
    total: results.length,
  };
});
