/* IMPORTACIÓN RELATIVA A PROPÓSITO — no la cambie al alias `@/`.
 *
 * Este módulo se compila también FUERA de la app, en `tools/acoustics/`, para
 * contrastarlo con Praat en CI. Allí se compila a CommonJS con `tsc` y se carga
 * con un `require` de Node pelado, sin Metro ni `babel-plugin-module-resolver`,
 * que son los que resuelven `@/`. Con el alias, el JavaScript emitido contiene
 * `require("@/Screens/VoiceAnalysis/voiceDsp")` y Node aborta con
 * «Cannot find module» — el banco de validación deja de correr.
 *
 * `voiceDsp` puede permitirse el alias porque solo lo usa en imports DE TIPO,
 * que desaparecen al emitir. Aquí la importación es de valores (se ejecutan), y
 * sobrevive a la compilación. */
import {
  analyseFrame,
  conditionForAnalysis,
  FRAME,
  SAMPLE_RATE,
} from '../VoiceAnalysis/voiceDsp';

/* -------------------------------------------------------------------------- */
/*  DSP de PROSODIA (sin dependencias nativas).                                */
/*                                                                            */
/*  Mide la DINÁMICA del habla —ritmo, pausas, entonación— sobre habla         */
/*  CONECTADA, a diferencia de `voiceDsp`, que mide la CALIDAD de la fonación  */
/*  sobre una vocal sostenida. Son preguntas clínicas distintas sobre la misma */
/*  señal, y por eso este módulo reutiliza el motor de aquel en lugar de       */
/*  duplicarlo:                                                               */
/*                                                                            */
/*   · `conditionForAnalysis` — el mismo acondicionado de baja frecuencia.     */
/*   · `analyseFrame`         — la misma F0 por autocorrelación normalizada,   */
/*                              que la validación contra Praat deja en Δ = 0.0 */
/*                              Hz (ver `tools/acoustics/README.md`).          */
/*                                                                            */
/*  Lo que este módulo añade es la capa temporal que la vocal sostenida no     */
/*  necesita: contorno de intensidad fino, segmentación de pausas, núcleos     */
/*  silábicos y estadística del contorno de F0.                               */
/*                                                                            */
/*  ENTRADA: PCM mono a 16 kHz. NO es un parámetro configurable: `analyseFrame`*/
/*  deriva la F0 como `SAMPLE_RATE / lag` y acota la búsqueda con constantes   */
/*  propias de esa frecuencia. Aceptar un `sampleRate` sería prometer algo que */
/*  el motor no cumple. La cadena de captura decima ×3 desde 48 kHz.           */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  DOS RESOLUCIONES TEMPORALES, Y POR QUÉ                                     */
/*                                                                            */
/*  La F0 y la intensidad NO se miden con el mismo paso, porque no cuestan lo  */
/*  mismo ni se necesitan igual de finas:                                     */
/*                                                                            */
/*  · F0 — `analyseFrame` recorre ~198 retardos sobre una ventana de 1024      */
/*    muestras: del orden de 10^5 iteraciones POR TRAMA. Sobre una toma de 60 s*/
/*    el paso decide si el análisis tarda 4 s o 15 s. A 32 ms el contorno sale */
/*    a 31 tramas/s, de sobra para estadística de entonación (rango, SD,       */
/*    contorno final), que son medidas agregadas y no necesitan seguir cada    */
/*    microvariación.                                                         */
/*                                                                            */
/*  · Intensidad — es solo un RMS: coste despreciable. Y aquí el paso SÍ       */
/*    importa, porque de él dependen dos medidas con frontera temporal fina:   */
/*    el borde de las pausas y la separación entre núcleos silábicos          */
/*    consecutivos (el habla infantil llega a 5–6 sílabas/s, o sea una sílaba  */
/*    cada ~170 ms; con paso de 32 ms habría 5 puntos por sílaba y el pico se  */
/*    localizaría mal). A 10 ms hay ~17 puntos por sílaba.                    */
/* -------------------------------------------------------------------------- */

