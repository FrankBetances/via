import { ImageSourcePropType } from 'react-native';

import { verbalAudioBase64, verbalAudioSource, verbalImageSource } from './verbalAssets';
import { VERBAL_AUDIO_BASE64_ES_DO } from './verbalAudioClips.es-DO';
import { VERBAL_GLYPHS } from './verbalAudiometryGlyphs';
import { VERBAL_GLYPHS_EU } from './verbalAudiometryLists.eu';
import { VERBAL_GLYPHS_GL } from './verbalAudiometryLists.gl';

/* -------------------------------------------------------------------------- */
/*  Accesores de assets por IDIOMA/VARIANTE de la sesión (infra Q1.3/Q1.4).    */
/*                                                                             */
/*  · AUDIO: cada idioma/variante tiene sus recortes propios (misma clave, voz */
/*    distinta — Q4.1/T4.1).                                                    */
/*      - es-DO: si le falta un recorte, degrada al del español base (mejor un */
/*        estímulo con otro acento que el silencio; es una VARIANTE del mismo  */
/*        idioma y la mezcla queda acotada a la clave ausente).                */
/*      - gl: NO degrada a los recortes castellanos. Es otro idioma: reproducir*/
/*        «ventá» con el recorte de «ventana» sería un estímulo distinto del   */
/*        que se puntúa. Sin recorte gallego (pendiente de la síntesis con la  */
/*        voz Celtia, T4.1) devuelve `null` y el adaptador degrada a la voz    */
/*        del sistema, que es la degradación honesta.                           */
/*  · IMÁGENES: se resuelven por CLAVE de asset. es-DO hereda el 100 % del     */
/*    castellano; el gallego reutiliza las ilustraciones cuya palabra coincide */
/*    (pan, gato, pelota…) y para el resto la tarjeta cae a pictograma y luego */
/*    a inicial (WordCard ya lo hace).                                          */
/* -------------------------------------------------------------------------- */

/**
 * Idiomas COMPLETOS (no variantes del castellano) sin locuciones propias
 * todavía. No degradan a los recortes castellanos: reproducir «mahai» con el
 * recorte de «mesa» sería un estímulo distinto del que se puntúa. Devuelven
 * `null` y el adaptador degrada a la voz del sistema, que es la degradación
 * honesta (y la pantalla lo advierte).
 */
const LANGS_WITHOUT_CLIPS = ['gl', 'eu'];

/** Recorte base64 de la palabra en la voz del idioma indicado. */
export const verbalAudioBase64ForLang = (audioKey: string, lang?: string): string | null => {
  if (lang === 'es-DO') {
    return VERBAL_AUDIO_BASE64_ES_DO[audioKey] ?? verbalAudioBase64(audioKey);
  }
  if (lang && LANGS_WITHOUT_CLIPS.includes(lang)) return null;
  return verbalAudioBase64(audioKey);
};

/** Ruta local del recorte (vía secundaria; ver nota de degradación arriba). */
export const verbalAudioSourceForLang = (audioKey: string, lang?: string): string | null => {
  if (lang && LANGS_WITHOUT_CLIPS.includes(lang)) return null;
  return verbalAudioSource(audioKey);
};

/**
 * Ilustración de una opción. La clave de asset ya es común entre idiomas
 * (`assetKeyForWord`), así que una palabra que coincide reutiliza el archivo
 * castellano sin duplicarlo; si no existe, `undefined` y la tarjeta degrada.
 */
export const verbalImageSourceForLang = (
  imageKey: string,
  _lang?: string,
): ImageSourcePropType | undefined => verbalImageSource(imageKey);

/** Pictogramas propios de cada idioma completo (los coincidentes con el banco
 *  castellano se resuelven por el mapa base). */
const GLYPHS_BY_LANG: Record<string, Record<string, string>> = {
  gl: VERBAL_GLYPHS_GL,
  eu: VERBAL_GLYPHS_EU,
};

/**
 * Pictograma provisional de una palabra en el idioma de la sesión. El gallego
 * y el euskera aportan los suyos para las palabras que no existen en el banco
 * castellano y reutilizan el mapa castellano en las que sí (pan, gato, casa…).
 */
export const verbalGlyphForLang = (word: string, lang?: string): string | undefined =>
  (lang ? GLYPHS_BY_LANG[lang]?.[word] : undefined) ?? VERBAL_GLYPHS[word];
