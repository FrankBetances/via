import { ExecutiveFunctionsTest } from '@/Models/ExecutiveFunctions/ExecutiveFunctionsTest';
import { ExecutiveFunctionsRepository } from '@/Repositories/ExecutiveFunctionsRepository';
import { createLocalMutation } from '../../core';

export const useUpdateExecutiveFunctionsMutation = createLocalMutation<ExecutiveFunctionsTest, ExecutiveFunctionsTest>(
  async (item: ExecutiveFunctionsTest) => ExecutiveFunctionsRepository.updateExecutiveFunctions(item),
);
