/* -------------------------------------------------------------------------- */
/*  Lógica clínica pura del cribado de autismo (sin dependencias de UI/DB)     */
/* -------------------------------------------------------------------------- */
/*  La persistencia vive en la entidad `Screening` + `ScreeningRepository` +   */
/*  el módulo de servicio `screenings`. Aquí solo está el cálculo del riesgo,  */
/*  reutilizable por la pantalla, el archivo de evaluaciones y el PDF.         */
/* -------------------------------------------------------------------------- */

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
  return score >= 8 ? 'high' : score >= 3 ? 'med' : 'low';
};

export const rangeLabelFromScore = (score: number, allAnswered: boolean): string => {
  if (!allAnswered) return 'Incompleto';
  return score >= 8 ? 'Alto (8–20)' : score >= 3 ? 'Medio (3–7)' : 'Bajo (0–2)';
};
