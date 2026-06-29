import { AudiometryTest } from '@/Models/Audiometry/AudiometryTest';
import { AudiometryRepository } from '@/Repositories/AudiometryRepository';
import { createLocalMutation } from '../../core';

export const useUpdateAudiometryMutation = createLocalMutation<AudiometryTest, AudiometryTest>(
  async (item: AudiometryTest) => AudiometryRepository.updateAudiometry(item),
);
