/* -------------------------------------------------------------------------- */
/*  Ganancia de reproducción de las tomas de micrófono.                        */
/*                                                                            */
/*  La captura de VIA+ pide al sistema el modo «measurement» (sin AGC ni       */
/*  realce), que es lo que hace que la medida acústica sea comparable entre    */
/*  dispositivos. El precio es que la toma llega MUY floja: un pico de ~0,03   */
/*  (≈ −30 dBFS) es normal a distancia de exploración. Reproducirla tal cual   */
/*  por el altavoz de una tableta es casi inaudible, y el clínico no puede     */
/*  contrastar de oído lo que la pantalla le está midiendo.                    */
/*                                                                            */
/*  Esto NO toca la señal que se analiza: se aplica SOLO en el momento de      */
/*  reproducir. El análisis sigue corriendo sobre el PCM crudo, que es el      */
/*  único que conserva el nivel real de la toma.                               */
/* -------------------------------------------------------------------------- */

/** Pico objetivo tras normalizar: −1,5 dBFS. Deja margen para que la          */
/*  interpolación de la re-expansión no llegue a recortar.                     */
export const PLAYBACK_TARGET_PEAK = 0.85;

/**
 * Tope de amplificación. Sin él, una toma de silencio digital (pico ~0,001)
 * pediría ×850 y devolvería el suelo de ruido del micrófono a todo volumen
 * delante de un niño.
 */
export const PLAYBACK_MAX_GAIN = 25;

/**
 * Suelo por debajo del cual NO se amplifica: la toma es silencio o ruido de
 * fondo remoto, y subirla no hace audible una voz que no está.
 */
export const PLAYBACK_MIN_PEAK = 0.002;

/**
 * Ganancia que lleva el pico de la toma a `PLAYBACK_TARGET_PEAK`, acotada por
 * `PLAYBACK_MAX_GAIN`. Devuelve 1 si la toma está por debajo del suelo (nada
 * que amplificar) o si está vacía.
 */
export function playbackNormalizationGain(pcm: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < pcm.length; i++) {
    const v = Math.abs(pcm[i]);
    if (v > peak) peak = v;
  }
  if (peak <= PLAYBACK_MIN_PEAK) return 1;
  return Math.min(PLAYBACK_MAX_GAIN, PLAYBACK_TARGET_PEAK / peak);
}

/** Acota una muestra ya amplificada al rango válido de un canal de audio. */
export const clampSample = (v: number): number => (v > 1 ? 1 : v < -1 ? -1 : v);
