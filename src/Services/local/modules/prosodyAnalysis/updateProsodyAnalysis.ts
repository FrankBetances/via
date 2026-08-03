import { ProsodyAnalysis } from '@/Models/ProsodyAnalysis/ProsodyAnalysis';
import { ProsodyAnalysisRepository } from '@/Repositories/ProsodyAnalysisRepository';
import { createLocalMutation } from '../../core';

export const useUpdateProsodyAnalysisMutation = createLocalMutation<ProsodyAnalysis, ProsodyAnalysis>(
  async (item: ProsodyAnalysis) => ProsodyAnalysisRepository.updateProsodyAnalysis(item),
);
