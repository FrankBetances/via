import type { VoiceFormants } from '@/Models/VoiceAnalysis/VoiceAnalysis';
import type { VoiceMicResult } from './useVoiceAnalysis';

/* -------------------------------------------------------------------------- */
/*  DSP puro del análisis acústico de voz (sin dependencias nativas).          */
/*                                                                            */
/*  Se separa del adaptador de micrófono (`voiceMicAdapter`, que sí importa el */
/*  motor `react-native-audio-api`) para poder ejercitar el análisis con       */
/*  pruebas unitarias sobre PCM sintético, sin cargar módulos nativos.         */
/*                                                                            */
/*  Sobre PCM mono a 16 kHz (el adaptador decima ×3 desde 48 kHz):             */
/*   - RMS (amplitud → shimmer aguas arriba)                                   */
/*   - F0 por autocorrelación normalizada en 100–500 Hz                        */
/*   - HNR desde el pico de autocorrelación r: 10·log10(r/(1−r))               */
/*   - Formantes F1–F3 por LPC (Levinson-Durbin) + picos de la envolvente      */
/* -------------------------------------------------------------------------- */

/** Frecuencia efectiva del PCM analizado (48 kHz decimado ×3 en el adaptador). */
export const SAMPLE_RATE = 16000;
/** Tamaño de ventana de análisis (~64 ms a 16 kHz). */
export const FRAME = 1024;

const MIN_LAG = Math.floor(SAMPLE_RATE / 500); // 500 Hz
const MAX_LAG = Math.ceil(SAMPLE_RATE / 100); // 100 Hz
/** Suelo ABSOLUTO de sonoridad: solo descarta silencio digital / ruido de fondo
 *  remoto. La puerta de voz real es la periodicidad (`MIN_PEAK`), no el nivel:
 *  la captura de micrófono en Android/iOS llega sin AGC (modo «measurement») y
 *  su RMS depende del hardware y la distancia — un umbral absoluto alto
 *  (0.015, el valor histórico) descartaba TODAS las ventanas en dispositivos
 *  de ganancia baja y el análisis siempre acababa en «captura insuficiente»
 *  aunque la toma se oyera perfectamente al reproducirla. */
const MIN_RMS = 0.004; // feedback en vivo (evita parpadeo de F0 con ruido de sala)
const SILENCE_RMS = 0.0015; // análisis de la toma (solo silencio digital)
/** Umbral RELATIVO de sonoridad de `analysePcm`: una ventana cuenta como
 *  candidata a voz si su RMS alcanza esta fracción del nivel alto (p95) de la
 *  propia toma (≈ −10 dB). Así el análisis es invariante a la ganancia del
 *  micrófono y sigue descartando los silencios entre emisiones. */
const VOICED_RMS_FRACTION = 0.3;
const MIN_PEAK = 0.45; // umbral de periodicidad
/** Un pico de autocorrelación que alcance esta fracción del máximo cuenta como
 *  candidato a periodo: así se elige el lag MÁS CORTO fuerte (F0 real) en vez del
 *  máximo global, que suele caer en un subarmónico (2·T, 3·T) — error de octava
 *  a la baja que hundía la F0 a ~100 Hz y dejaba la toma «sin datos». */
const PEAK_FRACTION = 0.8;
const LPC_ORDER = 14; // 16 kHz: order 12 no resolvía F1 en voz infantil (F1 se
// fundía con los armónicos de pitch → sin formantes → «captura insuficiente»);
// 14 (≈ fs/1000 − 2) separa F1–F3 de la vocal /a/ infantil sin sobreajustar.

/** F0 + fuerza de periodicidad de una ventana por autocorrelación normalizada.
 *  Elige el primer máximo local que supere `PEAK_FRACTION·max` (evita el salto
 *  de octava a subarmónicos) y afina el lag por interpolación parabólica.
 *  `minRms` permite a `analysePcm` pasar un umbral adaptado al nivel real de
 *  la toma (por defecto, el suelo absoluto para el feedback en vivo). */