/**
 * Frecuencia de muestreo que ESPERA este módulo. Se reexporta porque es su
 * contrato de entrada y quien lo consume desde fuera de la app —el banco de
 * validación y el de concordancia— necesita saber a qué frecuencia decodificar
 * el audio antes de llamar a `analyseProsody`.
 */
export { SAMPLE_RATE };

/** Paso del contorno de F0 (muestras). 512 @ 16 kHz = 32 ms → 31.25 tramas/s. */
export const F0_HOP = 512;
/** Ventana del contorno de F0: la misma que usa `voiceDsp` (1024 = 64 ms). */
export const F0_WINDOW = FRAME;
/** Paso del contorno de intensidad (muestras). 160 @ 16 kHz = 10 ms. */
export const INTENSITY_HOP = 160;
/** Ventana del contorno de intensidad (muestras). 512 @ 16 kHz = 32 ms. */
export const INTENSITY_WINDOW = 512;

/* -------------------------------------------------------------------------- */
/*  UNIDADES                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Referencia de la escala de semitonos (Hz). El valor concreto es arbitrario:
 * todas las medidas de este módulo son DIFERENCIAS de semitonos (rango, SD,
 * cambio neto del contorno final) y una diferencia de semitonos no depende de
 * la referencia. Se fija en 100 Hz por convención y para que el contorno que
 * pinte la UI tenga números manejables.
 *
 * SE MIDE EN SEMITONOS Y NO EN Hz A PROPÓSITO. La F0 de un niño de 4 años ronda
 * los 280 Hz y la de uno de 9, los 230: en hercios, el mismo gesto entonativo
 * —subir una quinta— produce rangos muy distintos según la edad, y el módulo
 * estaría midiendo crecimiento laríngeo disfrazado de prosodia. El semitono es
 * logarítmico, así que una quinta son 7 semitonos a cualquier edad y a
 * cualquier sexo.
 */
export const SEMITONE_REF_HZ = 100;

/** Hz → semitonos sobre `SEMITONE_REF_HZ`. */
export const hzToSemitones = (hz: number): number =>
  12 * Math.log2(hz / SEMITONE_REF_HZ);

/**
 * Suelo del contorno de intensidad (dB). Evita `log10(0) = -Infinity` en el
 * silencio digital, que envenenaría cualquier media o desviación aguas abajo.
 */
export const INTENSITY_FLOOR_DB = -100;

/**
 * La intensidad de este módulo está en **dBFS** (0 dB = amplitud 1.0), no en
 * dB SPL como la de Praat, que asume la señal en pascales y suma ~94 dB. No es
 * un problema de comparabilidad porque **ninguna medida publicada usa el valor
 * absoluto**: el umbral de silencio es relativo al percentil alto de la propia
 * toma, el salto entre núcleos silábicos es una diferencia y la variación de
 * intensidad es una desviación típica. Todas invariantes a un desplazamiento
 * constante. Queda declarado para que la comparación con Praat en
 * `tools/acoustics/` no se interprete mal.
 */
export const INTENSITY_IS_DBFS = true;

/* -------------------------------------------------------------------------- */
/*  UMBRALES DE SEGMENTACIÓN                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Umbral de silencio, en dB POR DEBAJO del nivel alto de la toma (percentil 99
 * del contorno de intensidad). Es el criterio de De Jong & Wempe (2009) para
 * detección automática de sílabas, y es relativo a propósito: la captura de
 * micrófono en Android/iOS llega sin AGC y su nivel absoluto depende del
 * hardware y de la distancia al niño. Un umbral absoluto marcaría la toma
 * entera como pausa en un dispositivo de ganancia baja.
 */
export const SILENCE_THRESHOLD_DB = -28;

