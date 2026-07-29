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
/*   - F0 por autocorrelación normalizada en 70–500 Hz                         */
/*   - HNR desde el pico de autocorrelación r: 10·log10(r/(1−r))               */
/*   - Formantes F1–F3 por LPC (Levinson-Durbin) + picos de la envolvente      */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  LIMPIEZA DE BAJA FRECUENCIA (bug «el análisis acústico no funciona»)       */
/*                                                                            */
/*  La captura de micrófono llega casi siempre con contenido por DEBAJO de la  */
/*  banda de análisis (70 Hz): componente continua del convertidor, deriva de  */
/*  línea de base al mover el equipo, retumbe de climatización, roce del       */
/*  soporte. Nada de eso es voz, pero destroza los tres cálculos del módulo:   */
/*                                                                            */
/*   · AUTOCORRELACIÓN — `r[lag] = 2·Σx[i]x[i+lag] / Σ(x[i]²+x[i+lag]²)` está  */
/*     normalizada sobre la energía TOTAL de la ventana. Una componente lenta  */
/*     y potente correlaciona consigo misma a todos los lags, así que r sube   */
/*     en bloque y el «primer máximo local por encima de 0.8·max» deja de caer */
/*     en el periodo de la voz: se va a un lag más corto y la F0 sale DOBLADA. */
/*   · JITTER/SHIMMER — se calculan sobre esas F0 y esos RMS contaminados.     */
/*   · LPC — la deriva se lleva los primeros coeficientes y la envolvente      */
/*     pierde F1–F3.                                                          */
/*                                                                            */
/*  Medido en `voiceDsp.test.ts` sobre una /a/ sintética de 200 Hz: con una    */
/*  deriva de 3 Hz el módulo devolvía F0 358 Hz, jitter 33 % y shimmer 45 %    */
/*  —una voz sana leída como gravemente patológica— en vez de F0 200 Hz,       */
/*  jitter ~0 y shimmer ~1 %. Y NO fallaba de forma visible: devolvía números  */
/*  plausibles, que es el peor modo de fallo posible en un SaMD.               */
/*                                                                            */
/*  Solución: pasa-alto de Butterworth de 2.º orden a `HIGHPASS_HZ`, por       */
/*  debajo del suelo de la banda de análisis (70 Hz), aplicado tanto al        */
/*  análisis de la toma como al feedback en vivo. El PCM GRABADO se conserva   */
/*  intacto (la reproducción de la toma debe sonar como se grabó).            */
/* -------------------------------------------------------------------------- */

/** Frecuencia efectiva del PCM analizado (48 kHz decimado ×3 en el adaptador). */
export const SAMPLE_RATE = 16000;
/** Factor de decimación de la cadena de captura (48 kHz → 16 kHz). */
export const DECIMATION = 3;
/** Tamaño de ventana de análisis (~64 ms a 16 kHz). */
export const FRAME = 1024;

/* ------------------------- decimación anti-alias ×3 ------------------------ */

/** Nº de coeficientes (impar) del FIR paso-bajo previo a la decimación. */
const AA_TAPS_N = 33;
/** Corte del FIR (Hz, a 48 kHz): bajo la nueva Nyquist (8 kHz) con margen de
 *  transición para que la banda plegada quede realmente atenuada. */
const AA_CUTOFF_HZ = 6600;

/** FIR paso-bajo (sinc enventanada con Hamming, ganancia 1 en DC). */
const AA_TAPS: Float64Array = (() => {
  const taps = new Float64Array(AA_TAPS_N);
  const half = (AA_TAPS_N - 1) / 2;
  const fc = AA_CUTOFF_HZ / (SAMPLE_RATE * DECIMATION);
  let sum = 0;
  for (let i = 0; i < AA_TAPS_N; i++) {
    const m = i - half;
    const sinc = m === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * m) / (Math.PI * m);
    const hamming = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (AA_TAPS_N - 1));
    taps[i] = sinc * hamming;
    sum += taps[i];
  }
  for (let i = 0; i < AA_TAPS_N; i++) taps[i] /= sum;
  return taps;
})();

/**
 * Decimador ×3 (48 kHz → 16 kHz) con filtro FIR anti-alias y estado entre
 * bloques (cola del bloque anterior + fase del diezmado), para usar sobre el
 * stream de captura por chunks.
 *
 * La decimación histórica tomaba 1 de cada 3 muestras SIN filtrar: todo el
 * contenido de 8–24 kHz del micrófono real (fricción, siseo, ruido ambiente)
 * se plegaba sobre la banda de análisis. La F0 por autocorrelación sobrevive
 * al aliasing, pero la envolvente LPC no: los picos espurios enmascaraban
 * F1–F3 y la toma acababa en «se detectó voz pero sin formantes» aunque el
 * pitch en vivo se hubiera visto perfectamente durante la grabación.
 */