export function analyseFrame(
  x: Float32Array,
  minRms: number = MIN_RMS,
): { f0: number; peak: number; rms: number } | null {
  let energy = 0;
  for (let i = 0; i < x.length; i++) energy += x[i] * x[i];
  const rms = Math.sqrt(energy / x.length);
  if (rms < minRms) return null;

  const maxLag = Math.min(MAX_LAG, x.length - 1);
  const r = new Float64Array(maxLag + 1);
  let bestR = 0;
  for (let lag = MIN_LAG; lag <= maxLag; lag++) {
    let num = 0;
    let den = 0;
    for (let i = 0; i < x.length - lag; i++) {
      num += x[i] * x[i + lag];
      den += x[i] * x[i] + x[i + lag] * x[i + lag];
    }
    r[lag] = den > 0 ? (2 * num) / den : 0;
    if (r[lag] > bestR) bestR = r[lag];
  }
  if (bestR < MIN_PEAK) return null;

  // Primer lag (F0 más alta) que sea máximo local y llegue al umbral relativo.
  const thr = Math.max(MIN_PEAK, PEAK_FRACTION * bestR);
  let bestLag = 0;
  for (let lag = MIN_LAG + 1; lag <= maxLag - 1; lag++) {
    if (r[lag] >= thr && r[lag] >= r[lag - 1] && r[lag] >= r[lag + 1]) {
      bestLag = lag;
      break;
    }
  }
  if (bestLag === 0) {
    // Sin máximo local interior (pico en el borde): usa el máximo global.
    for (let lag = MIN_LAG; lag <= maxLag; lag++) {
      if (r[lag] === bestR) {
        bestLag = lag;
        break;
      }
    }
  }
  if (bestLag === 0) return null;

  // Interpolación parabólica del vértice para una F0 más precisa.
  let lag = bestLag;
  if (bestLag > MIN_LAG && bestLag < maxLag) {
    const y1 = r[bestLag - 1];
    const y2 = r[bestLag];
    const y3 = r[bestLag + 1];
    const denom = y1 - 2 * y2 + y3;
    if (denom < 0) lag = bestLag + (0.5 * (y1 - y3)) / denom;
  }
  return { f0: SAMPLE_RATE / lag, peak: r[bestLag], rms };
}

/* ----------------------------- formantes (LPC) ---------------------------- */

/** Coeficientes LPC por autocorrelación + Levinson-Durbin. */
function lpcCoefficients(x: Float32Array, order: number): number[] | null {
  // Pre-énfasis + ventana de Hamming (estándar para análisis de formantes).
  const n = x.length;
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const pre = x[i] - 0.97 * (i > 0 ? x[i - 1] : 0);
    w[i] = pre * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1)));
  }

  const r = new Float64Array(order + 1);
  for (let lag = 0; lag <= order; lag++) {
    let acc = 0;
    for (let i = 0; i < n - lag; i++) acc += w[i] * w[i + lag];
    r[lag] = acc;
  }
  if (r[0] === 0) return null;

  const a = new Float64Array(order + 1);
  a[0] = 1;
  let e = r[0];
  for (let m = 1; m <= order; m++) {
    let k = -r[m];
    for (let i = 1; i < m; i++) k -= a[i] * r[m - i];
    k /= e;
    a[m] = k;
    for (let i = 1; i <= m >> 1; i++) {
      const tmp = a[i] + k * a[m - i];
      a[m - i] += k * a[i];
      a[i] = tmp;
    }
    e *= 1 - k * k;
    if (e <= 0) return null;
  }
  return Array.from(a);
}

/** Picos de la envolvente LPC 1/|A(e^jω)| evaluada en 150–4000 Hz. */
function formantsFromLpc(a: number[]): number[] {
  const STEP = 10; // Hz
  const FMIN = 150;
  const FMAX = 4000;
  const mags: number[] = [];
  const freqs: number[] = [];
  for (let f = FMIN; f <= FMAX; f += STEP) {
    const w = (2 * Math.PI * f) / SAMPLE_RATE;
    let re = 0;
    let im = 0;
    for (let k = 0; k < a.length; k++) {
      re += a[k] * Math.cos(k * w);
      im -= a[k] * Math.sin(k * w);
    }
    const mag = 1 / Math.max(1e-9, Math.hypot(re, im));
    mags.push(mag);
    freqs.push(f);
  }
  const peaks: number[] = [];
  for (let i = 1; i < mags.length - 1; i++) {
    if (mags[i] > mags[i - 1] && mags[i] >= mags[i + 1]) peaks.push(freqs[i]);
  }
  return peaks;
}

