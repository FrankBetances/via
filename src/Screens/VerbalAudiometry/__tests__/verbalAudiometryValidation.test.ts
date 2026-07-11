import { VERBAL_BANDS, scoredItemsOfBand } from '../verbalAudiometryLists';
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