/**
 * Duración mínima de una pausa (s). Por debajo no es una pausa del habla: es
 * la oclusión de una consonante. Una /p/ o una /k/ cierran el tracto entre 50 y
 * 100 ms y producen un silencio acústico real; contarlas como pausas inflaría
 * el recuento hasta hacerlo inútil (decenas de «pausas» en cada frase) y
 * hundiría la tasa de articulación.
 */
export const PAUSE_MIN_SEC = 0.20;

/**
 * Caída mínima (dB) entre dos picos de intensidad para que cuenten como
 * núcleos silábicos distintos.
 */
export const SYLLABLE_DIP_DB = 1.8;

/**
 * Separación mínima entre núcleos silábicos (s). Cota de seguridad frente a
 * picos gemelos: ni el habla infantil más rápida pasa de ~8 sílabas/s.
 */
export const SYLLABLE_MIN_GAP_SEC = 0.10;

/**
 * Fracción del nivel alto (p95) por debajo de la cual una trama no se considera
 * candidata a voz.
 */
export const VOICED_RMS_FRACTION = 0.12;

/** Suelo absoluto de sonoridad (RMS). Solo descarta silencio digital. */
export const SILENCE_RMS = 0.0010;

/**
 * Suelo ABSOLUTO del umbral de silencio (dBFS) — equivalente de `SILENCE_RMS`.
 */
export const ABSOLUTE_SILENCE_DB = 20 * Math.log10(SILENCE_RMS);

/* -------------------------------------------------------------------------- */
/*  MÍNIMOS PARA PUBLICAR UNA MEDIDA                                           */
/* -------------------------------------------------------------------------- */

/** Tramo de habla mínimo (s) para publicar tasas de habla y articulación.
 *  Compatible con `MIN_SPEECH_SEC = 3`: el span va del primer al último núcleo
 *  silábico e incluye las pausas, luego nunca es menor que el habla acumulada. */
export const MIN_SPAN_FOR_RATE_SEC = 3;
/** Núcleos silábicos mínimos para publicar tasas. Con dos núcleos la «tasa»
 *  la fija un único intervalo: es una medida sin dispersión, no un promedio. */
export const MIN_SYLLABLES_FOR_RATE = 3;
/** Tramas sonoras mínimas para publicar estadística de F0. Por debajo de diez,
 *  la mediana y la desviación describen el ruido de estimación, no la voz. */
export const MIN_VOICED_FRAMES_FOR_F0 = 10;
/**
 * Ventana final (s) sobre la que se mide el contorno de cierre, contada hacia
 * atrás desde la última trama sonora.
 *
 * Se toman TODAS las tramas sonoras de esa ventana, no el último tramo sonoro
 * continuo. La diferencia importa: en español el final de enunciado lleva muy a
 * menudo una consonante sorda («pastel», «color»), que parte el tramo continuo
 * y dejaría el contorno reducido a dos o tres tramas —o a ninguna—. Midiendo
 * por ventana temporal, el gesto entonativo de cierre se captura tanto si
 * termina en vocal como si no.
 */
export const FINAL_CONTOUR_WINDOW_SEC = 0.5;
/** Tramas sonoras mínimas dentro de la ventana final para publicar el contorno. */
export const MIN_FINAL_CONTOUR_FRAMES = 4;

/* -------------------------------------------------------------------------- */
/*  Tipos                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Motivo por el que una medida no se ha podido publicar. Permite que la
 * pantalla diga POR QUÉ en vez de un «no disponible» genérico, igual que hace
 * el módulo de voz con `stats`.
 */
export type ProsodyReason =
  | 'ok'
  | 'empty'          // no hay PCM
  | 'silent'         // toma sin nada por encima del suelo de silencio
  | 'too-short'      // tramo de habla por debajo del mínimo
  | 'no-voicing';    // hay energía, pero ninguna trama periódica

/** Un tramo temporal de la toma (en segundos, relativo al inicio del PCM). */
export interface ProsodySegment {
  startSec: number;
  endSec: number;
}

