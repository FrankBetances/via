import { VERBAL_BANDS, VerbalBandDef, VerbalItem, scoredItemsOfBand } from '../verbalAudiometryLists';
import { getVerbalBands, VERBAL_BANK_LANGS } from '../verbalAudiometryBanks';
import { AgeBand } from '../verbalAudiometryResult';

/* -------------------------------------------------------------------------- */
/*  Validación ESTRUCTURAL automatizada del banco de estímulos.                */
/*                                                                             */
/*  Codifica como invariantes las propiedades psicolingüísticas de diseño      */
/*  (docs/design/validacion-clinica-verbal.md §3): cualquier edición futura    */
/*  de las listas que las degrade rompe la CI. NO sustituye la validación      */
/*  CLÍNICA por el logopeda (contenido, familiaridad, imaginabilidad), que se  */
/*  firma en el documento; aquí solo se verifica lo verificable por máquina.   */
/* -------------------------------------------------------------------------- */

/** Distancia de Levenshtein (confundibilidad ortográfica ≈ fonética en español). */
const levenshtein = (a: string, b: string): number => {
  const m: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return m[a.length][b.length];
};

/** Nº aproximado de sílabas: grupos vocálicos (suficiente para comparar longitudes). */
const syllables = (word: string): number =>
  (word.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[aeiou]+/g) ?? []).length;

const MINIMAL_PAIR_BANDS: AgeBand[] = ['C', 'D'];

