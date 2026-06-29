import { ClinicalAssessment } from '@/Models/ClinicalAssessment/ClinicalAssessment';
import { ClinicalAssessmentRepository } from '@/Repositories/ClinicalAssessmentRepository';
import { createLocalQuery, createLocalLazyQuery } from '@/Services/local/core';

export const useGetClinicalAssessmentByIdQuery = createLocalQuery<ClinicalAssessment | null, number>(async (id: number) => {
  return await ClinicalAssessmentRepository.getClinicalAssessmentById(id);
});

export const useLazyGetClinicalAssessmentByIdQuery = createLocalLazyQuery<ClinicalAssessment | null, number>(
  async (id: number) => {
    return await ClinicalAssessmentRepository.getClinicalAssessmentById(id);
  },
);
