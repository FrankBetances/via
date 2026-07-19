import { VERBAL_BANDS, VerbalBandDef } from './verbalAudiometryLists';
import { ES_DO_VERBAL_BANDS } from './verbalAudiometryLists.es-DO';

/* -------------------------------------------------------------------------- */
/*  Selector del banco de estímulos por idioma/variante (infra M1/Q1).         */
/*                                                                             */
/*  Punto único de registro de los bancos verbales: `es` (base),               */
/*  `es-DO` (Quisqueya Habla, herencia + sustitución selectiva) y, cuando el   */
/*  plan Nós complete M3, `gl` (banco propio diseñado para la fonología del    */
/*  gallego). El pipeline de assets (`scripts/verbal-assets.js --lang`) y los  */
/*  tests consumen este módulo para que listas y assets no diverjan.           */
/* -------------------------------------------------------------------------- */

export type VerbalLang = 'es' | 'es-DO';

/** Idiomas/variantes con banco registrado (gl llegará con el plan Nós M3). */
export const VERBAL_BANK_LANGS: readonly VerbalLang[] = ['es', 'es-DO'];

/**
 * Idioma base del que hereda cada variante (`null` = idioma completo).
 * Gobierna la herencia de ilustraciones: una variante reutiliza las imágenes
 * de su base salvo sustitución explícita; el AUDIO nunca se hereda (cada
 * idioma/variante se locuta con su propia voz — Q4.1).
 */
export const VERBAL_BANK_BASE: Record<VerbalLang, VerbalLang | null> = {
  es: null,
  'es-DO': 'es',
};

/** Banco de estímulos del idioma/variante indicado. */
export const getVerbalBands = (lang: string): VerbalBandDef[] => {
  switch (lang) {
    case 'es':
      return VERBAL_BANDS;
    case 'es-DO':
      return ES_DO_VERBAL_BANDS;
    default:
      throw new Error(
        `Banco verbal no registrado para '${lang}' (registrados: ${VERBAL_BANK_LANGS.join(', ')})`,
      );
  }
};

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
  const baseLang = VERBAL_BANK_BASE[lang as VerbalLang] ?? null;
  const baseImages = baseLang
    ? new Set(collectLangAssetInventory(baseLang).images)
    : new Set<string>();
  return {
    audio: [...audio].sort(),
    images: [...images].sort(),
    inheritedImages: [...images].filter(k => baseImages.has(k)).sort(),
  };
};
