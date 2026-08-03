import { ProsodyAnalysis } from '@/Models/ProsodyAnalysis/ProsodyAnalysis';
import { ProsodyAnalysisRepository } from '@/Repositories/ProsodyAnalysisRepository';
import { createLocalQuery, createLocalLazyQuery } from '@/Services/local/core';

export const useGetProsodyAnalysisByIdQuery = createLocalQuery<ProsodyAnalysis | null, number>(
  async (id: number) => ProsodyAnalysisRepository.getProsodyAnalysisById(id),
);

export const useLazyGetProsodyAnalysisByIdQuery = createLocalLazyQuery<ProsodyAnalysis | null, number>(
  async (id: number) => ProsodyAnalysisRepository.getProsodyAnalysisById(id),
);
