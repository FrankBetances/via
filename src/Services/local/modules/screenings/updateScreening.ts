// Servicio local (RTK-like) del módulo: Cribado por cuestionario (autismo/TEA por columna instrument).
// Nombres EXACTOS del Contrato de Compilación v3. Patrón = VoiceAnalysis.
import { Screening } from '@/Models/Screening/Screening';
import { ScreeningRepository } from '@/Repositories/ScreeningRepository';
import { createLocalMutation } from '@/Services/local/core';

export const useUpdateScreeningMutation = createLocalMutation<Screening, Screening>(
  async (item: Screening) => ScreeningRepository.updateScreening(item),
);
