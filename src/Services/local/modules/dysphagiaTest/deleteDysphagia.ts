import { DysphagiaTestRepository } from '@/Repositories/DysphagiaTestRepository';
import { createLocalMutation } from '../../core';

export const useDeleteDysphagiaMutation = createLocalMutation<void, number>(
  async (id: number) => DysphagiaTestRepository.deleteDysphagia(id),
);
