import { VerbalAudiometryTest } from '@/Models/VerbalAudiometry/VerbalAudiometryTest';
import { VerbalAudiometryRepository } from '@/Repositories/VerbalAudiometryRepository';
import { createLocalQuery, createLocalLazyQuery } from '@/Services/local/core';

export const useGetVerbalAudiometryByIdQuery = createLocalQuery<VerbalAudiometryTest | null, number>(
  async (id: number) => VerbalAudiometryRepository.getVerbalAudiometryById(id),
);

export const useLazyGetVerbalAudiometryByIdQuery = createLocalLazyQuery<VerbalAudiometryTest | null, number>(
  async (id: number) => VerbalAudiometryRepository.getVerbalAudiometryById(id),
);
