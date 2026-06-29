import { ClinicalAssessment } from '@/Models/ClinicalAssessment/ClinicalAssessment';
import { ClinicalAssessmentRepository } from '@/Repositories/ClinicalAssessmentRepository';
import { createLocalMutation } from '@/Services/local/core';

export const useUpdateClinicalAssessmentMutation = createLocalMutation<ClinicalAssessment, ClinicalAssessment>(
  async (assessment: ClinicalAssessment) => {
    return await ClinicalAssessmentRepository.updateClinicalAssessment(assessment);
  },
);
