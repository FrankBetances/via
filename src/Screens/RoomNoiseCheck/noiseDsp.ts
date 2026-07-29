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
/*   · REFERENCIA dBFS→SPL: ver `NOISE_SPL_AT_FULL_SCALE`.                     */
/*   · OFFSET de campo: `setNoiseCalibrationOffset` (o, mejor,                 */
/*     `offsetForReference`, que lo calcula solo a partir de la lectura de un  */
/*     sonómetro patrón) ancla la escala al dispositivo concreto. Sigue SIN    */
/*     ser calibración absoluta certificada y así debe advertirse en UI/PDF.   */
/*                                                                            */
/*  BUG DEL FILTRO CON ESTADO REINICIADO (causa de «muy al azar»):            */
/*   La cascada de ponderación A tiene dos polos en 20.6 Hz, es decir, una     */
/*   constante de tiempo de decenas de milisegundos. Arrancarla con estado     */
/*   cero en CADA bloque de 100 ms —como hacía `aWeight`— equivale a decirle   */
/*   al filtro que antes del bloque no había señal: el salto respecto al       */
/*   valor real produce un transitorio de arranque cuya energía entra entera   */
/*   en el mean square del bloque.                                            */
/*                                                                            */
/*   El transitorio es proporcional al INFRASONIDO presente (deriva de línea   */
/*   de base al mover el equipo, retumbe de climatización, portazos: 0.5–15 Hz)*/
/*   que la curva A debería atenuar más de 50 dB. Medido en la prueba de       */
/*   regresión de este módulo, una sala con ese contenido lee varios dB de más */
/*   y salta más de 5 dB de un bloque al siguiente según la fase del           */
/*   infrasonido en el corte — es decir, alto y errático. El comentario        */
/*   histórico daba el transitorio por irrelevante «porque el Leq lo           */
/*   promedia», pero se repite en TODOS los bloques: no se promedia, se        */
/*   acumula como sesgo.                                                       */
/*                                                                            */
/*   Solución: `createNoiseWeightingChain` mantiene el estado del filtro entre */
/*   bloques (más un bloqueador de DC previo) y el adaptador descarta los      */
/*   primeros bloques de calentamiento. `aWeight` se conserva sin estado solo  */
/*   como utilidad de prueba sobre un bloque suelto.                          */
/* -------------------------------------------------------------------------- */

/* eslint-disable no-bitwise -- aritmética binaria inherente a la FFT radix-2 */

/** Nº de barras del espectro que consume la UI. */
export const NOISE_BANDS = 24;

/** Suelo/techo de la escala mostrada, en dB(A). */
export const NOISE_DB_MIN = 25;
export const NOISE_DB_MAX = 110;

/**
 * Nivel en dB(A) SPL que corresponde al fondo de escala del micrófono
 * (0 dBFS RMS).
 *
 * NO es el punto de sobrecarga acústica del transductor (los MEMS de móvil
 * llegan a 120–130 dB SPL): es el nivel que satura la CADENA de captura —
 * micrófono + preamplificador + conversión— tal y como la entrega el sistema.
 * Ese es el número que importa aquí, y en teléfonos y tabletas ronda los
 * 100–110 dB(A) SPL. El valor anterior (120, tomado del AOP del transductor)
 * empujaba TODA la escala hacia arriba y es la parte sistemática del «entre 15
 * y 20 dB por encima» reportado en campo; 105 es el centro del rango realista.
 *
 * Sigue sin ser calibración absoluta: el micrófono del dispositivo no está
 * caracterizado. Lo que fija es una escala plausible y reproducible sobre la
 * que aplicar el offset de campo, que es la vía para anclar la lectura a un
 * sonómetro patrón (ver `offsetForReference`).
 */
export const NOISE_SPL_AT_FULL_SCALE = 105;

