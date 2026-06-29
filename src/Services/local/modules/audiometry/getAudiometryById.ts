import { AudiometryTest } from '@/Models/Audiometry/AudiometryTest';
import { AudiometryRepository } from '@/Repositories/AudiometryRepository';
import { createLocalQuery, createLocalLazyQuery } from '@/Services/local/core';

export const useGetAudiometryByIdQuery = createLocalQuery<AudiometryTest | null, number>(
  async (id: number) => AudiometryRepository.getAudiometryById(id),
);

export const useLazyGetAudiometryByIdQuery = createLocalLazyQuery<AudiometryTest | null, number>(
  async (id: number) => AudiometryRepository.getAudiometryById(id),
);