export function createDecimator3(): (raw: Float32Array) => Float32Array {
  const hist = new Float32Array(AA_TAPS_N - 1); // últimas muestras del bloque anterior
  let phase = 0; // posición (mod 3) de la primera muestra de salida del bloque
  return (raw: Float32Array): Float32Array => {
    if (raw.length === 0) return new Float32Array(0);
    const ext = new Float32Array(hist.length + raw.length);
    ext.set(hist);
    ext.set(raw, hist.length);
    const out = new Float32Array(
      raw.length > phase ? Math.ceil((raw.length - phase) / DECIMATION) : 0,
    );
    let o = 0;
    for (let p = phase; p < raw.length; p += DECIMATION) {
      // y[p] = Σ taps[k] · x[p − k], con x extendido con la cola anterior.
      const base = p + hist.length;
      let acc = 0;
      for (let k = 0; k < AA_TAPS_N; k++) acc += AA_TAPS[k] * ext[base - k];
      out[o++] = acc;
    }
    phase = raw.length > phase ? (DECIMATION - ((raw.length - phase) % DECIMATION)) % DECIMATION : phase - raw.length;
    hist.set(ext.subarray(ext.length - hist.length));
    return out;
  };
}

/* ------------------------ pasa-alto de acondicionado ---------------------- */

/**
 * Corte del pasa-alto de acondicionado (Hz). Por debajo del suelo de la banda
 * de análisis de F0 (70 Hz), así que no toca ninguna voz analizable: solo
 * quita lo que de todas formas no se mide.
 */
export const HIGHPASS_HZ = 55;

export interface VoiceHighpass {
  /** Filtra un bloque conservando el estado (stream continuo). No muta la entrada. */
  process: (x: Float32Array) => Float32Array;
  reset: () => void;
}

/**
 * Pasa-alto de Butterworth de 2.º orden (forma directa II transpuesta) con
 * estado entre bloques, para acondicionar la señal antes del análisis.
 */
export function createVoiceHighpass(
  sampleRate: number = SAMPLE_RATE,
  cutoffHz: number = HIGHPASS_HZ,
): VoiceHighpass {
  const w0 = (2 * Math.PI * cutoffHz) / sampleRate;
  const cosw = Math.cos(w0);
  const alpha = Math.sin(w0) / Math.SQRT2; // Q = 1/√2 (Butterworth)
  const a0 = 1 + alpha;
  const b0 = ((1 + cosw) / 2) / a0;
  const b1 = (-(1 + cosw)) / a0;
  const b2 = b0;
  const a1 = (-2 * cosw) / a0;
  const a2 = (1 - alpha) / a0;

  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;

  return {
    process: (x: Float32Array): Float32Array => {
      const out = new Float32Array(x.length);
      for (let i = 0; i < x.length; i++) {
        const x0 = x[i];
        const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1;
        x1 = x0;
        y2 = y1;
        y1 = y0;
        out[i] = y0;
      }
      return out;
    },
    reset: () => {
      x1 = 0;
      x2 = 0;
      y1 = 0;
      y2 = 0;
    },
  };
}

/**
 * Acondiciona una toma completa: pasa-alto y, además, resta la media residual
 * (el transitorio de arranque del propio filtro sobre el primer tramo). Se usa
 * en `analysePcm`, de modo que el análisis es robusto venga el PCM de donde
 * venga —incluidas tomas capturadas antes de esta corrección—.
 */
export function conditionForAnalysis(
  pcm: Float32Array,
  sampleRate: number = SAMPLE_RATE,
): Float32Array {
  const out = createVoiceHighpass(sampleRate).process(pcm);
  if (!out.length) return out;
  let sum = 0;
  for (let i = 0; i < out.length; i++) sum += out[i];
  const mean = sum / out.length;
  if (mean !== 0) for (let i = 0; i < out.length; i++) out[i] -= mean;
  return out;
}

const MIN_LAG = Math.floor(SAMPLE_RATE / 500); // 500 Hz
/** Techo de periodo (suelo de F0) a 70 Hz. El valor histórico (100 Hz) estaba
 *  pensado solo para voz infantil y dejaba FUERA de banda la voz masculina
 *  adulta (una /a/ sostenida relajada cae en 80–100 Hz): la autocorrelación no
 *  encontraba el periodo, todas las ventanas se descartaban y cualquier prueba
 *  con voz de adulto acababa en «captura insuficiente» aunque la toma se oyera
 *  perfectamente — o, entre 85 y 100 Hz, devolvía una F0 falsa clavada en el
 *  borde de la banda. */
