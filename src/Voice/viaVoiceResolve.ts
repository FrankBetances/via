import { VOICE_ASSETS } from './viaVoiceAssets';
import {
  VOICE_BASE_LANG,
  VOICE_LANGS,
  VOICE_LANG_BASE,
  VoiceLang,
  VoiceStyle,
  voiceCorpusId,
} from './voiceCorpusId';

/* -------------------------------------------------------------------------- */
/*  Resolución de assets de voz (lógica PURA, testeable sin módulo nativo).     */
/*                                                                             */
/*  Separada del runtime (`viaVoice.ts`, que toca audio nativo) para poder      */
/*  probar la cadena de fallback de ASSETS de forma determinista. Usa la MISMA  */
/*  `voiceCorpusId` que el build (invariante del blueprint).                    */
/*                                                                             */
/*  La correspondencia texto↔voz vive en `viaVoiceLocale.ts` (módulo puro que   */
/*  no puede colgar del mapa de assets porque lo compila el exportador del      */
/*  corpus en Node).                                                            */
/* -------------------------------------------------------------------------- */

/** Normaliza el idioma de sesión (string arbitrario) a una `VoiceLang`. */
export const toVoiceLang = (lang: string | null | undefined): VoiceLang =>
  (VOICE_LANGS as readonly string[]).includes(lang ?? '') ? (lang as VoiceLang) : VOICE_BASE_LANG;

/**
 * Módulo del asset pre-sintetizado de una locución.
 *
 * `lang` es la lengua DEL TEXTO (la que devuelve `resolveSpokenText`), no la de
 * la sesión. La cadena de fallback es por tanto muy corta:
 *   1. asset de esa lengua;
 *   2. si es una VARIANTE (es-DO), asset de su base (`es`): mismo idioma, otro
 *      acento — degradación acotada y honesta;
 *   3. `null` → el runtime usa la voz del sistema EN ESA MISMA LENGUA.
 *
 * Antes el paso 2 valía para CUALQUIER lengua: una sesión gallega resolvía al
 * recorte castellano y lo presentaba como gallego. Un idioma completo ya no
 * cruza al banco base: o suena en su lengua, o no suena en ella. Es la misma
 * regla que la audiometría verbal aplicaba ya a sus recortes
 * (`verbalAssetsByLang.ts`), que era el módulo que sí estaba bien cableado.
 */
export const resolveVoiceAsset = (
  style: VoiceStyle,
  text: string,
  lang: VoiceLang,
): number | null => {
  const own = VOICE_ASSETS[voiceCorpusId(style, text, lang)];
  if (own != null) return own;
  const base = VOICE_LANG_BASE[lang];
  if (base != null) {
    const inherited = VOICE_ASSETS[voiceCorpusId(style, text, base)];
    if (inherited != null) return inherited;
  }
  return null;
};

/**
 * ¿Hay locuciones pre-sintetizadas empaquetadas? Mientras el pipeline de voz
 * no haya poblado `VOICE_ASSETS`, la única vía es el TTS del sistema; la UI lo
 * usa para no ofrecer un botón de altavoz que no sonaría.
 */
export const hasVoiceAssets = (): boolean => Object.keys(VOICE_ASSETS).length > 0;
