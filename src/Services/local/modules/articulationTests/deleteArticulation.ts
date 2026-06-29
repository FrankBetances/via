import { ArticulationTestRepository } from '@/Repositories/ArticulationTestRepository';
import { createLocalMutation } from '../../core';

export const useDeleteArticulationMutation = createLocalMutation<void, number>(
  async (id: number) => {
    return await ArticulationTestRepository.deleteArticulation(id);
  },
);
