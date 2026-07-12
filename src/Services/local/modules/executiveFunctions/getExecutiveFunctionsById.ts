import { ExecutiveFunctionsTest } from '@/Models/ExecutiveFunctions/ExecutiveFunctionsTest';
import { ExecutiveFunctionsRepository } from '@/Repositories/ExecutiveFunctionsRepository';
import { createLocalQuery, createLocalLazyQuery } from '@/Services/local/core';

export const useGetExecutiveFunctionsByIdQuery = createLocalQuery<ExecutiveFunctionsTest | null, number>(
  async (id: number) => ExecutiveFunctionsRepository.getExecutiveFunctionsById(id),
);

export const useLazyGetExecutiveFunctionsByIdQuery = createLocalLazyQuery<ExecutiveFunctionsTest | null, number>(
  async (id: number) => ExecutiveFunctionsRepository.getExecutiveFunctionsById(id),
);
