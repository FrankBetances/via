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
/*                                                                            */
/*  CALIBRACIÓN (corrige «cuando funciona parece que no está bien calibrado»): */
/*   · PONDERACIÓN A (IEC 61672): la lectura es dB(A), como la de cualquier    */
/*     sonómetro y como exigen los criterios de ruido de sala para audiometría */
/*     (ISO 8253-1). Antes se medía SIN ponderar (dB Z): el retumbe de baja    */
/*     frecuencia —climatización, tráfico, manejo del propio dispositivo—      */
/*     domina la energía y hacía leer 10–20 dB de más frente a un sonómetro    */
/*     de referencia, aunque la sala fuese silenciosa en la banda del habla.   */
/*   · REFERENCIA dBFS→SPL realista: RMS digital 1.0 ↔ ~120 dB(A) SPL, que es  */
/*     el orden del punto de sobrecarga acústica de los micrófonos MEMS de     */
/*     móvil/tableta. El valor anterior (92) comprimía toda la escala hacia el */
/*     suelo: una sala normal de 40–45 dB(A) caía por debajo del mínimo y se   */
/*     mostraba clavada en 28 dB.                                             */
/*   · OFFSET de campo: `setNoiseCalibrationOffset` permite anclar la lectura  */
/*     a un sonómetro patrón sin tocar el código. Sigue SIN ser calibración    */
/*     absoluta certificada y así debe advertirse en UI/PDF.                   */
/* -------------------------------------------------------------------------- */

/* eslint-disable no-bitwise -- aritmética binaria inherente a la FFT radix-2 */

/** Nº de barras del espectro que consume la UI. */
export const NOISE_BANDS = 24;

/** Suelo/techo de la escala mostrada, en dB(A). */
export const NOISE_DB_MIN = 25;
export const NOISE_DB_MAX = 110;

/**
 * Nivel en dB(A) SPL que corresponde al fondo de escala del micrófono
 * (0 dBFS RMS). Orden de magnitud del punto de sobrecarga acústica de los
 * micrófonos MEMS de teléfono/tableta. NO es calibración absoluta: el
 * micrófono del dispositivo no está caracterizado, pero fija una escala
 * plausible y reproducible sobre la que aplicar el offset de campo.
 */
export const NOISE_SPL_AT_FULL_SCALE = 120;

/**
 * Corrección de campo (dB) que se suma a la lectura. Se ajusta comparando con
 * un sonómetro de referencia en la misma sala: si VIA+ marca 8 dB menos que el
 * patrón, el offset es +8. Acotado para que un ajuste erróneo no convierta la
 * lectura en absurda.
 */
let calibrationOffsetDb = 0;

/** Límite del ajuste manual de campo (dB). */
export const NOISE_OFFSET_LIMIT_DB = 25;

/** Fija la corrección de campo (dB), acotada a ±`NOISE_OFFSET_LIMIT_DB`. */
export const setNoiseCalibrationOffset = (db: number): number => {
  calibrationOffsetDb = clamp(Number.isFinite(db) ? db : 0, -NOISE_OFFSET_LIMIT_DB, NOISE_OFFSET_LIMIT_DB);
  return calibrationOffsetDb;
};

/** Corrección de campo vigente (dB). */
export const getNoiseCalibrationOffset = (): number => calibrationOffsetDb;

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

/**
 * Energía media (mean square) → dB(A) SPL orientativo, acotado a la escala.
 * `NOISE_SPL_AT_FULL_SCALE` es el nivel que corresponde a un RMS digital de
 * 1.0; sobre él se aplica el offset de campo.
 */
export function meanSquareToSpl(ms: number): number {
  const dbfs = 10 * Math.log10(Math.max(MIN_MS, ms)); // 10·log10(potencia) = 20·log10(rms)
  return clamp(
    NOISE_SPL_AT_FULL_SCALE + dbfs + calibrationOffsetDb,
    NOISE_DB_MIN,
    NOISE_DB_MAX,
  );
}

/* ---------------------------- ponderación A ------------------------------- */

/**
 * Ponderación A (IEC 61672) como cascada de biquads, obtenida por
 * transformada bilineal de la función de transferencia analógica:
 *
 *   H(s) = k·s⁴ / ((s+ω1)²(s+ω2)(s+ω3)(s+ω4)²)
 *   f1 = 20.598997, f2 = 107.65265, f3 = 737.86223, f4 = 12194.217 Hz
 *
 * Se normaliza a 0 dB en 1 kHz (definición de la curva A). Los coeficientes se
 * calculan para la frecuencia de muestreo pedida y se memorizan: la cascada se
 * reutiliza bloque a bloque sin recalcular.
 */
interface Biquad {
  b0: number; b1: number; b2: number;
  a1: number; a2: number;
}

/**
 * Biquad digital equivalente a la sección analógica
 *   (n2·s² + n1·s + n0) / (d2·s² + d1·s + d0)
 * por transformada bilineal `s → 2·fs·(1−z⁻¹)/(1+z⁻¹)` (sin pre-warping: el
 * error en el polo de 12 kHz es irrelevante frente a la banda de interés, y la
 * normalización a 1 kHz fija la referencia de la curva).
 */
