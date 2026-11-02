import { AudiometryNoResponse, AudiometryThresholds } from '@/Models/Audiometry/AudiometryTest';
import { getUiLang } from '@/I18n/uiLang';
import { renderAudiometryInterpretation } from '@/PDF/nlgReportEngine';
import {
  AUDIO_FREQS,
  PTA_BAND_MILD_MAX,
  PTA_BAND_MODERATE_MAX,
  PTA_BAND_SEVERE_MAX,
  PTA_REF_MAX,
} from '@/PDF/nlgThresholds';

/* -------------------------------------------------------------------------- */
/*  Lógica clínica de audiometría tonal (fuente única para ambas pantallas).   */
/* -------------------------------------------------------------------------- */

export const FREQS = AUDIO_FREQS;
export type Freq = (typeof FREQS)[number];
export const DB_STEPS = [20, 30, 40, 50, 60, 70, 80] as const;

/** Etiqueta corta de frecuencia/canal para chips y leyendas (compartida por ambas pantallas). */
export const FREQ_LABEL: Record<string, string> = {
  '500': '500',
  '1000': '1k',
  '2000': '2k',
  '4000': '4k',
  amb: 'Amb',
  tren: 'Tren',
};

export const emptyThresholds = (): AudiometryThresholds => ({
  OD: { 500: null, 1000: null, 2000: null, 4000: null },
  OI: { 500: null, 1000: null, 2000: null, 4000: null },
});

/** Umbrales vacíos para el cribado en campo libre (canal binaural `CL`). */
export const emptySoundfieldThresholds = (): AudiometryThresholds => ({
  ...emptyThresholds(),
  CL: { 500: null, 1000: null, 2000: null, 4000: null },
});

export const cloneThresholds = (t: AudiometryThresholds): AudiometryThresholds => ({
  OD: { ...t.OD },
  OI: { ...t.OI },
  ...(t.CL ? { CL: { ...t.CL } } : {}),
});

/** ¿La prueba se realizó en campo libre (sin discriminación de oído)? */
export const isSoundfield = (t: AudiometryThresholds): boolean => !!t.CL;

/** PTA = media de 500·1000·2000·4000 Hz (umbrales determinados). */
export const pta = (ear: Record<number, number | null>): number | null => {
  const vals = FREQS.map(f => ear[f]).filter((v): v is number => v !== null);
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
};

export interface Severity {
  key: 'normal' | 'mild' | 'moderate' | 'severe' | 'profound';
  label: string;
  color: string; // hex
  token: string; // token Gluestack
}

/**
 * Banda del PTA. Cortes del plan (BIAP 02/1 bis, `nlgThresholds.ts`), los
 * mismos que redacta el informe. La etiqueta de la banda de referencia no
 * dice «normal»: el producto no clasifica al niño (README, «¿Qué NO hace?»).
 */
export const severityOf = (value: number | null): Severity | null => {
  if (value === null) return null;
  if (value <= PTA_REF_MAX) {
    return { key: 'normal', label: 'Rango de referencia (≤ 20 dB HL)', color: '#2A7948', token: '$success600' };
  }
  if (value <= PTA_BAND_MILD_MAX) return { key: 'mild', label: 'Pérdida leve', color: '#C99A3A', token: '$warning600' };
  if (value <= PTA_BAND_MODERATE_MAX) {
    return { key: 'moderate', label: 'Pérdida moderada', color: '#C2742E', token: '$warning700' };
  }
  if (value <= PTA_BAND_SEVERE_MAX) return { key: 'severe', label: 'Pérdida severa', color: '#C2554E', token: '$error500' };
  return { key: 'profound', label: 'Pérdida profunda', color: '#9B2C2C', token: '$error700' };
};

/** Bandas de severidad para pintar el fondo del audiograma (mismos cortes). */
export const SEVERITY_BANDS = [
  { from: -10, to: PTA_REF_MAX, color: '#EAF7EF', label: 'REFERENCIA' },
  { from: PTA_REF_MAX, to: PTA_BAND_MILD_MAX, color: '#FBF4E3', label: 'LEVE' },
  { from: PTA_BAND_MILD_MAX, to: PTA_BAND_MODERATE_MAX, color: '#FBEDDD', label: 'MODERADA' },
  { from: PTA_BAND_MODERATE_MAX, to: PTA_BAND_SEVERE_MAX, color: '#FBE6E2', label: 'SEVERA' },
];

/**
 * ¿Se recomienda derivar a un centro especializado? En campo libre el cribado
 * solo aproxima la audición: se deriva si el PTA supera 20 dB HL o si alguna
 * frecuencia quedó sin umbral (sin respuesta al nivel máximo de la prueba).
 */
export const soundfieldNeedsReferral = (cl: Record<number, number | null>): boolean => {
  const p = pta(cl);
  if (p === null || p > PTA_REF_MAX) return true;
  return FREQS.some(f => cl[f] === null || cl[f]! > PTA_REF_MAX);
};

export const interpretAudiometry = (
  thresholds: AudiometryThresholds,
  noResponseAtMax: AudiometryNoResponse | null = null,
): string => renderAudiometryInterpretation(thresholds, getUiLang(), noResponseAtMax);
