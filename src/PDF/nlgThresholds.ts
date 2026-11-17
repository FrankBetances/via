/* -------------------------------------------------------------------------- */
/*  Umbrales clínicos de VIA+: una sola fuente para la pantalla y el informe.  */
/*                                                                            */
/*  Hasta el 2/11/2026 había dos juegos de cifras: el del plan del motor en   */
/*  `nlgReportEngine.ts` y el de siempre en las pantallas (`VOICE_NORMS`,     */
/*  `severityOf`, `DISCRIMINATION_WARN_CUT`, `EF_OK_CUT`). La misma toma de   */
/*  voz salía con indicador amarillo y texto «dentro de los intervalos de     */
/*  referencia», y un PTA de 65 dB era «pérdida severa» en la tarjeta y       */
/*  «entre 41 y 70» en la síntesis. Frank fijó que mandan las del plan        */
/*  (`docs/PLAN_NLG_ENGINE.md` §5) y firma las reglas                         */
/*  (`docs/design/matriz-evidencia-nlg.md`). Todo lo que pinte o redacte un   */
/*  corte clínico lo lee de aquí; `nlgThresholdParity.test.ts` lo vigila.     */
/*                                                                            */
/*  Módulo puro: sin React, sin catálogo, sin pantallas.                      */
/* -------------------------------------------------------------------------- */

/** Frecuencias que guarda la audiometría tonal. */
export const AUDIO_FREQS = [500, 1000, 2000, 4000] as const;

/** Nivel máximo de salida de la prueba tonal (dB HL). */
export const AUDIO_MAX_DB = 80;

/** Bandas del PTA (dB HL), BIAP 02/1 bis según el plan. */
export const PTA_REF_MAX = 20;
export const PTA_BAND_MILD_MAX = 40;
export const PTA_BAND_MODERATE_MAX = 70;
export const PTA_BAND_SEVERE_MAX = 90;

/** Margen de morfología de la curva (4000 Hz − 500 Hz). */
export const MORPH_DB = 15;
/** Umbral en agudos para la regla cruzada audición × fricativas. */
export const ACUTE_DB = 25;

/**
 * Voz: intervalo de referencia del plan. Ojo: el shimmer de VIA+ sale
 * comprimido entre 1,3 y 1,7 veces respecto a Praat (`tools/acoustics/README.md`)
 * y este corte está en la escala de Praat. Riesgo anotado en la matriz.
 */
export const VOICE_REF = {
  f0: { min: 200, max: 320 }, // Hz
  jitter: { max: 1.0 }, // %
  shimmer: { max: 3.0 }, // %
  hnr: { min: 20 }, // dB
} as const;

/**
 * Rótulo de referencia que se pinta junto a cada parámetro de voz. Sale de
 * `VOICE_REF` para que el rótulo y el color no puedan volver a divergir.
 * Decisión de Frank (17/11/2026): «el color usa las cifras de los rótulos»;
 * antes el color iba con 220–320 Hz, 1,04 %, 3,81 % y 12 dB y el rótulo decía
 * 200–320 Hz, < 1.0 %, < 3.0 % y > 20 dB.
 */
export const VOICE_REF_LABEL = {
  f0: `${VOICE_REF.f0.min}–${VOICE_REF.f0.max} Hz`,
  jitter: `< ${VOICE_REF.jitter.max.toFixed(1)} %`,
  shimmer: `< ${VOICE_REF.shimmer.max.toFixed(1)} %`,
  hnr: `> ${VOICE_REF.hnr.min} dB`,
} as const;

/**
 * Articulación (T.A.R.): semáforo del % de producción correcta. Verde desde
 * `ok`, ámbar desde `warn`, rojo por debajo. Lo usan la pantalla de la prueba,
 * las tarjetas de resultados (preliminares y finales) y el PDF.
 * Decisión de Frank (17/11/2026): 90/70 en los cinco sitios. Antes la pantalla
 * de la prueba y el PDF usaban 85/60 y las tarjetas 90/70. Sin fuente
 * bibliográfica registrada (ver la matriz de evidencia).
 */
export const TAR_PCT = { ok: 90, warn: 70 } as const;

/** Estado del semáforo del T.A.R. para un % de producción correcta. */
export const tarStatus = (pct: number): 'ok' | 'warn' | 'alt' =>
  pct >= TAR_PCT.ok ? 'ok' : pct >= TAR_PCT.warn ? 'warn' : 'alt';

/** Audiometría verbal: reconocimiento por debajo del cual se deriva. */
export const DISC_MIN = 80;
/** Nivel conversacional persistido por la prueba verbal (dB). */
export const CONV_LEVEL = 65;
/** Diferencia máxima URV − mejor PTA antes de señalar disociación. */
export const SRT_MARGIN = 15;

/** Funciones ejecutivas: dominio por debajo del umbral orientativo. */
export const EF_DOMAIN_CUT = 65;
/** Funciones ejecutivas: índice global para la regla cruzada con SAHS. */
export const EF_OVERALL_CROSS = 70;

/** M-CHAT-R: entrevista de seguimiento desde 3, derivación desde 8. */
export const MCHAT_FOLLOW = 3;
export const MCHAT_REFER = 8;
