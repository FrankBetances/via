import { VoiceAnalysis } from '@/Models/VoiceAnalysis/VoiceAnalysis';
import { VoiceAnalysisRepository } from '@/Repositories/VoiceAnalysisRepository';
import { createLocalQuery, createLocalLazyQuery } from '@/Services/local/core';

export const useGetVoiceAnalysisByIdQuery = createLocalQuery<VoiceAnalysis | null, number>(
  async (id: number) => VoiceAnalysisRepository.getVoiceAnalysisById(id),
);

export const useLazyGetVoiceAnalysisByIdQuery = createLocalLazyQuery<VoiceAnalysis | null, number>(
  async (id: number) => VoiceAnalysisRepository.getVoiceAnalysisById(id),
);
