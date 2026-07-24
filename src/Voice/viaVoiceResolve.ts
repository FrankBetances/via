import { VOICE_ASSETS } from './viaVoiceAssets';
import { VOICE_BASE_LANG, VOICE_LANGS, VoiceLang, VoiceStyle, voiceCorpusId } from './voiceCorpusId';

/* -------------------------------------------------------------------------- */
/*  Resolución de assets de voz (lógica PURA, testeable sin módulo nativo).     */
/*                                                                             */
/*  Separada del runtime (`viaVoice.ts`, que toca audio nativo) para poder      */
/*  probar la cadena de fallback de ASSETS de forma determinista. Usa la MISMA  */
/*  `voiceCorpusId` que el build (invariante del blueprint).                    */
/* -------------------------------------------------------------------------- */

/** Normaliza el idioma de sesión (string arbitrario) a una `VoiceLang`. */
export const toVoiceLang = (lang: string | null | undefined): VoiceLang =>
  (VOICE_LANGS as readonly string[]).includes(lang ?? '') ? (lang as VoiceLang) : VOICE_BASE_LANG;

/**
 * Módulo del asset pre-sintetizado de una locución, con la cadena de fallback
 * de assets del blueprint:
 *   1. asset de la lengua pedida;
 *   2. asset base `es` (audio neuronal de un banco compartido antes que caer a
 *      la voz del sistema con un locale sin voz instalada).
 * `null` si no hay asset para ninguno de los dos (→ el runtime usa la voz del
 * sistema).
 */
export const resolveVoiceAsset = (
  style: VoiceStyle,
  text: string,
  lang: VoiceLang,
): number | null => {
  const own = VOICE_ASSETS[voiceCorpusId(style, text, lang)];
  if (own != null) return own;
  if (lang !== VOICE_BASE_LANG) {
    const base = VOICE_ASSETS[voiceCorpusId(style, text, VOICE_BASE_LANG)];
    if (base != null) return base;
  }
  return null;
};
