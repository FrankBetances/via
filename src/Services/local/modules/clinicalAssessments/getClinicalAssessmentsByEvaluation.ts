import { ClinicalAssessment } from '@/Models/ClinicalAssessment/ClinicalAssessment';
import { ClinicalAssessmentRepository } from '@/Repositories/ClinicalAssessmentRepository';
import { createLocalLazyQuery } from '@/Services/local/core';
import { PaginatedResponse } from '@/Models/Base/Pagination';

export const useLazyGetClinicalAssessmentsByEvaluationQuery = createLocalLazyQuery<
  PaginatedResponse<ClinicalAssessment>,
  number
>(async (evaluationId: number) => {
  const results = await ClinicalAssessmentRepository.getClinicalAssessmentsByEvaluation(evaluationId);
  return {
    results,
    total: results.length,
  };
});
