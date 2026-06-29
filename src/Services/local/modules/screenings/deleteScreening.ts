// Servicio local (RTK-like) del módulo: Cribado por cuestionario (autismo/TEA por columna instrument).
// Nombres EXACTOS del Contrato de Compilación v3. Patrón = VoiceAnalysis.
import { ScreeningRepository } from '@/Repositories/ScreeningRepository';
import { createLocalMutation } from '@/Services/local/core';

export const useDeleteScreeningMutation = createLocalMutation<void, number>(
  async (id: number) => ScreeningRepository.deleteScreening(id),
);