const MAX_LAG = Math.ceil(SAMPLE_RATE / 70); // 70 Hz
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
/**
 * Orden del modelo LPC. Regla estándar del análisis de formantes: DOS polos
 * por formante esperado, más 2–4 de margen para la fuente glotal y la
 * radiación. A 16 kHz el modelo cubre hasta 8 kHz, donde caben unos ocho
 * formantes → orden ≈ 2·8 + 4 = 20.
 *
 * El valor histórico (14) solo daba para cinco formantes en TODA la banda de
 * 8 kHz: los polos se gastaban repartidos por el espectro y F3 —la que
 * discrimina— se quedaba sin representar. La validación contra Praat
 * (`tools/acoustics/`) lo dejó a la vista: VIA+ declaraba «formantes no
 * estimables» en casi todos los casos en los que Praat los resolvía sin
 * dificultad.
 */
const LPC_ORDER = 20;

/* --------------------------------- HNR ------------------------------------ */

/**
 * TECHO del HNR (dB). El HNR se deriva del pico de autocorrelación `r` como
 * `10·log10(r/(1−r))`, que diverge cuando `r → 1`; hay que acotar `r` y eso
 * impone un techo. Con `r ≤ 0.999` el techo sale en ~30 dB.
 *
 * NO es una limitación práctica: las voces humanas se mueven entre ~5 dB
 * (disfonía marcada) y ~25 dB (voz sana), así que todo el rango clínico queda
 * por debajo. Lo que sí importa es que quede DECLARADO: una lectura de 30 dB
 * significa «≥ 30», no «exactamente 30». La validación contra Praat
 * (`tools/acoustics/`) confirma que dentro del rango medible ambos coinciden
 * dentro de medio decibelio; por encima, Praat da 70–85 dB sobre señal
 * sintética sin ruido y VIA+ satura aquí.
 */
export const HNR_CEILING_DB = 30;

/** Acota el pico de autocorrelación al rango en que el HNR es finito. */
const clampCorrelationForHnr = (peak: number): number =>
  Math.min(0.999, Math.max(0.001, peak));

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
  // Bastan 2 ventanas coincidentes: la mediana sigue filtrando espurios y el
  // mínimo histórico (3) tiraba tomas enteras cuando la emisión solo tenía un
  // tramo corto estable — «se detectó voz pero sin formantes».
  //
  // F3 EXIGE MEDICIÓN REAL. El respaldo histórico (`mediana(F2)·2`) fabricaba
  // un tercer formante que el informe presentaba como medido, y en la práctica
  // salía por encima de la banda que la LPC analiza (150–4000 Hz) — un valor
  // imposible presentado como dato clínico. Sin F3 medible, la toma no tiene
  // formantes fiables y se declara así.
  if (f1s.length < 2 || f2s.length < 2 || f3s.length < 2) return null;
  return {
    f1: Math.round(median(f1s)),
    f2: Math.round(median(f2s)),
    f3: Math.round(median(f3s)),
  };
}

/**
 * Análisis acústico completo de una toma. Cede el hilo JS cada pocas ventanas:
 * sobre 5 s de audio la autocorrelación + LPC tardan lo suyo y ejecutarlas de
 * una pieza congelaba la pantalla (el «cuelgue» que se veía al terminar de
 * grabar cuando esto corría dentro de `stopRecording`).
 */
export async function analysePcm(raw: Float32Array): Promise<VoiceMicResult> {
  // Acondicionado OBLIGATORIO: sin quitar la deriva de baja frecuencia, la
  // autocorrelación y la LPC devuelven números plausibles pero falsos (ver
  // cabecera del módulo). La toma grabada NO se modifica: esto es una copia.
  const pcm = conditionForAnalysis(raw);

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
      const r = clampCorrelationForHnr(frame.peak);
      hnrs.push(Math.max(0, Math.min(HNR_CEILING_DB, 10 * Math.log10(r / (1 - r)))));
    }
    if (++sinceYield >= 8) {
      sinceYield = 0;
      await yieldToEventLoop();
    }
  }

  // Formantes solo sobre una muestra de ventanas sonoras (coste acotado),
  // repartida por TODA la toma: el muestreo histórico (las ~60 primeras
  // ventanas sonoras) hacía que el resultado dependiera de que la emisión
  // empezara limpia — un arranque ronco o con ruido dejaba la toma entera
  // «sin formantes» aunque el tramo central fuera perfecto.
  const MAX_FORMANT_WINDOWS = 32;
  const step = Math.max(1, Math.floor(voicedOffsets.length / MAX_FORMANT_WINDOWS));
  const sampled = voicedOffsets
    .filter((_, idx) => idx % step === 0)
    .slice(0, MAX_FORMANT_WINDOWS);
  const formants = await estimateFormants(pcm, sampled);

  return {
    f0s,
    amplitudes,
    hnrs,
    formants,
    // Estadísticas de la toma para que, si el análisis resulta insuficiente,
    // la pantalla pueda decir POR QUÉ (silencio, ruido sin periodicidad, tono
    // fuera de banda…) en vez de un mensaje genérico.
    stats: { totalFrames: frameRms.length, levelRef: ref, voicedFrames: f0s.length },
  };
}
