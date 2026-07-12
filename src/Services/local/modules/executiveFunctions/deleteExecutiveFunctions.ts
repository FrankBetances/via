import { ExecutiveFunctionsRepository } from '@/Repositories/ExecutiveFunctionsRepository';
import { createLocalMutation } from '../../core';

export const useDeleteExecutiveFunctionsMutation = createLocalMutation<void, number>(
  async (id: number) => ExecutiveFunctionsRepository.deleteExecutiveFunctions(id),
);