/**
 * Corrección de campo (dB) que se suma a la lectura. Se ajusta comparando con
 * un sonómetro de referencia en la misma sala: si VIA+ marca 8 dB menos que el
 * patrón, el offset es +8. Acotado para que un ajuste erróneo no convierta la
 * lectura en absurda.
 */
let calibrationOffsetDb = 0;

/**
 * Límite del ajuste manual de campo (dB). Amplio a propósito: la sensibilidad
 * de la cadena de captura varía mucho entre dispositivos y con ±25 dB no se
 * podía anclar un terminal alejado de la referencia por defecto.
 */
export const NOISE_OFFSET_LIMIT_DB = 40;

/** Fija la corrección de campo (dB), acotada a ±`NOISE_OFFSET_LIMIT_DB`. */
export const setNoiseCalibrationOffset = (db: number): number => {
  calibrationOffsetDb = clamp(Number.isFinite(db) ? db : 0, -NOISE_OFFSET_LIMIT_DB, NOISE_OFFSET_LIMIT_DB);
  return calibrationOffsetDb;
};

/** Corrección de campo vigente (dB). */
export const getNoiseCalibrationOffset = (): number => calibrationOffsetDb;

/**
 * Offset que haría que una lectura de VIA+ coincidiera con la de un sonómetro
 * patrón medido a la vez en la misma sala. Es la vía RECOMENDADA de
 * calibración: el clínico no tiene que deducir el signo ni ir sumando dB de
 * uno en uno, solo teclear lo que marca el patrón.
 *
 * `viaReading` es la lectura MOSTRADA (ya incluye el offset vigente), así que
 * el offset nuevo se compone con el actual.
 */
export const offsetForReference = (referenceDb: number, viaReading: number): number => {
  if (!Number.isFinite(referenceDb) || !Number.isFinite(viaReading)) return calibrationOffsetDb;
  return clamp(
    calibrationOffsetDb + (referenceDb - viaReading),
    -NOISE_OFFSET_LIMIT_DB,
    NOISE_OFFSET_LIMIT_DB,
  );
};

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
 * Aplica la ponderación A a un bloque PCM SUELTO (estado del filtro a cero).
 *
 * Utilidad de prueba y de análisis puntual. La captura en vivo NO debe usarla
 * bloque a bloque: reiniciar el estado en cada bloque de 100 ms inyecta el
 * transitorio de arranque de los polos de 20.6 Hz una y otra vez e infla la
 * lectura de forma variable (ver cabecera del módulo). Para eso está
 * `createNoiseWeightingChain`, que conserva el estado entre bloques.
 */
export function aWeight(pcm: Float32Array, sampleRate: number): Float32Array {
  const chain = createNoiseWeightingChain(sampleRate, { dcBlock: false });
  return chain.process(pcm);
}

/** Energía media (mean square) de un bloque suelto tras la ponderación A. */
export function aWeightMeanSquare(pcm: Float32Array, sampleRate: number): number {
  return meanSquare(aWeight(pcm, sampleRate));
}

/* -------------------- cadena de ponderación CON ESTADO -------------------- */

export interface NoiseWeightingChain {
  /** Filtra un bloque conservando el estado del anterior. No muta la entrada. */
  process: (pcm: Float32Array) => Float32Array;
  /** Vuelve al estado inicial (arranque de una medición nueva). */
  reset: () => void;
}

export interface NoiseWeightingOptions {
  /**
   * Bloqueador de componente continua antes de la ponderación (por defecto
   * `true`). Muchos micrófonos de móvil entregan un offset de DC pequeño pero
   * no nulo; sin quitarlo, los integradores de la curva A tardan en asentarse
   * y el arranque de cada medición lee de más.
   */
  dcBlock?: boolean;
}

/** Frecuencia de corte del bloqueador de DC (Hz): muy por debajo de la banda
 *  de interés, así que no toca la lectura ponderada. */
const DC_BLOCK_HZ = 5;

