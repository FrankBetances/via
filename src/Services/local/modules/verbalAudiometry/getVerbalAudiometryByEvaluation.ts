import { VerbalAudiometryTest } from '@/Models/VerbalAudiometry/VerbalAudiometryTest';
import { VerbalAudiometryRepository } from '@/Repositories/VerbalAudiometryRepository';
import { createLocalLazyQuery } from '@/Services/local/core';
import { PaginatedResponse } from '@/Models/Base/Pagination';

export const useLazyGetVerbalAudiometryByEvaluationQuery = createLocalLazyQuery<
  PaginatedResponse<VerbalAudiometryTest>,
  number
>(async (evaluationId: number) => {
  const results = await VerbalAudiometryRepository.getVerbalAudiometryByEvaluation(evaluationId);
  return { results, total: results.length };
});