/**
 * Métricas prosódicas. TODO campo derivado es `number | null`: `null` significa
 * «no medido», nunca «cero». Un recuento de pausas 0 y un recuento de pausas
 * `null` son clínicamente lo contrario, y confundirlos en el informe sería el
 * peor modo de fallo posible.
 */
export interface ProsodyMetrics {
  /** Duración total del PCM entregado (s). */
  durationSec: number;
  /** Del primer al último sonido por encima del suelo (s). Denominador de las
   *  tasas: el silencio previo a que el niño arranque no es habla lenta. */
  spanSec: number | null;
  /** Tiempo con energía por encima del suelo de silencio (s). */
  phonationTimeSec: number | null;
  /** Fracción de tramas periódicas sobre las tramas con energía. */
  voicedFraction: number | null;

  pauseCount: number | null;
  pauseTotalSec: number | null;
  pauseMeanSec: number | null;

  syllableCount: number | null;
  /** Sílabas por segundo sobre el tramo COMPLETO (pausas incluidas). */
  speechRateSps: number | null;
  /** Sílabas por segundo DESCONTANDO las pausas. */
  articulationRateSps: number | null;

  f0MedianHz: number | null;
  /** Rango tonal p5–p95 en semitonos. Los percentiles, y no mín–máx, porque un
   *  único fallo de octava o un chirrido arruinarían el extremo. */
  f0RangeSt: number | null;
  f0SdSt: number | null;
  /** Cambio neto de F0 (semitonos) en el último tramo sonoro. Positivo =
   *  ascenso final; negativo = descenso final. */
  finalContourSt: number | null;

  /** Desviación típica de la intensidad (dB) sobre las tramas con energía. */
  intensitySdDb: number | null;
}

/** Contornos por trama, para que la UI los dibuje. NO se persisten. */
export interface ProsodyContours {
  /** Tiempo (s) del centro de cada trama de F0. */
  f0TimesSec: Float64Array;
  /** F0 en semitonos; `NaN` en las tramas no sonoras. */
  f0St: Float64Array;
  /** Tiempo (s) del centro de cada trama de intensidad. */
  intensityTimesSec: Float64Array;
  /** Intensidad en dBFS. */
  intensityDb: Float64Array;
}

export interface ProsodyStats {
  reason: ProsodyReason;
  totalF0Frames: number;
  voicedF0Frames: number;
  /** Nivel alto de referencia del contorno de intensidad (dBFS, p99). */
  levelRefDb: number;
  /** Umbral de silencio efectivo (dBFS). */
  silenceThresholdDb: number;
}

export interface ProsodyResult {
  metrics: ProsodyMetrics;
  contours: ProsodyContours;
  pauses: ProsodySegment[];
  /** Instantes (s) de los núcleos silábicos detectados. */
  syllableTimesSec: number[];
  stats: ProsodyStats;
}

/* -------------------------------------------------------------------------- */
/*  Estadística auxiliar                                                       */
/* -------------------------------------------------------------------------- */

/** Percentil por interpolación lineal sobre una copia ordenada. */
export function percentile(values: number[], p: number): number {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  if (s.length === 1) return s[0];
  const idx = (s.length - 1) * Math.min(1, Math.max(0, p));
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

export function median(values: number[]): number {
  return percentile(values, 0.5);
}

/** Desviación típica muestral (n−1). Con menos de 2 valores no está definida. */
export function stdDev(values: number[]): number {
  if (values.length < 2) return NaN;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const ss = values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0);
  return Math.sqrt(ss / (values.length - 1));
}

/** Pendiente de la recta de mínimos cuadrados (unidades de y por unidad de x). */
export function linearSlope(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return NaN;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += ys[i];
  }
  const mx = sx / n;
  const my = sy / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    num += dx * (ys[i] - my);
    den += dx * dx;
  }
  return den > 0 ? num / den : NaN;
}

