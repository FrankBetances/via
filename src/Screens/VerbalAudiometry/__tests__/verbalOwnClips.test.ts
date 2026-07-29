import {
  verbalAudioBase64ForLang,
  verbalAudioSourceForLang,
} from '../verbalAssetsByLang';
import { getVerbalBands, VERBAL_AUDIO_PENDING, VERBAL_BANK_LANGS } from '../verbalAudiometryBanks';

/* -------------------------------------------------------------------------- */
/*  Los recortes empaquetados tienen que ser ALCANZABLES desde la app.         */
/*                                                                             */
/*  Regresión del bug «sigue sin voz neuronal, solo hay voz del sistema»: el   */
/*  pipeline sintetizó el gallego y el euskera y sus locuciones quedaron en el */
/*  bundle, pero el accesor por idioma seguía teniendo una lista de «idiomas   */
/*  sin recortes» que devolvía `null` a secas. La app llevaba el audio encima  */
/*  y dictaba con la voz del sistema.                                          */
/*                                                                             */
/*  Que un fichero exista en `assets/` no significa que la app lo use: lo que  */
/*  se comprueba aquí es la CADENA COMPLETA, banco → clave → base64.           */
/* -------------------------------------------------------------------------- */

/** Claves de audio del banco de un idioma. */
const audioKeys = (lang: string): string[] => {
  const keys = new Set<string>();
  for (const band of getVerbalBands(lang)) for (const item of band.items) keys.add(item.audio);
  return [...keys];
};

describe('alcanzabilidad de los recortes por idioma', () => {
  it.each(VERBAL_BANK_LANGS.filter(l => !VERBAL_AUDIO_PENDING.includes(l)))(
    'el banco «%s» resuelve un recorte para TODAS sus palabras',
    lang => {
      const missing = audioKeys(lang).filter(k => !verbalAudioBase64ForLang(k, lang));
      expect({ lang, missing }).toEqual({ lang, missing: [] });
    },
  );

  it('un idioma completo NUNCA devuelve el recorte castellano en su lugar', () => {
    // Claves que existen SOLO en el banco castellano: si el accesor degradase,
    // devolvería el recorte de una palabra que ese idioma no usa y el estímulo
    // puntuado no sería el que se oye. (Ojo: «pan» no sirve de ejemplo, porque
    // el banco gallego también la tiene y con recorte propio.)
    expect(verbalAudioBase64ForLang('cebolla', 'gl')).toBeNull();
    expect(verbalAudioBase64ForLang('cebolla', 'eu')).toBeNull();
    expect(verbalAudioSourceForLang('cebolla', 'eu')).toBeNull();
  });

  it('cada idioma completo devuelve SU propio recorte, distinto del castellano', () => {
    // «boca» existe en los tres bancos con la misma clave: los bytes tienen que
    // ser distintos, o alguien está sirviendo la voz equivocada.
    const es = verbalAudioBase64ForLang('boca', 'es');
    const gl = verbalAudioBase64ForLang('boca', 'gl');
    expect(es).toBeTruthy();
    expect(gl).toBeTruthy();
    expect(gl).not.toBe(es);
  });

  it('es-DO sí puede heredar del castellano (es una variante, no otro idioma)', () => {
    expect(verbalAudioBase64ForLang('boca', 'es-DO')).toBeTruthy();
  });
});
