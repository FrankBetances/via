/* -------------------------------------------------------------------------- */
/*  Lógica clínica pura del cribado de autismo (sin dependencias de UI/DB)     */
/* -------------------------------------------------------------------------- */
/*  La persistencia vive en la entidad `Screening` + `ScreeningRepository` +   */
/*  el módulo de servicio `screenings`. Aquí solo está el cálculo del riesgo,  */
/*  reutilizable por la pantalla, el archivo de evaluaciones y el PDF.         */
/* -------------------------------------------------------------------------- */

import { MCHAT_FOLLOW, MCHAT_REFER } from '@/PDF/nlgThresholds';

export type AutismRiskLevel = 'low' | 'med' | 'high';

export type ScreeningAnswers = Record<number, boolean | null>;

export interface AutismFlaggedItem {
  code: string;
  label: string;
  answer: 'Sí' | 'No';
}

// Ítems cuya respuesta de riesgo es «Sí» (resto: riesgo = «No»).
export const INVERSE_ITEMS: Record<number, true> = { 2: true, 5: true, 12: true };

export const isRiskAns = (id: number, v: boolean | null): boolean => {
  if (v === null || v === undefined) return false;
  return INVERSE_ITEMS[id] ? v === true : v === false;
};

export const levelFromScore = (score: number, allAnswered: boolean): AutismRiskLevel | 'inc' => {
  if (!allAnswered) return 'inc';
  return score >= MCHAT_REFER ? 'high' : score >= MCHAT_FOLLOW ? 'med' : 'low';
};

export const rangeLabelFromScore = (score: number, allAnswered: boolean): string => {
  if (!allAnswered) return 'Incompleto';
  if (score >= MCHAT_REFER) return `Alto (${MCHAT_REFER}–20)`;
  if (score >= MCHAT_FOLLOW) return `Medio (${MCHAT_FOLLOW}–${MCHAT_REFER - 1})`;
  return `Bajo (0–${MCHAT_FOLLOW - 1})`;
};
