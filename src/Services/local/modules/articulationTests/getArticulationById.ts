import { ArticulationTest } from '@/Models/ArticulationTest/ArticulationTest';
import { ArticulationTestRepository } from '@/Repositories/ArticulationTestRepository';
import { createLocalQuery, createLocalLazyQuery } from '@/Services/local/core';

export const useGetArticulationByIdQuery = createLocalQuery<ArticulationTest | null, number>(
  async (id: number) => {
    return await ArticulationTestRepository.getArticulationById(id);
  },
);

export const useLazyGetArticulationByIdQuery = createLocalLazyQuery<ArticulationTest | null, number>(
  async (id: number) => {
    return await ArticulationTestRepository.getArticulationById(id);
  },
);
