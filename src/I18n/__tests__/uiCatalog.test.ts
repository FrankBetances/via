import { CATALOGUES } from '../catalog';
import { ALL_UI_LANGS, UiLang } from '../uiLang';
import { ES } from '../strings.es';

/* -------------------------------------------------------------------------- */
/*  Paridad de los catálogos de interfaz.                                       */
/*                                                                             */
/*  El compilador ya garantiza que NO FALTE ninguna clave (`UiStrings` no       */
/*  admite huecos). Lo que el compilador no puede ver es lo que sigue, y que ya */
/*  costó una vez: que una cadena esté PRESENTE pero escrita en otra lengua,    */
/*  porque el catálogo se creó copiando el del vecino. En la rama `mejora2` el  */
/*  catálogo euskera traía «descende ata ≈%50era» —galego— y pasaba todos los   */
/*  gates: tenía la clave, tenía el placeholder y compilaba.                    */
/* -------------------------------------------------------------------------- */

type Flat = Map<string, string | number>;

/** Aplana un catálogo: las cadenas por su texto, las funciones por su aridad. */
const flatten = (cat: unknown, prefix = ''): Flat => {
  const out: Flat = new Map();
  for (const [key, value] of Object.entries(cat as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else if (typeof value === 'function') out.set(path, (value as (...a: never[]) => string).length);
    else if (value && typeof value === 'object') {
      for (const [k, v] of flatten(value, path)) out.set(k, v);
    }
  }
  return out;
};

const BASE = flatten(ES);

describe('catálogos de interfaz · cobertura', () => {
  it('las siete variedades tienen catálogo registrado', () => {
    expect(Object.keys(CATALOGUES).sort()).toEqual([...ALL_UI_LANGS].sort());
  });

  for (const lang of ALL_UI_LANGS) {
    describe(`${lang}`, () => {
      const cat = flatten(CATALOGUES[lang as UiLang]);

      it('tiene exactamente las mismas claves que el castellano', () => {
        expect([...cat.keys()].sort()).toEqual([...BASE.keys()].sort());
      });

      it('las claves que son función lo son con la MISMA aridad', () => {
        for (const [key, value] of BASE) {
          if (typeof value !== 'number') continue;
          expect({ key, arity: cat.get(key) }).toEqual({ key, arity: value });
        }
      });

      it('no deja ninguna cadena vacía', () => {
        for (const [key, value] of cat) {
          if (typeof value !== 'string') continue;
          expect({ key, empty: value.trim() === '' }).toEqual({ key, empty: false });
        }
      });
    });
  }
});

describe('catálogos de interfaz · sin contaminación entre lenguas', () => {
  /* Palabras función que NO existen en euskera. Si aparecen en el catálogo
   * vasco, la cadena viene copiada de una lengua romance. */
  const ROMANCE_IN_EU =
    /\b(de|del|la|el|los|las|que|para|con|una|por|se|ata|non|nivel|voz|palabra|descende|banda|però|amb|dels|nivell)\b/i;

  it('el catálogo euskera no arrastra palabras romances (el fallo de mejora2)', () => {
    const offenders: string[] = [];
    for (const [key, value] of flatten(CATALOGUES.eu)) {
      if (typeof value === 'string' && ROMANCE_IN_EU.test(value)) {
        offenders.push(`${key} → «${value}»`);
      }
    }
    expect(offenders).toEqual([]);
  });

  /* Que una cadena sea IDÉNTICA al castellano no basta para acusarla: el
   * gallego comparte con el castellano frases enteras («Variante neutra
   * latinoamericana»), y un nombre propio («Piper Lessac», «Proxecto Nós») se
   * escribe igual en las siete. Marcar eso sería ruido, y un test ruidoso deja
   * de leerse — que es como se cuela el error de verdad.
   *
   * Lo que sí acusa: una PALABRA FUNCIÓN castellana dentro de una lengua que
   * no la tiene. Eso no aparece por parecido, aparece por copiar y pegar. */
  const SPANISH_ONLY_IN: Partial<Record<UiLang, RegExp>> = {
    // O galego usa «e», «do», «a/as/os/o», «dende», «ata».
    gl: /\b(y|del|de la|la|los|las|el|desde|hasta|voces y|calidad)\b/i,
    // El català fa servir «i», «els», «les», «amb», «per», «veu».
    ca: /\b(y|los|las|con|para|por|desde|hasta|voz|selección|calidad)\b/i,
    // English keeps none of these.
    en: /\b(de|del|la|el|los|las|y|con|para|por|voz|banco|neuronal|calidad)\b/i,
  };

  for (const [lang, foreign] of Object.entries(SPANISH_ONLY_IN) as [UiLang, RegExp][]) {
    it(`${lang}: ninguna cadena arrastra palabras función castellanas`, () => {
      const offenders: string[] = [];
      for (const [key, value] of flatten(CATALOGUES[lang])) {
        if (typeof value === 'string' && foreign.test(value)) {
          offenders.push(`${key} → «${value}»`);
        }
      }
      expect(offenders).toEqual([]);
    });
  }

  /* Las VARIANTES del castellano sí heredan: son la misma lengua y su catálogo
   * es un delta. Lo que se comprueba es que el delta exista de verdad, no que
   * el fichero entero sea una copia inútil. */
  for (const lang of ['es-419', 'es-DO'] as const) {
    it(`${lang}: es un delta real sobre el castellano, no una copia`, () => {
      const cat = flatten(CATALOGUES[lang]);
      const changed = [...BASE].filter(
        ([key, value]) => typeof value === 'string' && cat.get(key) !== value,
      );
      expect(changed.length).toBeGreaterThan(0);
    });
  }
});