/* -------------------------------------------------------------------------- */
/*  Contorno de intensidad                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Contorno de intensidad (dBFS) por RMS de ventana deslizante. Determinista y
 * barato: es un solo recorrido con dos operaciones por muestra.
 */
export function intensityContour(pcm: Float32Array): Float64Array {
  if (pcm.length < INTENSITY_WINDOW) return new Float64Array(0);
  const n = Math.floor((pcm.length - INTENSITY_WINDOW) / INTENSITY_HOP) + 1;
  const out = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const off = k * INTENSITY_HOP;
    let energy = 0;
    for (let j = off; j < off + INTENSITY_WINDOW; j++) energy += pcm[j] * pcm[j];
    const rms = Math.sqrt(energy / INTENSITY_WINDOW);
    out[k] = rms > 0 ? Math.max(INTENSITY_FLOOR_DB, 20 * Math.log10(rms)) : INTENSITY_FLOOR_DB;
  }
  return out;
}

/** Tiempo (s) del CENTRO de la trama de intensidad `k`. */
export const intensityTime = (k: number): number =>
  (k * INTENSITY_HOP + INTENSITY_WINDOW / 2) / SAMPLE_RATE;

/** Tiempo (s) del CENTRO de la trama de F0 `i`. */
export const f0Time = (i: number): number =>
  (i * F0_HOP + F0_WINDOW / 2) / SAMPLE_RATE;

/* -------------------------------------------------------------------------- */
/*  Pausas                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Pausas INTERIORES al tramo de habla: rachas por debajo del umbral de silencio
 * que duran al menos `PAUSE_MIN_SEC`.
 *
 * El silencio anterior al primer sonido y posterior al último NO son pausas:
 * son el margen de la grabación. Contarlos como pausa penalizaría al clínico
 * que da al botón dos segundos antes de que el niño arranque, que es lo normal
 * en consulta. Por eso la búsqueda se restringe a `[firstActive, lastActive]`.
 */
export function detectPauses(
  intensityDb: Float64Array,
  thresholdDb: number,
): { pauses: ProsodySegment[]; firstActive: number; lastActive: number } {
  let firstActive = -1;
  let lastActive = -1;
  for (let k = 0; k < intensityDb.length; k++) {
    if (intensityDb[k] >= thresholdDb) {
      if (firstActive < 0) firstActive = k;
      lastActive = k;
    }
  }
  if (firstActive < 0) return { pauses: [], firstActive: -1, lastActive: -1 };

  const pauses: ProsodySegment[] = [];
  let runStart = -1;
  for (let k = firstActive; k <= lastActive; k++) {
    const silent = intensityDb[k] < thresholdDb;
    if (silent && runStart < 0) runStart = k;
    if (!silent && runStart >= 0) {
      const startSec = intensityTime(runStart);
      const endSec = intensityTime(k);
      if (endSec - startSec >= PAUSE_MIN_SEC) pauses.push({ startSec, endSec });
      runStart = -1;
    }
  }
  // No se cierra ninguna racha al final: por construcción `lastActive` está por
  // encima del umbral, así que nunca queda una pausa abierta.
  return { pauses, firstActive, lastActive };
}

/* -------------------------------------------------------------------------- */
/*  Núcleos silábicos                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Núcleos silábicos por picos de intensidad (método de De Jong & Wempe, 2009),
 * con los tres filtros del método:
 *
 *  1. **Por encima del umbral de silencio** — un pico dentro de una pausa es
 *     ruido de sala, no una sílaba.
 *  2. **Caída de al menos `SYLLABLE_DIP_DB`** respecto al pico anterior — sin
 *     esto, la ondulación de la envolvente DENTRO de una vocal larga se contaría
 *     como varias sílabas. Es el filtro que hace funcionar el método.
 *  3. **Sonoro** — el núcleo de una sílaba española es siempre una vocal. Un
 *     pico de energía sin periodicidad es una fricativa o un golpe de mesa.
 *
 * `isVoicedAtSample` traslada el contorno de F0 (paso de 32 ms) a la rejilla de
 * intensidad (paso de 10 ms) por trama más cercana.
 */
