import {
  VERBAL_BANK_BORROWED,
  VERBAL_BANK_LANGS,
  getVerbalBands,
  resolveVerbalLang,
  usesBorrowedBank,
  verbalStimulusLang,
} from '../verbalAudiometryBanks';
import { pickVoiceForLang, type TtsVoice } from '../verbalTtsVoice';
import { VERBAL_LANG_LABEL } from '../verbalAudiometryResult';
import { SESSION_LANG_LABEL } from '@/Store/slices/sessionLangs';

/* -------------------------------------------------------------------------- */
/*  BANCO PRESTADO: la prueba no puede decir que mide una lengua que no mide.  */
/*                                                                             */
/*  El defecto que fija este fichero, tal como estaba en `mejora2`:            */
/*                                                                             */
/*   · `getVerbalBands('en')` devolvía el banco CASTELLANO —«pan», «gato»,     */
/*     «caballo»— porque `ca` y `en` no tienen banco propio.                   */
/*   · La voz se elegía por el idioma de la SESIÓN, así que esas palabras      */
/*     castellanas se dictaban con la voz inglesa del sistema.                 */
/*   · `pickVoiceForLang` las daba por NO degradadas, porque `en` era el       */
/*     primer prefijo de su propia cadena de alternativas.                     */
/*   · Y la pantalla lo remataba con «Banco de estímulos y locuciones propios  */
/*     de la lengua».                                                          */
/*                                                                             */
/*  La regla ya estaba escrita en `src/Voice/voiceCorpusId.ts` —«leer          */
/*  castellano con voz gallega/catalana no es una degradación de acento, es    */
/*  una locución en otra lengua distinta de la que muestra la tarjeta»—; lo    */
/*  que faltaba era que esta capa la siguiera.                                 */
/* -------------------------------------------------------------------------- */

const voice = (id: string, language: string, quality = 500): TtsVoice =>
  ({ id, name: id, language, quality }) as TtsVoice;

/** Prefijo de idioma de la voz elegida, o `null` si no se eligió ninguna. */
const langOf = (pick: { voice: TtsVoice } | null): string | null =>
  pick?.voice.language?.toLowerCase().split('-')[0] ?? null;

/** Inventario típico de un emulador: inglés de serie, castellano instalado. */
const DEVICE_VOICES: TtsVoice[] = [
  voice('en-us-x-sfg#female_1-local', 'en-US', 500),
  voice('es-es-x-eef#female_1-local', 'es-ES', 500),
  voice('ca-es-x-caf#female_1-local', 'ca-ES', 400),
];

describe('banco prestado · registro', () => {
  it('solo `ca` y `en` tienen banco prestado; el resto presenta su propia lengua', () => {
    const borrowed = VERBAL_BANK_LANGS.filter(l => usesBorrowedBank(l));
    expect([...borrowed].sort()).toEqual(['ca', 'en']);
  });

  it('las variantes del castellano NO son banco prestado: son la misma lengua', () => {
    // `es-419` y `es-DO` presentan palabras castellanas porque SON castellano,
    // con otro acento. Marcarlas aquí sería avisar de un problema que no hay.
    expect(usesBorrowedBank('es-419')).toBe(false);
    expect(usesBorrowedBank('es-DO')).toBe(false);
    expect(usesBorrowedBank('es')).toBe(false);
  });

  it('los idiomas con banco propio firmado tampoco lo son', () => {
    expect(usesBorrowedBank('gl')).toBe(false);
    expect(usesBorrowedBank('eu')).toBe(false);
  });

  it('la lengua del estímulo es la de las PALABRAS, no la de la sesión', () => {
    expect(verbalStimulusLang('ca')).toBe('es');
    expect(verbalStimulusLang('en')).toBe('es');
    expect(verbalStimulusLang('gl')).toBe('gl');
    expect(verbalStimulusLang('eu')).toBe('eu');
    expect(verbalStimulusLang('es-DO')).toBe('es-DO');
  });

  it('un código desconocido cae al castellano sin lanzar', () => {
    expect(verbalStimulusLang('klingon')).toBe('es');
    expect(verbalStimulusLang(null)).toBe('es');
    expect(usesBorrowedBank(undefined)).toBe(false);
  });

  it('el registro coincide con lo que devuelve el banco de verdad', () => {
    // No basta con declararlo: si algún día `ca` gana banco propio y nadie
    // vacía la entrada, esto lo caza.
    for (const [lang, base] of Object.entries(VERBAL_BANK_BORROWED)) {
      const words = (l: string) => getVerbalBands(l)[0].items.map(i => i.targetWord);
      expect({ lang, words: words(lang) }).toEqual({ lang, words: words(base as string) });
    }
  });
});

