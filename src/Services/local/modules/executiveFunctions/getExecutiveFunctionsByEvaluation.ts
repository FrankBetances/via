import { ExecutiveFunctionsTest } from '@/Models/ExecutiveFunctions/ExecutiveFunctionsTest';
import { ExecutiveFunctionsRepository } from '@/Repositories/ExecutiveFunctionsRepository';
import { createLocalLazyQuery } from '@/Services/local/core';
import { PaginatedResponse } from '@/Models/Base/Pagination';

export const useLazyGetExecutiveFunctionsByEvaluationQuery = createLocalLazyQuery<
  PaginatedResponse<ExecutiveFunctionsTest>,
  number
>(async (evaluationId: number) => {
  const results = await ExecutiveFunctionsRepository.getExecutiveFunctionsByEvaluation(evaluationId);
  return { results, total: results.length };
});