export function detectSyllableNuclei(
  intensityDb: Float64Array,
  thresholdDb: number,
  isVoicedAtFrame: (k: number) => boolean,
): number[] {
  const minGapFrames = Math.round((SYLLABLE_MIN_GAP_SEC * SAMPLE_RATE) / INTENSITY_HOP);
  const peaks: number[] = [];

  for (let k = 1; k < intensityDb.length - 1; k++) {
    if (intensityDb[k] < thresholdDb) continue;
    // Máximo local (con `>=` a la derecha para no perder mesetas de dos puntos).
    if (!(intensityDb[k] > intensityDb[k - 1] && intensityDb[k] >= intensityDb[k + 1])) continue;
    if (!isVoicedAtFrame(k)) continue;

    if (!peaks.length) {
      peaks.push(k);
      continue;
    }
    const prev = peaks[peaks.length - 1];

    // Valle entre este pico y el anterior: si no baja lo suficiente, los dos
    // picos pertenecen al mismo núcleo y se conserva el más alto.
    let valley = Infinity;
    for (let j = prev + 1; j < k; j++) if (intensityDb[j] < valley) valley = intensityDb[j];
    const dip = Math.min(intensityDb[prev], intensityDb[k]) - valley;

    if (dip >= SYLLABLE_DIP_DB && k - prev >= minGapFrames) {
      peaks.push(k);
    } else if (intensityDb[k] > intensityDb[prev]) {
      peaks[peaks.length - 1] = k;
    }
  }
  return peaks;
}

/* -------------------------------------------------------------------------- */
/*  Análisis completo                                                          */
/* -------------------------------------------------------------------------- */

const yieldToEventLoop = () => new Promise<void>(resolve => setTimeout(resolve, 0));

/** Resultado vacío, para las salidas tempranas (toma vacía o en silencio). */
function emptyResult(durationSec: number, reason: ProsodyReason): ProsodyResult {
  return {
    metrics: {
      durationSec,
      spanSec: null,
      phonationTimeSec: null,
      voicedFraction: null,
      pauseCount: null,
      pauseTotalSec: null,
      pauseMeanSec: null,
      syllableCount: null,
      speechRateSps: null,
      articulationRateSps: null,
      f0MedianHz: null,
      f0RangeSt: null,
      f0SdSt: null,
      finalContourSt: null,
      intensitySdDb: null,
    },
    contours: {
      f0TimesSec: new Float64Array(0),
      f0St: new Float64Array(0),
      intensityTimesSec: new Float64Array(0),
      intensityDb: new Float64Array(0),
    },
    pauses: [],
    syllableTimesSec: [],
    stats: {
      reason,
      totalF0Frames: 0,
      voicedF0Frames: 0,
      levelRefDb: INTENSITY_FLOOR_DB,
      silenceThresholdDb: INTENSITY_FLOOR_DB,
    },
  };
}

/**
 * Análisis prosódico de una toma de habla conectada.
 *
 * Asíncrono y con cesión periódica del hilo, igual que `analysePcm`: sobre 60 s
 * de audio el contorno de F0 son ~1.900 ventanas de autocorrelación, y
 * ejecutarlas de una pieza congelaría la pantalla durante segundos. La cesión
 * va en el bucle de F0, que es el único caro (el de intensidad es un RMS).
 *
 * @param raw PCM mono a **16 kHz**. Se acondiciona internamente; el PCM que se
 *            entrega NO se modifica.
 */
