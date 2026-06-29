import { ArticulationTest } from '@/Models/ArticulationTest/ArticulationTest';
import { ArticulationTestRepository } from '@/Repositories/ArticulationTestRepository';
import { createLocalMutation } from '../../core';

export const useUpdateArticulationMutation = createLocalMutation<ArticulationTest, ArticulationTest>(
  async (test: ArticulationTest) => {
    return await ArticulationTestRepository.updateArticulation(test);
  },
);