const bilinear = (
  sr: number,
  [n2, n1, n0]: [number, number, number],
  [d2, d1, d0]: [number, number, number],
): Biquad => {
  const k = 2 * sr;
  const k2 = k * k;
  const bn0 = n2 * k2 + n1 * k + n0;
  const bn1 = -2 * n2 * k2 + 2 * n0;
  const bn2 = n2 * k2 - n1 * k + n0;
  const ad0 = d2 * k2 + d1 * k + d0;
  const ad1 = -2 * d2 * k2 + 2 * d0;
  const ad2 = d2 * k2 - d1 * k + d0;
  return {
    b0: bn0 / ad0,
    b1: bn1 / ad0,
    b2: bn2 / ad0,
    a1: ad1 / ad0,
    a2: ad2 / ad0,
  };
};

/** Sección analógica `s² / (s+ω)²` (dos ceros en el origen, polo doble). */
const doublePoleHighpass = (sr: number, w: number): Biquad =>
  bilinear(sr, [1, 0, 0], [1, 2 * w, w * w]);

/** Sección analógica `1 / ((s+ωa)(s+ωb))` (sin ceros). */
const doublePoleLowpass = (sr: number, wa: number, wb: number): Biquad =>
  bilinear(sr, [0, 0, 1], [1, wa + wb, wa * wb]);

const F1 = 20.598997;
const F2 = 107.65265;
const F3 = 737.86223;
const F4 = 12194.217;
const TWO_PI = 2 * Math.PI;

/** Respuesta en magnitud de una cascada de biquads a la frecuencia `f`. */
const cascadeMagnitude = (stages: Biquad[], f: number, sr: number): number => {
  const w = (TWO_PI * f) / sr;
  const cw = Math.cos(w);
  const sw = Math.sin(w);
  const c2w = Math.cos(2 * w);
  const s2w = Math.sin(2 * w);
  let mag = 1;
  for (const s of stages) {
    const nRe = s.b0 + s.b1 * cw + s.b2 * c2w;
    const nIm = -(s.b1 * sw + s.b2 * s2w);
    const dRe = 1 + s.a1 * cw + s.a2 * c2w;
    const dIm = -(s.a1 * sw + s.a2 * s2w);
    mag *= Math.sqrt((nRe * nRe + nIm * nIm) / (dRe * dRe + dIm * dIm));
  }
  return mag;
};

interface AWeighting {
  stages: Biquad[];
  gain: number;
}

const aWeightCache = new Map<number, AWeighting>();

/** Cascada de ponderación A para la frecuencia de muestreo dada (memorizada). */
export function aWeightingStages(sampleRate: number): AWeighting {
  const cached = aWeightCache.get(sampleRate);
  if (cached) return cached;

  const w1 = TWO_PI * F1;
  const w2 = TWO_PI * F2;
  const w3 = TWO_PI * F3;
  const w4 = TWO_PI * F4;

  // H(s) = K·s⁴ / ((s+ω1)²(s+ω2)(s+ω3)(s+ω4)²) repartida en tres biquads.
  const stages: Biquad[] = [
    doublePoleHighpass(sampleRate, w4),
    doublePoleHighpass(sampleRate, w1),
    doublePoleLowpass(sampleRate, w2, w3),
  ];

  // Normalización a 0 dB en 1 kHz (definición de la curva A).
  const gain = 1 / cascadeMagnitude(stages, 1000, sampleRate);
  const weighting: AWeighting = { stages, gain };
  aWeightCache.set(sampleRate, weighting);
  return weighting;
}

/**
 * Aplica la ponderación A a un bloque PCM y devuelve la señal ponderada.
 * Estado NO persistente entre bloques (cada bloque de ~100 ms se filtra por su
 * cuenta): el transitorio de arranque del filtro dura milisegundos y el Leq lo
 * promedia, de modo que no afecta a la lectura.
 */
export function aWeight(pcm: Float32Array, sampleRate: number): Float32Array {
  const { stages, gain } = aWeightingStages(sampleRate);
  const out = new Float32Array(pcm.length);
  out.set(pcm);
  for (const s of stages) {
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;
    for (let i = 0; i < out.length; i++) {
      const x0 = out[i];
      const y0 = s.b0 * x0 + s.b1 * x1 + s.b2 * x2 - s.a1 * y1 - s.a2 * y2;
      x2 = x1;
      x1 = x0;
      y2 = y1;
      y1 = y0;
      out[i] = y0;
    }
  }
  for (let i = 0; i < out.length; i++) out[i] *= gain;
  return out;
}

/** Energía media (mean square) del bloque tras la ponderación A. */
export function aWeightMeanSquare(pcm: Float32Array, sampleRate: number): number {
  return meanSquare(aWeight(pcm, sampleRate));
}

/**
 * Atenuación teórica de la ponderación A a una frecuencia (dB, 0 en 1 kHz).
 * Se usa en las pruebas y sirve de referencia documental: −16.2 dB a 125 Hz,
 * −39.5 dB a 31.5 Hz, +1.2 dB a 2 kHz (tabla IEC 61672).
 */
export const aWeightingDb = (freq: number, sampleRate: number): number => {
  const { stages, gain } = aWeightingStages(sampleRate);
  return 20 * Math.log10(cascadeMagnitude(stages, freq, sampleRate) * gain);
};

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
