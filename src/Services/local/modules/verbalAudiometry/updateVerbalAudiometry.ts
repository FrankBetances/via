import { VerbalAudiometryTest } from '@/Models/VerbalAudiometry/VerbalAudiometryTest';
import { VerbalAudiometryRepository } from '@/Repositories/VerbalAudiometryRepository';
import { createLocalMutation } from '../../core';

export const useUpdateVerbalAudiometryMutation = createLocalMutation<VerbalAudiometryTest, VerbalAudiometryTest>(
  async (item: VerbalAudiometryTest) => VerbalAudiometryRepository.updateVerbalAudiometry(item),
);
