import { AudiometryTest } from '@/Models/Audiometry/AudiometryTest';
import { AudiometryRepository } from '@/Repositories/AudiometryRepository';
import { createLocalLazyQuery } from '@/Services/local/core';
import { PaginatedResponse } from '@/Models/Base/Pagination';

export const useLazyGetAudiometryByEvaluationQuery = createLocalLazyQuery<
  PaginatedResponse<AudiometryTest>,
  number
>(async (evaluationId: number) => {
  const results = await AudiometryRepository.getAudiometryByEvaluation(evaluationId);
  return { results, total: results.length };
});
