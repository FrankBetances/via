import { VoiceAnalysis } from '@/Models/VoiceAnalysis/VoiceAnalysis';
import { VoiceAnalysisRepository } from '@/Repositories/VoiceAnalysisRepository';
import { createLocalMutation } from '../../core';

export const useUpdateVoiceAnalysisMutation = createLocalMutation<VoiceAnalysis, VoiceAnalysis>(
  async (item: VoiceAnalysis) => VoiceAnalysisRepository.updateVoiceAnalysis(item),
);
