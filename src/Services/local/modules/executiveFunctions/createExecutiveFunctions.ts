import { ExecutiveFunctionsTest } from '@/Models/ExecutiveFunctions/ExecutiveFunctionsTest';
import { ExecutiveFunctionsRepository } from '@/Repositories/ExecutiveFunctionsRepository';
import { createLocalMutation } from '../../core';

export const useCreateExecutiveFunctionsMutation = createLocalMutation<ExecutiveFunctionsTest, ExecutiveFunctionsTest>(
  async (item: ExecutiveFunctionsTest) => ExecutiveFunctionsRepository.createExecutiveFunctions(item),
);
