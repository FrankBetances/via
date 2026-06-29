import { ArticulationTest } from '@/Models/ArticulationTest/ArticulationTest';
import { ArticulationTestRepository } from '@/Repositories/ArticulationTestRepository';
import { createLocalMutation } from '../../core';

export const useCreateArticulationMutation = createLocalMutation<ArticulationTest, ArticulationTest>(
  async (test: ArticulationTest) => {
    return await ArticulationTestRepository.createArticulation(test);
  },
);