export async function analyseProsody(raw: Float32Array): Promise<ProsodyResult> {
  const durationSec = raw.length / SAMPLE_RATE;
  if (!raw.length) return emptyResult(0, 'empty');

  // Acondicionado obligatorio, por el mismo motivo que en `voiceDsp`: la deriva
  // de baja frecuencia dispara el RMS de las tramas silenciosas (y con él, el
  // umbral de pausa) y dobla la F0 de las sonoras.
  const pcm = conditionForAnalysis(raw);

  /* ------------------------- contorno de intensidad ------------------------ */
  const intensityDb = intensityContour(pcm);
  if (!intensityDb.length) return emptyResult(durationSec, 'too-short');

  const levelRefDb = percentile(Array.from(intensityDb), 0.99);
  // Umbral relativo al nivel de la toma, pero NUNCA por debajo del suelo
  // absoluto: si no, una toma en silencio se declara habla entera (ver
  // `ABSOLUTE_SILENCE_DB`).
  const thresholdDb = Math.max(levelRefDb + SILENCE_THRESHOLD_DB, ABSOLUTE_SILENCE_DB);

  const { pauses, firstActive, lastActive } = detectPauses(intensityDb, thresholdDb);
  if (firstActive < 0) return emptyResult(durationSec, 'silent');

  /* ---------------------------- contorno de F0 ---------------------------- */
  // Umbral de sonoridad en RMS, con el mismo criterio relativo que `analysePcm`.
  const levelRefRms = Math.pow(10, levelRefDb / 20);
  const minRms = Math.max(SILENCE_RMS, levelRefRms * VOICED_RMS_FRACTION);

  const totalF0Frames =
    pcm.length >= F0_WINDOW ? Math.floor((pcm.length - F0_WINDOW) / F0_HOP) + 1 : 0;
  const f0TimesSec = new Float64Array(totalF0Frames);
  const f0St = new Float64Array(totalF0Frames);
  const f0Hz: number[] = [];

  let sinceYield = 0;
  for (let i = 0; i < totalF0Frames; i++) {
    const off = i * F0_HOP;
    f0TimesSec[i] = f0Time(i);
    const frame = analyseFrame(pcm.subarray(off, off + F0_WINDOW), minRms);
    if (frame) {
      f0St[i] = hzToSemitones(frame.f0);
      f0Hz.push(frame.f0);
    } else {
      f0St[i] = NaN;
    }
    if (++sinceYield >= 8) {
      sinceYield = 0;
      await yieldToEventLoop();
    }
  }

  const voicedF0Frames = f0Hz.length;
  const stats: ProsodyStats = {
    reason: voicedF0Frames ? 'ok' : 'no-voicing',
    totalF0Frames,
    voicedF0Frames,
    levelRefDb,
    silenceThresholdDb: thresholdDb,
  };

  /* ------------------------------- duraciones ------------------------------ */
  const spanSec = intensityTime(lastActive) - intensityTime(firstActive);
  const frameSec = INTENSITY_HOP / SAMPLE_RATE;
  let activeFrames = 0;
  const activeDb: number[] = [];
  for (let k = firstActive; k <= lastActive; k++) {
    if (intensityDb[k] >= thresholdDb) {
      activeFrames++;
      activeDb.push(intensityDb[k]);
    }
  }
  const phonationTimeSec = activeFrames * frameSec;
  const pauseTotalSec = pauses.reduce((acc, p) => acc + (p.endSec - p.startSec), 0);

  /* ---------------------------- núcleos silábicos -------------------------- */
  // Traslado de la rejilla de F0 (32 ms) a la de intensidad (10 ms) por trama
  // más cercana: `centro_intensidad = i·F0_HOP + F0_WINDOW/2` ⇒ despejando i.
  const isVoicedAtFrame = (k: number): boolean => {
    if (!totalF0Frames) return false;
    const centre = k * INTENSITY_HOP + INTENSITY_WINDOW / 2;
    const i = Math.round((centre - F0_WINDOW / 2) / F0_HOP);
    const clamped = Math.min(totalF0Frames - 1, Math.max(0, i));
    return !Number.isNaN(f0St[clamped]);
  };

  const syllableFrames = detectSyllableNuclei(intensityDb, thresholdDb, isVoicedAtFrame);
  const syllableTimesSec = syllableFrames.map(intensityTime);

  /* --------------------------------- tasas -------------------------------- */
  // Se publican solo si el tramo da para que signifiquen algo (ver la sección
  // de mínimos). Una tasa sobre 1.5 s de audio es un número plausible y falso.
  const ratesPublishable =
    spanSec >= MIN_SPAN_FOR_RATE_SEC && syllableTimesSec.length >= MIN_SYLLABLES_FOR_RATE;
  const articulationSpan = spanSec - pauseTotalSec;
  const speechRateSps = ratesPublishable ? syllableTimesSec.length / spanSec : null;
  const articulationRateSps =
    ratesPublishable && articulationSpan > 0 ? syllableTimesSec.length / articulationSpan : null;

  /* ------------------------------ contorno F0 ------------------------------ */
  const f0Publishable = voicedF0Frames >= MIN_VOICED_FRAMES_FOR_F0;
  const f0StValues = f0Hz.map(hzToSemitones);
  const f0MedianHz = f0Publishable ? median(f0Hz) : null;
  const f0RangeSt = f0Publishable
    ? percentile(f0StValues, 0.95) - percentile(f0StValues, 0.05)
    : null;
  const f0SdSt = f0Publishable ? stdDev(f0StValues) : null;

  /* ---------------------------- contorno final ----------------------------- */
  // Ventana final de `FINAL_CONTOUR_WINDOW_SEC` hacia atrás desde la última
  // trama sonora. Ahí vive la marca entonativa que distingue una pregunta de
  // una afirmación, y la que más se aplana en el habla monótona.
  let finalContourSt: number | null = null;
  if (f0Publishable) {
    let end = -1;
    for (let i = totalF0Frames - 1; i >= 0; i--) {
      if (!Number.isNaN(f0St[i])) {
        end = i;
        break;
      }
    }
    if (end >= 0) {
      const fromSec = f0TimesSec[end] - FINAL_CONTOUR_WINDOW_SEC;
      const xs: number[] = [];
      const ys: number[] = [];
      for (let i = 0; i <= end; i++) {
        if (f0TimesSec[i] >= fromSec && !Number.isNaN(f0St[i])) {
          xs.push(f0TimesSec[i]);
          ys.push(f0St[i]);
        }
      }
      if (xs.length >= MIN_FINAL_CONTOUR_FRAMES) {
        const slope = linearSlope(xs, ys); // semitonos por segundo
        // Cambio NETO sobre el tramo medido, no la pendiente: es lo
        // interpretable clínicamente («cae 4 semitonos al final») y no depende
        // de cuánto dure el tramo, como sí dependería una pendiente.
        const spanFit = xs[xs.length - 1] - xs[0];
        if (!Number.isNaN(slope)) finalContourSt = slope * spanFit;
      }
    }
  }

  /* ------------------------------- resultado ------------------------------- */
  const intensityTimesSec = new Float64Array(intensityDb.length);
  for (let k = 0; k < intensityDb.length; k++) intensityTimesSec[k] = intensityTime(k);

  return {
    metrics: {
      durationSec,
      spanSec,
      phonationTimeSec,
      voicedFraction: totalF0Frames ? voicedF0Frames / totalF0Frames : null,
      pauseCount: pauses.length,
      pauseTotalSec,
      pauseMeanSec: pauses.length ? pauseTotalSec / pauses.length : null,
      syllableCount: syllableTimesSec.length,
      speechRateSps,
      articulationRateSps,
      f0MedianHz,
      f0RangeSt,
      f0SdSt,
      finalContourSt,
      intensitySdDb: activeDb.length >= 2 ? stdDev(activeDb) : null,
    },
    contours: { f0TimesSec, f0St, intensityTimesSec, intensityDb },
    pauses,
    syllableTimesSec,
    stats,
  };
}
