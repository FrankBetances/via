// Servicio local (RTK-like) del módulo: Cribado por cuestionario (autismo/TEA por columna instrument).
// Nombres EXACTOS del Contrato de Compilación v3. Patrón = VoiceAnalysis.
import { Screening } from '@/Models/Screening/Screening';
import { ScreeningRepository } from '@/Repositories/ScreeningRepository';
import { createLocalQuery, createLocalLazyQuery } from '@/Services/local/core';

export const useGetScreeningByIdQuery = createLocalQuery<Screening | null, number>(
  async (id: number) => ScreeningRepository.getScreeningById(id),
);

export const useLazyGetScreeningByIdQuery = createLocalLazyQuery<Screening | null, number>(
  async (id: number) => ScreeningRepository.getScreeningById(id),
);
