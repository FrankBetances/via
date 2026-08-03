import { ProsodyAnalysisRepository } from '@/Repositories/ProsodyAnalysisRepository';
import { createLocalMutation } from '../../core';

export const useDeleteProsodyAnalysisMutation = createLocalMutation<void, number>(
  async (id: number) => ProsodyAnalysisRepository.deleteProsodyAnalysis(id),
);
