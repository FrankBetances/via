import { SahsScreeningRepository } from '@/Repositories/SahsScreeningRepository';
import { createLocalMutation } from '../../core';

export const useDeleteSahsScreeningMutation = createLocalMutation<void, number>(async (id: number) => {
  return await SahsScreeningRepository.deleteSahsScreening(id);
});
