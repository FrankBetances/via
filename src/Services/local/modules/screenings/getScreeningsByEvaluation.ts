// Servicio local (RTK-like) del módulo: Cribado por cuestionario (autismo/TEA por columna instrument).
// Nombres EXACTOS del Contrato de Compilación v3. Patrón = VoiceAnalysis.
import { Screening } from '@/Models/Screening/Screening';
import { ScreeningRepository } from '@/Repositories/ScreeningRepository';
import { createLocalLazyQuery } from '@/Services/local/core';
import { PaginatedResponse } from '@/Models/Base/Pagination';

export const useLazyGetScreeningsByEvaluationQuery = createLocalLazyQuery<
  PaginatedResponse<Screening>,
  number
>(async (evaluationId: number) => {
  const results = await ScreeningRepository.getScreeningsByEvaluation(evaluationId);
  return { results, total: results.length };
});
