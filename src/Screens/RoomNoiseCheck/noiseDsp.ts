import { clamp } from '@/Helpers/numeric';

/* -------------------------------------------------------------------------- */
/*  DSP puro del sonómetro (sin dependencias nativas).                         */
/*                                                                            */
/*  Se separa del adaptador de micrófono (`noiseMicAdapter`, que sí importa    */
/*  `react-native-audio-api`) para poder ejercitar el cálculo con pruebas      */
/*  unitarias sobre PCM sintético, igual que `voiceDsp` frente a               */
/*  `voiceMicAdapter`.                                                         */
/*                                                                            */
/*  Corrige el bug de «mediciones al azar»:                                    */
/*   · Nivel: promedio ENERGÉTICO (Leq) entre bloques en vez del RMS de un     */
/*     único bloque de 100 ms — con el logaritmo, el RMS de un bloque suelto   */
/*     salta varios dB entre frames aunque el ruido de sala sea estable.       */
/*   · Espectro: FFT REAL (magnitud por bandas log de frecuencia) en vez de    */
/*     la envolvente temporal del bloque, que para ruido parece aleatoria.     */
/* -------------------------------------------------------------------------- */

/* eslint-disable no-bitwise -- aritmética binaria inherente a la FFT radix-2 */

/** Nº de barras del espectro que consume la UI. */
export const NOISE_BANDS = 24;

/** Suelo/techo de la escala mostrada (dB, relativos). */
export const NOISE_DB_MIN = 28;
export const NOISE_DB_MAX = 92;

/**
 * Referencia de calibración RELATIVA: nivel (dB «SPL» orientativo) asignado a
 * 0 dBFS (fondo de escala del micrófono). No es calibración absoluta —el
 * micrófono del dispositivo no está caracterizado— pero fija una escala
 * ESTABLE y reproducible. Ajuste este único valor si dispone de un sonómetro
 * de referencia para anclar la lectura.
 */
export const NOISE_SPL_AT_FULL_SCALE = 92;

/** Suelo de energía (evita log(0) en silencio digital). */
const MIN_MS = 1e-12;

/** Energía media (mean square) de un bloque PCM. */
export function meanSquare(pcm: Float32Array): number {
  const n = pcm.length;
  if (!n) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += pcm[i] * pcm[i];
  return sum / n;
}

/**
 * Promedio energético exponencial (Leq): mezcla la energía nueva con la
 * acumulada en el dominio de POTENCIA (lo correcto; promediar dB directamente
 * subestima el nivel). `alpha` = peso del bloque nuevo (0..1); con bloques de
 * ~100 ms, `alpha≈0.12` da una constante de tiempo ≈0.8 s (respuesta «slow»
 * típica de un sonómetro), estable frente al jitter del RMS por bloque.
 */
export function updateLeqMeanSquare(prevMs: number | null, blockMs: number, alpha: number): number {
  if (prevMs == null || !(prevMs > 0)) return blockMs;
  return prevMs * (1 - alpha) + blockMs * alpha;
}

/** Energía media (mean square) → dB «SPL» orientativo, acotado a la escala. */
export function meanSquareToSpl(ms: number): number {
  const dbfs = 10 * Math.log10(Math.max(MIN_MS, ms)); // 10·log10(potencia) = 20·log10(rms)
  return clamp(NOISE_SPL_AT_FULL_SCALE + dbfs, NOISE_DB_MIN, NOISE_DB_MAX);
}

/** Fracción 0..1 de un dB dentro de la escala (para anillo/gauge de la UI). */
export const splFraction = (db: number): number =>
  clamp((db - NOISE_DB_MIN) / (NOISE_DB_MAX - NOISE_DB_MIN), 0, 1);

/* ------------------------------- FFT radix-2 ------------------------------ */

const nextPow2Floor = (n: number): number => {
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
};

/** FFT compleja in-place (Cooley-Tukey iterativa). `re.length` potencia de 2. */
function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cwr = 1;
      let cwi = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k;
        const b = a + half;
        const vr = re[b] * cwr - im[b] * cwi;
        const vi = re[b] * cwi + im[b] * cwr;
        re[b] = re[a] - vr;
        im[b] = im[a] - vi;
        re[a] += vr;
        im[a] += vi;
        const nwr = cwr * wr - cwi * wi;
        cwi = cwr * wi + cwi * wr;
        cwr = nwr;
      }
    }
  }
}

/**
 * Espectro de magnitud por bandas LOG de frecuencia (0..1), a partir de un
 * bloque PCM. Ventana de Hann + FFT real; las magnitudes se agrupan en
 * `bands` bandas log-espaciadas (≈80 Hz → Nyquist·0.9) y se mapean a 0..1 con
 * una curva logarítmica de nivel. A diferencia de la envolvente temporal
 * anterior, un tono a frecuencia f produce un pico en SU banda y no en las
 * demás (comportamiento verificado en pruebas).
 */
export function spectrumBands(pcm: Float32Array, sampleRate: number, bands = NOISE_BANDS): number[] {
  const flat = new Array(bands).fill(0);
  const n = nextPow2Floor(pcm.length);
  if (n < 8) return flat;

  const re = new Float64Array(n);
  const im = new Float64Array(n);
  // Ventana de Hann (reduce la fuga espectral).
  for (let i = 0; i < n; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    re[i] = pcm[i] * w;
  }
  fftInPlace(re, im);

  const half = n >> 1;
  const binHz = sampleRate / n;
  const fLow = 80;
  const fHigh = Math.min(sampleRate * 0.45, 16000);
  const logLo = Math.log(fLow);
  const logHi = Math.log(fHigh);

  const out = new Array(bands).fill(0);
  for (let bnd = 0; bnd < bands; bnd++) {
    const f0 = Math.exp(logLo + ((logHi - logLo) * bnd) / bands);
    const f1 = Math.exp(logLo + ((logHi - logLo) * (bnd + 1)) / bands);
    const k0 = Math.max(1, Math.floor(f0 / binHz));
    const k1 = Math.min(half, Math.max(k0 + 1, Math.ceil(f1 / binHz)));
    let power = 0;
    for (let k = k0; k < k1; k++) {
      // Magnitud normalizada por N (independiente del tamaño de ventana).
      const mr = re[k] / n;
      const mi = im[k] / n;
      power += mr * mr + mi * mi;
    }
    const rms = Math.sqrt(power / Math.max(1, k1 - k0)) * 2; // ×2: energía del espectro unilateral
    // Nivel log a 0..1: −60 dB → 0, 0 dB → 1 (misma pendiente que el gauge).
    const db = 20 * Math.log10(Math.max(1e-6, rms));
    out[bnd] = clamp((db + 60) / 60, 0.04, 1);
  }
  return out;
}

/** Suaviza las barras del espectro entre frames (evita parpadeo). */
export function smoothBands(prev: number[] | null, next: number[], alpha = 0.5): number[] {
  if (!prev || prev.length !== next.length) return next;
  return next.map((v, i) => prev[i] * (1 - alpha) + v * alpha);
}
/* eslint-enable no-bitwise */
