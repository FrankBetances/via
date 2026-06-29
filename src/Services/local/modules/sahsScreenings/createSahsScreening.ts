import { SahsScreening } from '@/Models/SahsScreening/SahsScreening';
import { SahsScreeningRepository } from '@/Repositories/SahsScreeningRepository';
import { createLocalMutation } from '../../core';

export const useCreateSahsScreeningMutation = createLocalMutation<SahsScreening, SahsScreening>(
  async (screening: SahsScreening) => {
    return await SahsScreeningRepository.createSahsScreening(screening);
  },
);
