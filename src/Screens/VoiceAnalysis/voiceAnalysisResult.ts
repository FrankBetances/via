import { GrbasScores, VoiceFormants, VoiceParamStatus } from '@/Models/VoiceAnalysis/VoiceAnalysis';

/* -------------------------------------------------------------------------- */
/*  Lógica clínica del análisis acústico de voz (fuente única de verdad).      */
/*  Rangos normativos orientativos para voz infantil (vocal /a/ sostenida).    */
/*  Ajuste los umbrales a su protocolo/normativa de referencia si procede.     */
/* -------------------------------------------------------------------------- */

export const VOICE_NORMS = {
  f0: { min: 200, max: 320 }, // Hz (infantil)
  jitter: { max: 1.0 }, // %
  shimmer: { max: 3.0 }, // %
  hnr: { min: 20 }, // dB
};

export interface VoiceParams {
  f0: number;
  jitter: number;
  shimmer: number;
  hnr: number;
  /** null = F1–F3 no estimables en la toma. */
  formants: VoiceFormants | null;
}

export const statusF0 = (f0: number): VoiceParamStatus =>
  f0 >= VOICE_NORMS.f0.min && f0 <= VOICE_NORMS.f0.max ? 'normal' : 'borderline';

export const statusJitter = (j: number): VoiceParamStatus =>
  j <= VOICE_NORMS.jitter.max ? 'normal' : j <= VOICE_NORMS.jitter.max * 1.5 ? 'borderline' : 'altered';

export const statusShimmer = (s: number): VoiceParamStatus =>
  s <= VOICE_NORMS.shimmer.max ? 'normal' : s <= VOICE_NORMS.shimmer.max * 1.5 ? 'borderline' : 'altered';

export const statusHnr = (h: number): VoiceParamStatus =>
  h >= VOICE_NORMS.hnr.min ? 'normal' : h >= VOICE_NORMS.hnr.min - 5 ? 'borderline' : 'altered';

/** Color token Gluestack por estado, para reutilizar en UI. */
export const statusColor = (st: VoiceParamStatus): string =>
  st === 'normal' ? '$success600' : st === 'borderline' ? '$warning600' : '$error500';

export const statusLabel = (st: VoiceParamStatus): string =>
  st === 'normal' ? 'Normal' : st === 'borderline' ? 'Límite' : 'Alterado';

/** Nº de parámetros alterados (excluye normal). */
export const alteredCount = (p: VoiceParams): number =>
  [statusF0(p.f0), statusJitter(p.jitter), statusShimmer(p.shimmer), statusHnr(p.hnr)].filter(
    s => s !== 'normal',
  ).length;

/* ------------------------------ escala GRBAS ------------------------------ */

export interface GrbasDimension {
  key: keyof GrbasScores;
  letter: string;
  label: string;
  description: string;
}

/** Dimensiones de la escala GRBAS (Hirano, 1981), puntuadas 0–3. */
export const GRBAS_DIMENSIONS: GrbasDimension[] = [
  { key: 'g', letter: 'G', label: 'Grado', description: 'Severidad global de la disfonía' },
  { key: 'r', letter: 'R', label: 'Aspereza', description: 'Irregularidad de la vibración glótica' },
  { key: 'b', letter: 'B', label: 'Soplo', description: 'Escape de aire audible' },
  { key: 'a', letter: 'A', label: 'Astenia', description: 'Debilidad o falta de energía vocal' },
  { key: 's', letter: 'S', label: 'Tensión', description: 'Hiperfunción o esfuerzo fonatorio' },
];

export const GRBAS_SCORE_LABELS = ['Normal', 'Leve', 'Moderado', 'Severo'];

export const grbasTotal = (g: GrbasScores): number => g.g + g.r + g.b + g.a + g.s;

/** Resumen corto tipo «G1 R0 B1 A0 S1 · total 3/15». */
export const grbasSummary = (g: GrbasScores): string =>
  `G${g.g} R${g.r} B${g.b} A${g.a} S${g.s} · total ${grbasTotal(g)}/15`;

/** Interpretación del grado global G (dimensión rectora de la escala). */
export const grbasSeverityLabel = (g: GrbasScores): string => {
  const grade = Math.min(3, Math.max(0, g.g));
  return grade === 0
    ? 'Voz perceptualmente normal'
    : `Disfonía ${GRBAS_SCORE_LABELS[grade].toLowerCase()}`;
};

/** Texto de interpretación clínica automática. */
export const buildInterpretation = (p: VoiceParams): string => {
  const flags: string[] = [];
  if (statusF0(p.f0) !== 'normal') flags.push('F0 fuera del rango infantil esperado');
  if (statusJitter(p.jitter) !== 'normal') flags.push('jitter elevado (inestabilidad de frecuencia)');
  if (statusShimmer(p.shimmer) !== 'normal') flags.push('shimmer elevado (inestabilidad de amplitud)');
  if (statusHnr(p.hnr) !== 'normal') flags.push('HNR reducido (mayor componente de ruido)');

  const formantNote =
    p.formants === null
      ? ' Los formantes F1–F3 no pudieron estimarse en esta toma.'
      : '';

  if (flags.length === 0) {
    return `Parámetros acústicos dentro de los rangos normativos para voz infantil. Calidad vocal sin signos de perturbación significativa.${formantNote}`;
  }
  return `Se observa: ${flags.join('; ')}. Considere valoración perceptual (GRBAS) y seguimiento de la calidad vocal.${formantNote}`;
};
