/* -------------------------------------------------------------------------- */
/*  Contrato de identidad del corpus de voz (lógica PURA, sin RN/UI).           */
/*                                                                             */
/*  Portado del blueprint «Arquitectura de corpus de voz neuronal NÓS/ILENIA»  */
/*  (Valeria+, docs/design/arquitectura-corpus-voz.md). Es la ÚNICA función    */
/*  que calcula el id de una locución y DEBE ser idéntica en build-time (al    */
/*  enumerar el corpus) y en runtime (al resolver el asset): ambos importan    */
/*  este mismo módulo. Si diverge, el mapa deja de resolver y la locución cae  */
/*  limpiamente a la voz del sistema (nunca rompe).                            */
/*                                                                             */
/*  Id = hash del CONTENIDO (estilo + texto normalizado) [+ prefijo idioma].   */
/*  Propiedades (invariantes del blueprint P4):                                */
/*   · si un texto cambia en el código, su id cambia → cae al motor del        */
/*     sistema; la deriva DEGRADA calidad, nunca rompe;                        */
/*   · el estilo (prosodia/velocidad) se hornea en el audio: un mismo texto    */
/*     en dos estilos son DOS entradas con ids distintos;                      */
/*   · el idioma base (es) NO lleva prefijo (retro-compat de assets ya         */
/*     sintetizados); las demás lenguas prefijan `${lang}_`.                   */
/* -------------------------------------------------------------------------- */

/** Estilo prosódico horneado en el audio (velocidad/registro). */
export type VoiceStyle = 'tutor' | 'child' | 'clinical' | 'slow';

/** Lenguas/variantes locutables de VIA+: castellano, gallego, dominicano. */
export type VoiceLang = 'es' | 'gl' | 'es-DO';

/** Todas las lenguas del corpus (orden estable para estadísticas). */
export const VOICE_LANGS: readonly VoiceLang[] = ['es', 'gl', 'es-DO'];

/** Idioma base sin prefijo de id (retro-compat de assets ya sintetizados). */
export const VOICE_BASE_LANG: VoiceLang = 'es';

/** Estilos válidos (para validar corpus y tests). */
export const VOICE_STYLES: readonly VoiceStyle[] = ['tutor', 'child', 'clinical', 'slow'];

/**
 * Normaliza el texto para el hash: los espacios no cambian la locución, todo
 * lo demás sí. Colapsa espacios/blancos y recorta bordes (idéntico a Valeria).
 */
export const normalizeVoiceText = (text: string): string => text.replace(/\s+/g, ' ').trim();

/**
 * FNV-1a de 32 bits en hex (8 dígitos). Estable entre plataformas (opera sobre
 * las unidades UTF-16 de `charCodeAt`); suficiente para ~10k entradas sin
 * colisiones prácticas. La multiplicación por el primo FNV (16777619) se hace
 * con desplazamientos para no perder precisión en el entero de 32 bits.
 */
/* eslint-disable no-bitwise -- aritmética de 32 bits inherente al hash FNV-1a */
export const fnv1a32 = (str: string): string => {
  let h = 0x811c9dc5; // offset basis FNV-1a
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    // h = (h * 16777619) mod 2^32, vía sumas de desplazamientos.
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    h >>>= 0; // mantener uint32
  }
  return h.toString(16).padStart(8, '0');
};
/* eslint-enable no-bitwise */

/** Prefijo de id por idioma: vacío en la base (es), `${lang}_` en el resto. */
export const voiceLangPrefix = (lang: VoiceLang): string =>
  lang === VOICE_BASE_LANG ? '' : `${lang}_`;

/**
 * Id estable de una locución = `[${lang}_]${style}_${hash}_${len}`.
 *   · `style`  — prosodia horneada (dos estilos = dos ids);
 *   · `hash`   — FNV-1a del texto normalizado;
 *   · `len`    — longitud del texto normalizado (desambiguación barata);
 *   · prefijo  — `${lang}_` salvo en la base `es` (sin prefijo).
 * La misma entrada produce SIEMPRE el mismo id → asset reproducible y diffs
 * mínimos en git (solo cambian las cadenas tocadas).
 */
export const voiceCorpusId = (
  style: VoiceStyle,
  text: string,
  lang: VoiceLang = VOICE_BASE_LANG,
): string => {
  const norm = normalizeVoiceText(text);
  return `${voiceLangPrefix(lang)}${style}_${fnv1a32(norm)}_${norm.length}`;
};