describe('banco de estímulos · invariantes psicolingüísticos', () => {
  it('todas las palabras son un único token en minúsculas (sin espacios ni mayúsculas)', () => {
    for (const band of VERBAL_BANDS) {
      for (const item of band.items) {
        for (const opt of item.options) {
          expect(opt.word).toBe(opt.word.toLowerCase());
          expect(opt.word).toMatch(/^[a-záéíóúüñ]+$/);
        }
      }
    }
  });

  it('los objetivos puntuables de cada banda son únicos (sin repetir palabra en la lista)', () => {
    for (const band of VERBAL_BANDS) {
      const targets = scoredItemsOfBand(band.band).map(i => i.targetWord);
      expect(new Set(targets).size).toBe(targets.length);
    }
  });

  it('cada distractor está a ±1 sílaba del objetivo (mide discriminación, no longitud)', () => {
    for (const band of VERBAL_BANDS) {
      for (const item of band.items) {
        const target = syllables(item.targetWord);
        for (const opt of item.options) {
          expect(Math.abs(syllables(opt.word) - target)).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('bandas C/D: cada lámina puntuable contiene al menos un vecino cercano (distancia ≤ 2)', () => {
    for (const b of MINIMAL_PAIR_BANDS) {
      for (const item of scoredItemsOfBand(b)) {
        const near = item.options.filter(
          o => o.word !== item.targetWord && levenshtein(item.targetWord, o.word) <= 2,
        );
        expect(near.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('banda D (adultos): la mayoría de distractores son pares mínimos o casi (distancia ≤ 2 en ≥ 3 de 5)', () => {
    for (const item of scoredItemsOfBand('D')) {
      const near = item.options.filter(
        o => o.word !== item.targetWord && levenshtein(item.targetWord, o.word) <= 2,
      );
      expect(near.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('bandas pediátricas A/B: los objetivos son bisílabos o trisílabos (vocabulario temprano)', () => {
    for (const b of ['A', 'B'] as AgeBand[]) {
      for (const item of scoredItemsOfBand(b)) {
        const n = syllables(item.targetWord);
        // 'flor' y 'pan' (monosílabos muy tempranos) se admiten en banda A.
        expect(n).toBeGreaterThanOrEqual(b === 'A' ? 1 : 2);
        expect(n).toBeLessThanOrEqual(4);
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  Los MISMOS invariantes, aplicados a TODOS los bancos registrados.          */
/*                                                                            */
/*  El banco gallego (plan Nós M3) es propio, no una traducción del            */
/*  castellano: sus pares mínimos y su vocabulario los diseña un logopeda      */
/*  gallego-hablante. Lo que la máquina sí puede exigir —y aquí se exige— es   */
/*  que cumpla las mismas propiedades estructurales que el banco base, para    */
/*  que la prueba mida discriminación y no longitud ni vocabulario.            */
/* -------------------------------------------------------------------------- */

const scoredOf = (bands: VerbalBandDef[], band: AgeBand): VerbalItem[] =>
  bands.find(b => b.band === band)?.items.filter(it => !it.practice) ?? [];

describe.each(VERBAL_BANK_LANGS.map(l => [l] as const))(
  'banco «%s» · invariantes psicolingüísticos',
  lang => {
    const bands = getVerbalBands(lang);

    it('cubre las cuatro bandas con su aridad de opciones declarada', () => {
      expect(bands.map(b => b.band)).toEqual(['A', 'B', 'C', 'D']);
      for (const band of bands) {
        for (const item of band.items) {
          expect(item.options).toHaveLength(band.optionsPerCard);
        }
      }
    });

    it('todas las palabras son un único token en minúsculas', () => {
      for (const band of bands) {
        for (const item of band.items) {
          for (const opt of item.options) {
            expect(opt.word).toBe(opt.word.toLowerCase());
            expect(opt.word).toMatch(/^[a-záéíóúüñ]+$/);
          }
        }
      }
    });

    it('el objetivo es siempre una de las opciones de su lámina', () => {
      for (const band of bands) {
        for (const item of band.items) {
          expect(item.options.map(o => o.word)).toContain(item.targetWord);
        }
      }
    });

    it('las opciones de una lámina no comparten clave de asset (imagen/audio únicos)', () => {
      // `assetKeyForWord` pliega tildes: dos palabras de la MISMA lámina que
      // colapsen a la misma clave compartirían ilustración y la lámina dejaría
      // de ser discriminable.
      for (const band of bands) {
        for (const item of band.items) {
          const keys = item.options.filter(o => !!o.image).map(o => o.image);
          expect(new Set(keys).size).toBe(keys.length);
        }
      }
    });

    it('los objetivos puntuables de cada banda son únicos', () => {
      for (const band of bands) {
        const targets = scoredOf(bands, band.band).map(i => i.targetWord);
        expect(new Set(targets).size).toBe(targets.length);
      }
    });

    it('cada distractor está a ±1 sílaba del objetivo', () => {
      for (const band of bands) {
        for (const item of band.items) {
          const target = syllables(item.targetWord);
          for (const opt of item.options) {
            expect(Math.abs(syllables(opt.word) - target)).toBeLessThanOrEqual(1);
          }
        }
      }
    });

    it('bandas C/D: cada lámina puntuable tiene al menos un vecino cercano (distancia ≤ 2)', () => {
      for (const b of MINIMAL_PAIR_BANDS) {
        for (const item of scoredOf(bands, b)) {
          const near = item.options.filter(
            o => o.word !== item.targetWord && levenshtein(item.targetWord, o.word) <= 2,
          );
          expect({ lang, word: item.targetWord, near: near.length >= 1 }).toEqual({
            lang,
            word: item.targetWord,
            near: true,
          });
        }
      }
    });

    it('banda D (adultos): ≥ 3 de 5 distractores son pares mínimos o casi', () => {
      for (const item of scoredOf(bands, 'D')) {
        const near = item.options.filter(
          o => o.word !== item.targetWord && levenshtein(item.targetWord, o.word) <= 2,
        );
        expect({ lang, word: item.targetWord, near: near.length >= 3 }).toEqual({
          lang,
          word: item.targetWord,
          near: true,
        });
      }
    });

    it('bandas pediátricas A/B: objetivos de 1–4 sílabas (vocabulario temprano)', () => {
      for (const b of ['A', 'B'] as AgeBand[]) {
        for (const item of scoredOf(bands, b)) {
          const n = syllables(item.targetWord);
          expect(n).toBeGreaterThanOrEqual(b === 'A' ? 1 : 2);
          expect(n).toBeLessThanOrEqual(4);
        }
      }
    });

    it('cada banda tiene exactamente una lámina de familiarización (no puntúa)', () => {
      for (const band of bands) {
        expect(band.items.filter(it => it.practice)).toHaveLength(1);
      }
    });
  },
);
