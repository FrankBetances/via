import { SahsScreening } from '@/Models/SahsScreening/SahsScreening';
import { SahsScreeningRepository } from '@/Repositories/SahsScreeningRepository';
import { createLocalMutation } from '../../core';

export const useUpdateSahsScreeningMutation = createLocalMutation<SahsScreening, SahsScreening>(
  async (screening: SahsScreening) => {
    return await SahsScreeningRepository.updateSahsScreening(screening);
  },
);