const yieldToEventLoop = () => new Promise<void>(resolve => setTimeout(resolve, 0));

function median(values: number[]): number {
  const s = [...values].sort((x, y) => x - y);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Formantes F1–F3 medianos sobre las ventanas sonoras de la emisión.
 *  Asíncrono: cede el hilo JS cada pocas ventanas (LPC es lo más caro). */
async function estimateFormants(
  pcm: Float32Array,
  voicedOffsets: number[],
): Promise<VoiceFormants | null> {
  const f1s: number[] = [];
  const f2s: number[] = [];
  const f3s: number[] = [];
  let sinceYield = 0;
  for (const off of voicedOffsets) {
    const a = lpcCoefficients(pcm.subarray(off, off + FRAME), LPC_ORDER);
    if (a) {
      const peaks = formantsFromLpc(a);
      // Asignación por rangos plausibles de la vocal /a/ infantil.
      const f1 = peaks.find(f => f >= 300 && f <= 1200);
      const f2 = peaks.find(f => f1 !== undefined && f > f1 + 250 && f >= 800 && f <= 3000);
      const f3 = peaks.find(f => f2 !== undefined && f > f2 + 300 && f >= 1800 && f <= 4000);
      if (f1 !== undefined) f1s.push(f1);
      if (f2 !== undefined) f2s.push(f2);
      if (f3 !== undefined) f3s.push(f3);
    }
    if (++sinceYield >= 4) {
      sinceYield = 0;
      await yieldToEventLoop();
    }
  }
  if (f1s.length < 3 || f2s.length < 3) return null;
  return {
    f1: Math.round(median(f1s)),
    f2: Math.round(median(f2s)),
    f3: f3s.length >= 3 ? Math.round(median(f3s)) : Math.round(median(f2s) * 2),
  };
}

/**
 * Análisis acústico completo de una toma. Cede el hilo JS cada pocas ventanas:
 * sobre 5 s de audio la autocorrelación + LPC tardan lo suyo y ejecutarlas de
 * una pieza congelaba la pantalla (el «cuelgue» que se veía al terminar de
 * grabar cuando esto corría dentro de `stopRecording`).
 */
export async function analysePcm(pcm: Float32Array): Promise<VoiceMicResult> {
  const f0s: number[] = [];
  const amplitudes: number[] = [];
  const hnrs: number[] = [];
  const voicedOffsets: number[] = [];

  // Umbral de sonoridad RELATIVO al nivel de la toma: RMS por ventana (barato),
  // nivel de referencia = percentil 95 (las ventanas con voz, aunque la emisión
  // ocupe solo parte de la grabación) y umbral a −10 dB de esa referencia, sin
  // bajar nunca del suelo absoluto de silencio.
  const frameRms: number[] = [];
  for (let i = 0; i + FRAME <= pcm.length; i += FRAME) {
    let energy = 0;
    for (let j = i; j < i + FRAME; j++) energy += pcm[j] * pcm[j];
    frameRms.push(Math.sqrt(energy / FRAME));
  }
  const sorted = [...frameRms].sort((a, b) => a - b);
  const ref = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0;
  const minRms = Math.max(SILENCE_RMS, ref * VOICED_RMS_FRACTION);

  let sinceYield = 0;
  for (let i = 0; i + FRAME <= pcm.length; i += FRAME) {
    const frame = analyseFrame(pcm.subarray(i, i + FRAME), minRms);
    if (frame) {
      voicedOffsets.push(i);
      f0s.push(frame.f0);
      amplitudes.push(frame.rms);
      const r = Math.min(0.999, Math.max(0.001, frame.peak));
      hnrs.push(Math.max(0, Math.min(35, 10 * Math.log10(r / (1 - r)))));
    }
    if (++sinceYield >= 8) {
      sinceYield = 0;
      await yieldToEventLoop();
    }
  }

  // Formantes solo sobre una muestra de ventanas sonoras (coste acotado).
  const sampled = voicedOffsets.filter((_, idx) => idx % 3 === 0).slice(0, 20);
  const formants = await estimateFormants(pcm, sampled);

  return { f0s, amplitudes, hnrs, formants };
}
