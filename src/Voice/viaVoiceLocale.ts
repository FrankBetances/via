import {
  VOICE_BASE_LANG,
  VOICE_LANGS,
  VOICE_LANG_BASE,
  VoiceLang,
} from './voiceCorpusId';

/* -------------------------------------------------------------------------- */
/*  Correspondencia TEXTO ↔ VOZ (lógica PURA, sin RN/UI ni mapa de assets).     */
/*                                                                             */
/*  Módulo PURO (P7) a propósito: lo importa tanto el runtime como el banco de  */
/*  consignas, que el exportador del corpus compila con `tsc` en Node. Si       */
/*  colgase del mapa de assets (`require` de .m4a) el export dejaría de         */
/*  compilar.                                                                   */
/*                                                                             */
/*  EL DEFECTO QUE CORRIGE: la app pasaba la lengua de SESIÓN como lengua de    */
/*  locución, dijera lo que dijese el texto. Con una sesión gallega y un banco  */
/*  que solo tiene castellano, eso da la voz gallega del sistema leyendo        */
/*  castellano (o el recorte castellano anunciado como gallego). La lengua de   */
/*  una locución es la del TEXTO; la de sesión solo decide QUÉ texto se elige.  */
/* -------------------------------------------------------------------------- */

/** Texto locutable ya resuelto: qué se dice y EN QUÉ LENGUA se dice. */
export interface SpokenText {
  /** Texto exacto que se locuta (el mismo que muestra la tarjeta). */
  text: string;
  /** Lengua REAL de `text` — la que debe poner la voz. */
  lang: VoiceLang;
}

/** Texto de una entrada de banco por lengua. */
export type TextByLang = Partial<Record<VoiceLang, string>>;

const textOf = (byLang: TextByLang, lang: VoiceLang): string | null => {
  const t = byLang[lang];
  return typeof t === 'string' && t.trim() !== '' ? t : null;
};

/**
 * Resuelve qué se locuta y con qué voz, a partir del texto que un banco tiene
 * POR LENGUA y de la lengua de sesión. Es el punto que garantiza la
 * correspondencia entre la tarjeta y la locución.
 *
 *   · el banco tiene texto en la lengua de sesión → se locuta en esa lengua;
 *   · la sesión es una VARIANTE sin texto propio (es-DO) → hereda el texto de
 *     su base y CONSERVA su voz: es la misma lengua con otro acento, que es
 *     justo lo que pide una sesión dominicana;
 *   · la sesión es un idioma COMPLETO sin texto propio (gl, eu) → se locuta el
 *     texto castellano CON VOZ CASTELLANA. La tarjeta enseña castellano, así
 *     que ponerle voz gallega sería la incoherencia reportada: el acento de una
 *     lengua sobre el texto de otra. La pantalla debe advertirlo
 *     (`isSpokenTextDegraded`).
 *
 * `null` si el banco no tiene texto por ninguna vía (el llamador calla).
 */
export const resolveSpokenText = (
  byLang: TextByLang,
  sessionLang: VoiceLang,
): SpokenText | null => {
  const own = textOf(byLang, sessionLang);
  if (own != null) return { text: own, lang: sessionLang };

  // Variante sin texto propio: mismo idioma, se conserva la voz de la variante.
  const base = VOICE_LANG_BASE[sessionLang];
  if (base != null) {
    const inherited = textOf(byLang, base);
    if (inherited != null) return { text: inherited, lang: sessionLang };
  }

  // Idioma completo sin texto propio: el texto es castellano y la voz también.
  if (sessionLang !== VOICE_BASE_LANG) {
    const fallback = textOf(byLang, VOICE_BASE_LANG);
    if (fallback != null) return { text: fallback, lang: VOICE_BASE_LANG };
  }

  return null;
};

/**
 * ¿La locución resuelta está en una lengua distinta de la de sesión? Las
 * pantallas lo usan para DECIRLO, en vez de dejar que el profesional descubra
 * que eligió gallego y el estímulo salió en castellano.
 */
export const isSpokenTextDegraded = (
  spoken: SpokenText | null,
  sessionLang: VoiceLang,
): boolean => spoken != null && spoken.lang !== sessionLang;

/**
 * Lenguas para las que un banco tiene texto en TODAS sus entradas, o sea las
 * que su selector puede ofrecer sin mentir. Derivado del contenido (P3): en
 * cuanto se firme el delta gallego de una prueba, su selector lo ofrece solo
 * porque el texto existe, sin tocar la pantalla.
 *
 * Una variante cuenta como cubierta si lo está su base: hereda el texto y solo
 * cambia la voz, que es una oferta legítima.
 */
export const bankLangs = (entries: readonly TextByLang[]): VoiceLang[] => {
  if (entries.length === 0) return [];
  const covers = (l: VoiceLang): boolean =>
    entries.every(e => {
      if (textOf(e, l) != null) return true;
      const base = VOICE_LANG_BASE[l];
      return base != null && textOf(e, base) != null;
    });
  return VOICE_LANGS.filter(covers);
};