/**
 * Cadena de medición del sonómetro con ESTADO PERSISTENTE entre bloques:
 * bloqueo de DC → cascada de ponderación A → ganancia de normalización.
 *
 * Es la vía que debe usar la captura en vivo: procesar el stream como una
 * señal continua (y no como bloques independientes) elimina el transitorio de
 * arranque por bloque que inflaba y aleatorizaba la lectura.
 */
export function createNoiseWeightingChain(
  sampleRate: number,
  opts: NoiseWeightingOptions = {},
): NoiseWeightingChain {
  const { stages, gain } = aWeightingStages(sampleRate);
  const useDcBlock = opts.dcBlock ?? true;
  // y[n] = x[n] − x[n−1] + R·y[n−1] (polo simple en DC_BLOCK_HZ).
  const R = Math.exp((-2 * Math.PI * DC_BLOCK_HZ) / sampleRate);

  // Estado por sección: [x1, x2, y1, y2].
  const state = stages.map(() => new Float64Array(4));
  let dcX1 = 0;
  let dcY1 = 0;

  const reset = () => {
    for (const s of state) s.fill(0);
    dcX1 = 0;
    dcY1 = 0;
  };

  const process = (pcm: Float32Array): Float32Array => {
    const out = new Float32Array(pcm.length);
    if (useDcBlock) {
      for (let i = 0; i < pcm.length; i++) {
        const x0 = pcm[i];
        dcY1 = x0 - dcX1 + R * dcY1;
        dcX1 = x0;
        out[i] = dcY1;
      }
    } else {
      out.set(pcm);
    }
    for (let s = 0; s < stages.length; s++) {
      const { b0, b1, b2, a1, a2 } = stages[s];
      const st = state[s];
      let x1 = st[0];
      let x2 = st[1];
      let y1 = st[2];
      let y2 = st[3];
      for (let i = 0; i < out.length; i++) {
        const x0 = out[i];
        const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1;
        x1 = x0;
        y2 = y1;
        y1 = y0;
        out[i] = y0;
      }
      st[0] = x1;
      st[1] = x2;
      st[2] = y1;
      st[3] = y2;
    }
    for (let i = 0; i < out.length; i++) out[i] *= gain;
    return out;
  };

  return { process, reset };
}

/* --------------------------- calidad del bloque --------------------------- */

/**
 * Nivel a partir del cual una muestra se considera saturada. Un bloque
 * recortado tiene un nivel real DESCONOCIDO (y siempre mayor que el medido),
 * así que no debe entrar en el promedio: contaminaba la medición cuando el
 * micrófono recibía un golpe o el propio manejo del dispositivo.
 */
export const CLIP_LEVEL = 0.985;

/** ¿El bloque contiene muestras a fondo de escala (recorte)? */
export function isBlockClipped(pcm: Float32Array): boolean {
  for (let i = 0; i < pcm.length; i++) {
    if (pcm[i] >= CLIP_LEVEL || pcm[i] <= -CLIP_LEVEL) return true;
  }
  return false;
}

/* ------------------------- estadística de la medición --------------------- */

/**
 * Percentil (0..100) de una serie de dB. `percentileDb(x, 10)` es el nivel
 * superado el 90 % del tiempo (L90, el RUIDO DE FONDO de la sala) y
 * `percentileDb(x, 90)` el L10 (los picos sostenidos). Interpolación lineal
 * entre muestras contiguas; `null` si no hay datos.
 */
export function percentileDb(values: number[], p: number): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const pos = clamp(p, 0, 100) / 100 * (s.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/**
 * Nivel continuo equivalente (LAeq) de una serie de lecturas en dB: media
 * ENERGÉTICA, no aritmética. Promediar decibelios directamente subestima el
 * nivel cuando la serie tiene picos, que es justo lo que pasa en una consulta
 * con ruido intermitente.
 */
export function energyAverageDb(values: number[]): number | null {
  if (!values.length) return null;
  let acc = 0;
  for (const db of values) acc += Math.pow(10, db / 10);
  return 10 * Math.log10(acc / values.length);
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
