import { DysphagiaTest } from '@/Models/DysphagiaTest/DysphagiaTest';
import { DysphagiaTestRepository } from '@/Repositories/DysphagiaTestRepository';
import { createLocalQuery, createLocalLazyQuery } from '@/Services/local/core';

export const useGetDysphagiaByIdQuery = createLocalQuery<DysphagiaTest | null, number>(
  async (id: number) => DysphagiaTestRepository.getDysphagiaById(id),
);

export const useLazyGetDysphagiaByIdQuery = createLocalLazyQuery<DysphagiaTest | null, number>(
  async (id: number) => DysphagiaTestRepository.getDysphagiaById(id),
);
