import { SahsScreening } from '@/Models/SahsScreening/SahsScreening';
import { SahsScreeningRepository } from '@/Repositories/SahsScreeningRepository';
import { createLocalQuery, createLocalLazyQuery } from '@/Services/local/core';

export const useGetSahsScreeningByIdQuery = createLocalQuery<SahsScreening | null, number>(
  async (id: number) => {
    return await SahsScreeningRepository.getSahsScreeningById(id);
  },
);

export const useLazyGetSahsScreeningByIdQuery = createLocalLazyQuery<SahsScreening | null, number>(
  async (id: number) => {
    return await SahsScreeningRepository.getSahsScreeningById(id);
  },
);
