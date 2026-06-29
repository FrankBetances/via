import { VoiceAnalysis } from '@/Models/VoiceAnalysis/VoiceAnalysis';
import { VoiceAnalysisRepository } from '@/Repositories/VoiceAnalysisRepository';
import { createLocalMutation } from '../../core';

export const useCreateVoiceAnalysisMutation = createLocalMutation<VoiceAnalysis, VoiceAnalysis>(
  async (item: VoiceAnalysis) => VoiceAnalysisRepository.createVoiceAnalysis(item),
);