describe('banco prestado · el estímulo suena en la lengua de las palabras', () => {
  it('una sesión en INGLÉS dicta las palabras castellanas con voz castellana', () => {
    expect(langOf(pickVoiceForLang(DEVICE_VOICES, verbalStimulusLang('en')))).toBe('es');
  });

  it('una sesión en CATALÁN también, y no con la voz catalana', () => {
    expect(langOf(pickVoiceForLang(DEVICE_VOICES, verbalStimulusLang('ca')))).toBe('es');
  });

  it('y NO se declara degradado: castellano con voz castellana es lo correcto', () => {
    // El aviso de degradación es para «no hay voz de esta lengua». Aquí sí la
    // hay: la lengua del estímulo es el castellano. Lo que hay que advertir es
    // otra cosa —que el banco es prestado— y de eso avisa la pantalla.
    expect(pickVoiceForLang(DEVICE_VOICES, verbalStimulusLang('en'))?.degraded).toBe(false);
  });

  it('el defecto original: pedir la voz por el idioma de SESIÓN daba voz inglesa', () => {
    // Se conserva como testigo de lo que NO debe volver a hacerse: el mismo
    // inventario, pidiendo 'en' en vez de la lengua del estímulo, devuelve la
    // voz inglesa y encima la da por no degradada.
    const wrong = pickVoiceForLang(DEVICE_VOICES, 'en');
    expect(langOf(wrong)).toBe('en');
    expect(wrong?.degraded).toBe(false);
  });

  it('las lenguas con banco propio siguen pidiendo SU voz', () => {
    const gl = [...DEVICE_VOICES, voice('gl-es-x-glf#female_1-local', 'gl-ES', 500)];
    expect(langOf(pickVoiceForLang(gl, verbalStimulusLang('gl')))).toBe('gl');
  });

  it('sin voz gallega instalada, el gallego degrada a la castellana Y LO DICE', () => {
    const pick = pickVoiceForLang(DEVICE_VOICES, verbalStimulusLang('gl'));
    expect(langOf(pick)).toBe('es');
    expect(pick?.degraded).toBe(true);
  });
});

describe('banco prestado · el banco devuelto sigue siendo el que se presenta', () => {
  it('`ca` y `en` presentan las palabras castellanas, no listas vacías', () => {
    for (const lang of ['ca', 'en'] as const) {
      const words = getVerbalBands(lang)[0].items.map(i => i.targetWord);
      expect({ lang, has: words.includes('pan') }).toEqual({ lang, has: true });
    }
  });

  it('`resolveVerbalLang` no se toca: sigue devolviendo el idioma de la SESIÓN', () => {
    // La distinción importa: la sesión sigue siendo catalana (así va al
    // informe); lo que cambia es de qué lengua son las palabras.
    expect(resolveVerbalLang('ca')).toBe('ca');
    expect(verbalStimulusLang('ca')).toBe('es');
  });
});

describe('etiquetas de lengua · sin listas paralelas', () => {
  it('todas las lenguas de la prueba tienen NOMBRE, no su código en crudo', () => {
    // Estaba escrita a mano con tres de las siete, así que la pantalla y el
    // PDF enseñaban «ca» donde debía poner «Català».
    for (const lang of VERBAL_BANK_LANGS) {
      const label = VERBAL_LANG_LABEL[lang];
      expect({ lang, ok: !!label && label !== lang }).toEqual({ lang, ok: true });
    }
  });

  it('coincide EXACTAMENTE con el registro único de lenguas de sesión', () => {
    // `verbalAudiometryResult.ts` no puede importar fuera de su carpeta (lo
    // compila un gate de Node con tsc suelto), así que la lista está escrita
    // dos veces. Este test es lo que impide que se separen.
    expect(VERBAL_LANG_LABEL).toEqual({ ...SESSION_LANG_LABEL });
  });
});
