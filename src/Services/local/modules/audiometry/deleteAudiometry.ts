import { AudiometryRepository } from '@/Repositories/AudiometryRepository';
import { createLocalMutation } from '../../core';

export const useDeleteAudiometryMutation = createLocalMutation<void, number>(
  async (id: number) => AudiometryRepository.deleteAudiometry(id),
);
