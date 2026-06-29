import { AudiometryTest } from '@/Models/Audiometry/AudiometryTest';
import { AudiometryRepository } from '@/Repositories/AudiometryRepository';
import { createLocalMutation } from '../../core';

export const useCreateAudiometryMutation = createLocalMutation<AudiometryTest, AudiometryTest>(
  async (item: AudiometryTest) => AudiometryRepository.createAudiometry(item),
);
