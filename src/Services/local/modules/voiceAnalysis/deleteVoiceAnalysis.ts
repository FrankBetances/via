import { VoiceAnalysisRepository } from '@/Repositories/VoiceAnalysisRepository';
import { createLocalMutation } from '../../core';

export const useDeleteVoiceAnalysisMutation = createLocalMutation<void, number>(
  async (id: number) => VoiceAnalysisRepository.deleteVoiceAnalysis(id),
);
