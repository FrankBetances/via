import { VERBAL_BANDS, VerbalBandDef } from './verbalAudiometryLists';
import { ES_DO_VERBAL_BANDS } from './verbalAudiometryLists.es-DO';
import { EU_VERBAL_BANDS } from './verbalAudiometryLists.eu';
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

export type VerbalLang = 'es' | 'es-DO' | 'gl' | 'eu' | 'ca' | 'es-419' | 'en';

/** Idiomas/variantes con banco registrado. */
export const VERBAL_BANK_LANGS: readonly VerbalLang[] = ['es', 'gl', 'eu', 'ca', 'es-419', 'es-DO', 'en'];

/**
 * Idioma base del que hereda cada variante (`null` = no hereda imágenes de
 * nadie). Gobierna la herencia de ILUSTRACIONES: una variante reutiliza las
 * imágenes de su base salvo sustitución explícita.
 *
 * `gl` y `eu` tienen banco propio y comparten ilustraciones con `es` en las
 * palabras que coinciden: esa herencia se resuelve por CLAVE de asset, no por
 * idioma base. `ca` y `en` no tienen banco propio todavía — ver
 * `VERBAL_BANK_BORROWED`, que es donde eso está declarado.
 */
export const VERBAL_BANK_BASE: Record<VerbalLang, VerbalLang | null> = {
  es: null,
  gl: null,
  eu: null,
  ca: null,
  'es-419': 'es',
  'es-DO': 'es',
  en: null,
};

/**
 * Idiomas cuyo BANCO DE ESTÍMULOS (listas A–D) aún no está firmado
 * clínicamente. La pantalla lo advierte al profesional.
 *
 * `es` está firmado en `docs/design/validacion-clinica-verbal.md`, `es-DO` y
 * `es-419` heredan el castellano sin sustituciones (Q3), `gl` lo dio por bueno ACOPROS
 * y `eu` lo firmó la logopeda euskaldun de Ulertuz (31/07/2026).
 *
 * `ca`, `es-419` y `en` entran como provisionales hasta que tengan su acta
 * clínica correspondiente.
 *
 * OJO con `ca` y `en`: además de provisionales, su banco es PRESTADO
 * (`VERBAL_BANK_BORROWED`), y eso es lo que la pantalla les advierte, porque
 * es lo más grave de los dos. Decirles «banco provisional» sería impreciso en
 * la dirección equivocada: el banco que se les presenta —el castellano— sí
 * está firmado; lo que no está validado es presentárselo A ELLOS.
 */
export const VERBAL_BANK_PROVISIONAL: readonly VerbalLang[] = ['ca', 'es-419', 'en'];

/**
 * Idiomas SIN locuciones propias empaquetadas en disco.
 *
 * `es-419` está aquí AUNQUE ya tenga sus 37 locuciones en disco: las generó el
 * workflow de voz el 31/8/2026 y NADIE las ha firmado. Lo que hace definitivo a
 * un estímulo no son los bytes, es la firma del expediente clínico, y mientras
 * no exista la pantalla debe seguir advirtiéndolo.
 *
 * `ca` y `en` no entran aquí porque su banco es PRESTADO — no es que les falten
 * locuciones, es que no les tocan (ver `VERBAL_BANK_BORROWED`).
 *
 * Es un registro de COBERTURA DE ASSETS, y lo vigila
 * `scripts/check-verbal-coverage.js --strict` en los dos sentidos. No dice por
 * sí solo qué se oye: un idioma con banco prestado (`VERBAL_BANK_BORROWED`)
 * suena con las locuciones de la lengua que le presta las palabras, que sí
 * existen. Quien decide qué se oye es `verbalStimulusLang`.
 */
export const VERBAL_AUDIO_PENDING: readonly VerbalLang[] = ['es-419'];

/* -------------------------------------------------------------------------- */
/*  BANCO PRESTADO — la distinción que faltaba, y que la pantalla mentía.      */
/*                                                                             */
/*  Una VARIANTE (`es-419`, `es-DO`) presenta palabras de SU MISMA lengua con  */
/*  otro acento: heredar el banco castellano es legítimo y no cambia lo que se */
/*  mide. Un idioma con BANCO PRESTADO es otra cosa: `ca` y `en` no tienen     */
/*  banco propio, así que la prueba les presenta LAS PALABRAS CASTELLANAS.     */
/*                                                                             */
/*  Eso no es un matiz de acento. Es que la audiometría verbal en catalán mide */
/*  discriminación de palabras castellanas, y hay que decirlo, porque el       */
/*  informe lleva el idioma de la sesión. Valeria+ documenta este mismo caso   */
/*  en `valeriaLocale.ts`: «el castellano NO transfiere —"perro" es "gos" y    */
/*  pierde el contraste r̄/l— y el catalán trae contrastes que el castellano   */
/*  no tiene (vocal neutra [ə], /ʃ/, /ʒ/, /z/, la ela geminada)».              */
/*                                                                             */
/*  Consecuencia OPERATIVA, no solo informativa: las palabras se locutan con   */
/*  la voz de la lengua que las presta. Es la regla que ya estaba escrita en   */
/*  `src/Voice/voiceCorpusId.ts` y que esta capa no seguía: «leer castellano   */
/*  con voz gallega/catalana no es una degradación de acento, es una locución  */
/*  en otra lengua distinta de la que muestra la tarjeta».                     */
/*                                                                             */
/*  Vaciar una entrada es lo que hay que hacer al firmar un banco propio.      */
/* -------------------------------------------------------------------------- */
export const VERBAL_BANK_BORROWED: Partial<Record<VerbalLang, VerbalLang>> = {
  ca: 'es',
  en: 'es',
};


/** Banco de estímulos del idioma/variante indicado. */
export const getVerbalBands = (lang: string): VerbalBandDef[] => {
  switch (lang) {
    case 'es':
      return VERBAL_BANDS;
    case 'gl':
      return GL_VERBAL_BANDS;
    case 'eu':
      return EU_VERBAL_BANDS;
    case 'es-DO':
      return ES_DO_VERBAL_BANDS;
    case 'es-419':
      return VERBAL_BANDS; // hereda banco castellano base
    case 'ca':
      return VERBAL_BANDS; // provisional hasta diseño fonológico catalán
    case 'en':
      return VERBAL_BANDS; // provisional hasta diseño fonológico inglés
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

/**
 * Lengua en la que están REALMENTE las palabras que se van a presentar.
 *
 * Es lo que gobierna el ESTÍMULO: qué recorte se reproduce y con qué voz se
 * dicta. Para casi todas las lenguas es ella misma; para las de banco
 * prestado, la que se lo presta.
 */
export const verbalStimulusLang = (lang: string | null | undefined): VerbalLang => {
  const resolved = resolveVerbalLang(lang);
  return VERBAL_BANK_BORROWED[resolved] ?? resolved;
};

/** ¿La prueba presenta a este idioma palabras que no son de su lengua? */
export const usesBorrowedBank = (lang: string | null | undefined): boolean =>
  verbalStimulusLang(lang) !== resolveVerbalLang(lang);


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
