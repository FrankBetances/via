import { VerbalAudiometryRepository } from '@/Repositories/VerbalAudiometryRepository';
import { createLocalMutation } from '../../core';

export const useDeleteVerbalAudiometryMutation = createLocalMutation<void, number>(
  async (id: number) => VerbalAudiometryRepository.deleteVerbalAudiometry(id),
);
