import { VerbalAudiometryTest } from '@/Models/VerbalAudiometry/VerbalAudiometryTest';
import { VerbalAudiometryRepository } from '@/Repositories/VerbalAudiometryRepository';
import { createLocalMutation } from '../../core';

export const useCreateVerbalAudiometryMutation = createLocalMutation<VerbalAudiometryTest, VerbalAudiometryTest>(
  async (item: VerbalAudiometryTest) => VerbalAudiometryRepository.createVerbalAudiometry(item),
);
