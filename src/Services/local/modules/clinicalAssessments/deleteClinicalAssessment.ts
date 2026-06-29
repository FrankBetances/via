import { ClinicalAssessmentRepository } from '@/Repositories/ClinicalAssessmentRepository';
import { createLocalMutation } from '@/Services/local/core';

export const useDeleteClinicalAssessmentMutation = createLocalMutation<void, number>(async (id: number) => {
  return await ClinicalAssessmentRepository.deleteClinicalAssessment(id);
});
