import { ImageSourcePropType } from 'react-native';

import { verbalAudioBase64, verbalAudioSource, verbalImageSource } from './verbalAssets';
import { VERBAL_AUDIO_BASE64_ES_DO } from './verbalAudioClips.es-DO';

/* -------------------------------------------------------------------------- */
/*  Accesores de assets por IDIOMA/VARIANTE de la sesión (infra Q1.3/Q1.4).    */
/*                                                                             */
/*  · AUDIO: cada variante tiene sus recortes propios (misma clave, voz        */
/*    distinta — Q4.1). Si a una variante le falta un recorte, degrada al      */
/*    recorte del español base (mejor un estímulo con otro acento que el       */
/*    silencio; la mezcla queda acotada a la clave ausente).                   */
/*  · IMÁGENES: la variante hereda las ilustraciones del español base salvo    */
/*    sustitución explícita (hoy es-DO hereda el 100 %; cuando Q3.3 introduzca */
/*    láminas propias, este accesor resolverá primero el registro es-DO).      */
/* -------------------------------------------------------------------------- */

/** Recorte base64 de la palabra en la voz del idioma indicado. */
export const verbalAudioBase64ForLang = (audioKey: string, lang?: string): string | null => {
  if (lang === 'es-DO') {
    return VERBAL_AUDIO_BASE64_ES_DO[audioKey] ?? verbalAudioBase64(audioKey);
  }
  return verbalAudioBase64(audioKey);
};

/** Ruta local del recorte (vía secundaria; las variantes degradan a la base). */
export const verbalAudioSourceForLang = (audioKey: string, _lang?: string): string | null =>
  verbalAudioSource(audioKey);

/** Ilustración de una opción (las variantes heredan las imágenes de es). */
export const verbalImageSourceForLang = (
  imageKey: string,
  _lang?: string,
): ImageSourcePropType | undefined => verbalImageSource(imageKey);
