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
  f0: { min: 220, max: 320 }, // Hz
  jitter: { max: 1.04 }, // %
  shimmer: { max: 3.81 }, // %
  hnr: { min: 12 }, // dB
} as const;

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
