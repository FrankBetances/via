import {
  VERBAL_BANDS,
  assetKeyForWord,
  bandDef,
  collectAssetInventory,
  practiceItemOfBand,
  scoredItemsOfBand,
  shuffleItems,
  shuffleOptions,
} from '../verbalAudiometryLists';
import { AgeBand } from '../verbalAudiometryResult';

/* -------------------------------------------------------------------------- */
/*  Pruebas del banco de estímulos: invariantes estructurales de las listas    */
/*  (imprescindibles para que la prueba sea válida), claves de asset y         */
/*  aleatorización determinista por semilla de sesión.                         */
/* -------------------------------------------------------------------------- */

const ALL_BANDS: AgeBand[] = ['A', 'B', 'C', 'D'];

describe('VERBAL_BANDS · invariantes estructurales', () => {
  it('define las cuatro bandas con su modalidad y tamaño de lámina', () => {
    expect(VERBAL_BANDS.map(b => b.band)).toEqual(ALL_BANDS);
    expect(bandDef('A')).toMatchObject({ modality: 'images', optionsPerCard: 4 });
    expect(bandDef('B')).toMatchObject({ modality: 'mixed', optionsPerCard: 6 });
    expect(bandDef('C')).toMatchObject({ modality: 'mixed', optionsPerCard: 6 });
    expect(bandDef('D')).toMatchObject({ modality: 'words', optionsPerCard: 6 });
  });

  it('cada lámina tiene el nº de opciones de su banda, sin duplicados, con el objetivo exactamente una vez', () => {
    for (const band of VERBAL_BANDS) {
      for (const item of band.items) {
        expect(item.options).toHaveLength(band.optionsPerCard);
        const words = item.options.map(o => o.word);
        expect(new Set(words).size).toBe(words.length); // sin duplicados
        expect(words.filter(w => w === item.targetWord)).toHaveLength(1);
      }
    }
  });

  it('los ids de ítem son únicos en todo el banco y cada ítem lleva su banda', () => {
    const ids = VERBAL_BANDS.flatMap(b => b.items.map(i => i.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const band of VERBAL_BANDS) {
      for (const item of band.items) expect(item.band).toBe(band.band);
    }
  });

  it('cada banda tiene exactamente una lámina de familiarización y ≥ 8 puntuables', () => {
    for (const b of ALL_BANDS) {
      const practice = bandDef(b).items.filter(i => i.practice);
      expect(practice).toHaveLength(1);
      expect(practiceItemOfBand(b)).toBe(practice[0]);
      expect(scoredItemsOfBand(b).length).toBeGreaterThanOrEqual(8);
      expect(scoredItemsOfBand(b).every(i => !i.practice)).toBe(true);
    }
  });

  it('las bandas con imagen llevan clave de imagen en TODAS las opciones; la D en ninguna', () => {
    for (const band of VERBAL_BANDS) {
      const withImages = band.modality !== 'words';
      for (const item of band.items) {
        for (const opt of item.options) {
          if (withImages) expect(opt.image).toBe(assetKeyForWord(opt.word));
          else expect(opt.image).toBeUndefined();
        }
      }
    }
  });

  it('la familiarización de las bandas con imagen no exige ilustraciones nuevas (reutiliza el pool)', () => {
    for (const b of ['A', 'B', 'C'] as AgeBand[]) {
      const scoredWords = new Set(scoredItemsOfBand(b).flatMap(i => i.options.map(o => o.word)));
      for (const opt of practiceItemOfBand(b)!.options) {
        expect(scoredWords).toContain(opt.word);
      }
    }
  });
});

describe('assetKeyForWord', () => {
  it('normaliza a minúsculas sin tildes ni signos', () => {
    expect(assetKeyForWord('plátano')).toBe('platano');
    expect(assetKeyForWord('Pájaro')).toBe('pajaro');
    expect(assetKeyForWord('cabaña')).toBe('cabana');
    expect(assetKeyForWord('número')).toBe('numero');
    expect(assetKeyForWord('¡flor!')).toBe('flor');
    expect(assetKeyForWord('')).toBe('');
  });

  it('todas las claves de audio del banco son estables y no vacías', () => {
    for (const band of VERBAL_BANDS) {
      for (const item of band.items) {
        expect(item.audio).toBe(assetKeyForWord(item.targetWord));
        expect(item.audio).toMatch(/^[a-z0-9]+$/);
      }
    }
  });
});

describe('shuffleOptions · shuffleItems (aleatorización determinista)', () => {
  const anyItem = scoredItemsOfBand('D')[0];

  it('misma semilla → mismo orden (reproducible dentro de la sesión)', () => {
    const a = shuffleOptions(anyItem, 1234).map(o => o.word);
    const b = shuffleOptions(anyItem, 1234).map(o => o.word);
    expect(a).toEqual(b);
  });

  it('conserva exactamente el conjunto de opciones (permutación, no muestreo)', () => {
    const shuffledWords = shuffleOptions(anyItem, 99).map(o => o.word).sort();
    const original = anyItem.options.map(o => o.word).sort();
    expect(shuffledWords).toEqual(original);
  });

  it('semillas distintas producen órdenes distintos (en la práctica)', () => {
    const orders = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map(seed => shuffleOptions(anyItem, seed).map(o => o.word).join('|')),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it('el objetivo no queda siempre en la misma posición (sin sesgo posicional)', () => {
    const items = scoredItemsOfBand('D');
    const positions = new Set(
      items.map(it => shuffleOptions(it, 4321).findIndex(o => o.word === it.targetWord)),
    );
    expect(positions.size).toBeGreaterThan(1);
  });

  it('shuffleItems permuta las láminas de forma determinista', () => {
    const items = scoredItemsOfBand('B');
    const a = shuffleItems(items, 7).map(i => i.id);
    const b = shuffleItems(items, 7).map(i => i.id);
    expect(a).toEqual(b);
    expect(a.slice().sort((x, y) => x - y)).toEqual(items.map(i => i.id).sort((x, y) => x - y));
  });
});

describe('collectAssetInventory', () => {
  it('recoge el audio de todos los objetivos y las imágenes de las bandas A/B/C, deduplicados', () => {
    const inv = collectAssetInventory();
    const targets = new Set(VERBAL_BANDS.flatMap(b => b.items.map(i => i.audio)));
    expect(new Set(inv.audio)).toEqual(targets);
    // 'peso' es objetivo en D y opción en C → una sola clave de audio.
    expect(inv.audio.filter(k => k === 'peso')).toHaveLength(1);
    // Banda D no aporta imágenes: 'placa' (solo opción en D) no requiere ilustración.
    expect(inv.images).not.toContain('placa');
    // Las opciones ilustradas sí están ('vino' solo aparece en Banda C).
    expect(inv.images).toContain('vino');
    // Ordenado y sin duplicados (contrato del inventario para la Iteración 2).
    expect(inv.images).toEqual([...new Set(inv.images)].sort());
    expect(inv.audio).toEqual([...new Set(inv.audio)].sort());
  });
});
