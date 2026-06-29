import { DysphagiaTest } from '@/Models/DysphagiaTest/DysphagiaTest';
import { DysphagiaTestRepository } from '@/Repositories/DysphagiaTestRepository';
import { createLocalMutation } from '../../core';

export const useUpdateDysphagiaMutation = createLocalMutation<DysphagiaTest, DysphagiaTest>(
  async (item: DysphagiaTest) => DysphagiaTestRepository.updateDysphagia(item),
);
