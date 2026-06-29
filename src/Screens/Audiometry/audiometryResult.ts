import { AudiometryThresholds } from '@/Models/Audiometry/AudiometryTest';

/* -------------------------------------------------------------------------- */
/*  Lógica clínica de audiometría tonal (fuente única para ambas pantallas).   */
/* -------------------------------------------------------------------------- */

export const FREQS = [500, 1000, 2000, 4000] as const;
export type Freq = (typeof FREQS)[number];
export const DB_STEPS = [20, 30, 40, 50, 60, 70, 80] as const;

/** Etiqueta corta de frecuencia/canal para chips y leyendas (compartida por ambas pantallas). */
export const FREQ_LABEL: Record<string, string> = {
  '500': '500',
  '1000': '1k',
  '2000': '2k',
  '4000': '4k',
  amb: 'Amb',
  pol: 'Pol',
};

export const emptyThresholds = (): AudiometryThresholds => ({
  OD: { 500: null, 1000: null, 2000: null, 4000: null },
  OI: { 500: null, 1000: null, 2000: null, 4000: null },
});

export const cloneThresholds = (t: AudiometryThresholds): AudiometryThresholds => ({
  OD: { ...t.OD },
  OI: { ...t.OI },
});

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

export const severityOf = (value: number | null): Severity | null => {
  if (value === null) return null;
  if (value <= 20) return { key: 'normal', label: 'Audición normal', color: '#2A7948', token: '$success600' };
  if (value <= 40) return { key: 'mild', label: 'Pérdida leve', color: '#C99A3A', token: '$warning600' };
  if (value <= 60) return { key: 'moderate', label: 'Pérdida moderada', color: '#C2742E', token: '$warning700' };
  if (value <= 80) return { key: 'severe', label: 'Pérdida severa', color: '#C2554E', token: '$error500' };
  return { key: 'profound', label: 'Pérdida profunda', color: '#9B2C2C', token: '$error700' };
};

/** Bandas de severidad para pintar el fondo del audiograma. */
export const SEVERITY_BANDS = [
  { from: -10, to: 20, color: '#EAF7EF', label: 'NORMAL' },
  { from: 20, to: 40, color: '#FBF4E3', label: 'LEVE' },
  { from: 40, to: 60, color: '#FBEDDD', label: 'MODERADA' },
  { from: 60, to: 90, color: '#FBE6E2', label: 'SEVERA' },
];

export const interpretAudiometry = (thresholds: AudiometryThresholds): string => {
  const od = pta(thresholds.OD);
  const oi = pta(thresholds.OI);
  const parts: string[] = [];
  const describe = (label: string, v: number | null) => {
    const s = severityOf(v);
    if (v === null) parts.push(`${label}: sin datos suficientes`);
    else parts.push(`${label}: PTA ${v} dB HL (${s?.label.toLowerCase()})`);
  };
  describe('OD', od);
  describe('OI', oi);
  return parts.join(' · ') + '.';
};
