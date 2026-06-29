import { VoiceFormants, VoiceParamStatus } from '@/Models/VoiceAnalysis/VoiceAnalysis';

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
  formants: VoiceFormants;
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

/** Texto de interpretación clínica automática. */
export const buildInterpretation = (p: VoiceParams): string => {
  const flags: string[] = [];
  if (statusF0(p.f0) !== 'normal') flags.push('F0 fuera del rango infantil esperado');
  if (statusJitter(p.jitter) !== 'normal') flags.push('jitter elevado (inestabilidad de frecuencia)');
  if (statusShimmer(p.shimmer) !== 'normal') flags.push('shimmer elevado (inestabilidad de amplitud)');
  if (statusHnr(p.hnr) !== 'normal') flags.push('HNR reducido (mayor componente de ruido)');

  if (flags.length === 0) {
    return 'Parámetros acústicos dentro de los rangos normativos para voz infantil. Calidad vocal sin signos de perturbación significativa.';
  }
  return `Se observa: ${flags.join('; ')}. Considere valoración perceptual (GRBAS) y seguimiento de la calidad vocal.`;
};
