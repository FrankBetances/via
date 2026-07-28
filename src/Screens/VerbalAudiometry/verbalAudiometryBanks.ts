import { VERBAL_BANDS, VerbalBandDef } from './verbalAudiometryLists';
import { ES_DO_VERBAL_BANDS } from './verbalAudiometryLists.es-DO';
import { GL_VERBAL_BANDS } from './verbalAudiometryLists.gl';

/* -------------------------------------------------------------------------- */
/*  Selector del banco de estímulos por idioma/variante (infra M1/Q1 · Nós M3).*/
/*                                                                             */
/*  Punto único de registro de los bancos verbales: `es` (base), `es-DO`       */
/*  (Quisqueya Habla, herencia + sustitución selectiva) y `gl` (banco PROPIO   */
/*  diseñado sobre la fonología del gallego, plan Nós M3). El pipeline de      */
/*  assets (`scripts/verbal-assets.js --lang`) y los tests consumen este       */
/*  módulo para que listas y assets no diverjan.                               */
/* -------------------------------------------------------------------------- */

export type VerbalLang = 'es' | 'es-DO' | 'gl';

/** Idiomas/variantes con banco registrado. */
export const VERBAL_BANK_LANGS: readonly VerbalLang[] = ['es', 'gl', 'es-DO'];

/**
 * Idioma base del que hereda cada variante (`null` = idioma completo).
 * Gobierna la herencia de ilustraciones: una variante reutiliza las imágenes
 * de su base salvo sustitución explícita; el AUDIO nunca se hereda (cada
 * idioma/variante se locuta con su propia voz — Q4.1/T4.1).
 *
 * `gl` es un idioma COMPLETO (banco propio, no una variante del castellano),
 * pero comparte ilustraciones con `es` en las palabras que coinciden: la
 * herencia de imágenes se resuelve por CLAVE de asset, no por idioma base.
 */
export const VERBAL_BANK_BASE: Record<VerbalLang, VerbalLang | null> = {
  es: null,
  gl: null,
  'es-DO': 'es',
};

/**
 * Idiomas cuyo banco y locuciones aún NO están firmados clínicamente. La
 * pantalla lo advierte al profesional (mismo criterio que el audio provisional
 * de es-DO).
 */
export const VERBAL_BANK_PROVISIONAL: readonly VerbalLang[] = ['gl'];

/** Banco de estímulos del idioma/variante indicado. */
export const getVerbalBands = (lang: string): VerbalBandDef[] => {
  switch (lang) {
    case 'es':
      return VERBAL_BANDS;
    case 'gl':
      return GL_VERBAL_BANDS;
    case 'es-DO':
      return ES_DO_VERBAL_BANDS;
    default:
      throw new Error(
        `Banco verbal no registrado para '${lang}' (registrados: ${VERBAL_BANK_LANGS.join(', ')})`,
      );
  }
};

/**
 * Idioma de banco utilizable a partir de un código de sesión cualquiera. La
 * audiometría verbal la abre el hub con el idioma de sesión, que puede no
 * tener banco propio: sin este saneamiento, `getVerbalBands` lanzaba y la
 * PANTALLA ENTERA se caía al montarse (la prueba «no funcionaba» sin más
 * explicación). Ahora degrada al castellano, que es el comportamiento
 * documentado de la capa de idiomas.
 */
export const resolveVerbalLang = (lang: string | null | undefined): VerbalLang =>
  (VERBAL_BANK_LANGS as readonly string[]).includes(lang ?? '') ? (lang as VerbalLang) : 'es';

export interface VerbalLangAssetInventory {
  /** Claves de audio requeridas — todas se locutan con la voz del idioma. */
  audio: string[];
  /** Claves de imagen requeridas por el banco del idioma. */
  images: string[];
  /** Subconjunto de `images` heredable del idioma base (variantes). */
  inheritedImages: string[];
}

/**
 * Inventario de assets del banco de un idioma, distinguiendo qué imágenes
 * puede heredar de su base (manifiesto sin duplicar archivos — Q1.4).
 */
export const collectLangAssetInventory = (lang: string): VerbalLangAssetInventory => {
  const audio = new Set<string>();
  const images = new Set<string>();
  for (const band of getVerbalBands(lang)) {
    for (const item of band.items) {
      audio.add(item.audio);
      for (const opt of item.options) if (opt.image) images.add(opt.image);
    }
  }
  // Las imágenes heredables son las que ya existen en el banco base declarado
  // (variantes) o, para un idioma completo distinto del castellano, las que
  // coinciden en clave con el banco castellano: `pan`, `gato` o `pelota` se
  // ilustran igual en gallego y no hay que duplicar el archivo.
  const baseLang = VERBAL_BANK_BASE[lang as VerbalLang] ?? (lang !== 'es' ? 'es' : null);
  const baseImages = baseLang
    ? new Set(collectLangAssetInventory(baseLang).images)
    : new Set<string>();
  return {
    audio: [...audio].sort(),
    images: [...images].sort(),
    inheritedImages: [...images].filter(k => baseImages.has(k)).sort(),
  };
};
