import type { AgeBand, CardModality } from './verbalAudiometryResult';

/* -------------------------------------------------------------------------- */
/*  Banco de estímulos de la Audiometría Verbal (lógica pura, sin UI/DB).      */
/*                                                                             */
/*  Cuatro bandas por edad (A–D), cada una con su modalidad de tarjeta y sus   */
/*  láminas: 1 palabra objetivo + distractores FONÉTICAMENTE CONFUNDIBLES      */
/*  (pares mínimos cuando es posible) para medir discriminación, no            */
/*  vocabulario. Las listas son la propuesta base del diseño                   */
/*  (docs/design/audiometria-verbal.md §3) y DEBEN validarse por el            */
/*  logopeda/fonoaudiólogo antes de uso clínico.                               */
/*                                                                             */
/*  Assets (Iteración 2): cada objetivo requiere un recorte de audio           */
/*  `assets/audio/verbal/<clave>.m4a` y, en bandas con imagen, cada opción     */
/*  una ilustración `assets/img/verbal/<clave>.png`. La clave se deriva de la  */
/*  palabra con `assetKeyForWord` (minúsculas, sin tildes ni signos).          */
/* -------------------------------------------------------------------------- */

export interface VerbalCardOption {
  word: string;
  /** Clave del asset de imagen (solo bandas con imagen: A/B/C). */
  image?: string;
}

export interface VerbalItem {
  id: number; // único en TODO el banco (estable: no reordenar listas)
  band: AgeBand;
  targetWord: string;
  audio: string; // clave del asset de audio del objetivo
  /** Lámina de familiarización: enseña la mecánica y NO puntúa. */
  practice?: boolean;
  options: VerbalCardOption[]; // incluye el objetivo; se baraja en runtime
}

export interface VerbalBandDef {
  band: AgeBand;
  label: string;
  ages: string; // rango de edad orientativo (para chips de UI)
  modality: CardModality;
  optionsPerCard: number; // 4 (A) | 6 (B/C/D)
  items: VerbalItem[]; // [0] = familiarización, resto puntúan
}

/** minúsculas · sin tildes · sin signos → clave estable de asset. */
export const assetKeyForWord = (word: string): string =>
  (word || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

/* ---- constructor compacto de láminas ------------------------------------- */
/*  Cada lámina se declara como [objetivo, ...distractores]; el objetivo va    */
/*  SIEMPRE en la posición 0 de la declaración (el orden de pantalla lo da     */
/*  `shuffleOptions`). Los ids son globales y estables por orden de banda.     */

type ItemDef = string[]; // [target, ...distractors]

let nextId = 0;
const buildItems = (band: AgeBand, withImages: boolean, defs: ItemDef[], practiceCount = 1): VerbalItem[] =>
  defs.map((words, idx) => ({
    id: nextId++,
    band,
    targetWord: words[0],
    audio: assetKeyForWord(words[0]),
    ...(idx < practiceCount ? { practice: true } : {}),
    options: words.map(word => ({
      word,
      ...(withImages ? { image: assetKeyForWord(word) } : {}),
    })),
  }));

/* ------------------------------ Banda A ----------------------------------- */
/*  < 4 años · solo imágenes · 4 opciones. Bisílabas muy familiares.           */
const BAND_A_DEFS: ItemDef[] = [
  ['pan', 'flor', 'pez', 'sol'], // familiarización
  ['pato', 'gato', 'pan', 'mano'],
  ['gato', 'pato', 'vaca', 'mano'],
  ['casa', 'taza', 'mesa', 'boca'],
  ['taza', 'casa', 'pala', 'vaca'],
  ['mano', 'mono', 'pan', 'gato'],
  ['pelota', 'galleta', 'zapato', 'manzana'],
  ['zapato', 'pato', 'plátano', 'pelota'],
  ['flor', 'sol', 'pan', 'pez'],
];

/* ------------------------------ Banda B ----------------------------------- */
/*  4–5 años · imagen + palabra · 6 opciones. Bi/trisílabas.                   */
const BAND_B_DEFS: ItemDef[] = [
  ['pelota', 'zapato', 'estrella', 'escoba', 'tijeras', 'botella'], // familiarización
  ['ventana', 'manzana', 'campana', 'cabaña', 'semana', 'mañana'],
  ['caballo', 'cebolla', 'pastilla', 'botella', 'rodilla', 'zapato'],
  ['mariposa', 'manguera', 'escalera', 'tijeras', 'bandera', 'pelota'],
  ['plátano', 'pájaro', 'sábana', 'lámpara', 'cámara', 'número'],
  ['tijeras', 'orejas', 'abejas', 'cerezas', 'maderas', 'escoba'],
  ['escoba', 'escuela', 'estrella', 'ballena', 'botella', 'cadena'],
  ['botella', 'ballena', 'estrella', 'botón', 'pelota', 'maleta'],
  ['cebolla', 'rodilla', 'pastilla', 'caballo', 'semilla', 'gallina'],
];

/* ------------------------------ Banda C ----------------------------------- */
/*  6–8 años · mixto (imagen + palabra) · 6 opciones. Pares mínimos.           */
const BAND_C_DEFS: ItemDef[] = [
  ['bota', 'gota', 'nota', 'rata', 'lata', 'boca'], // familiarización
  ['pino', 'vino', 'fino', 'niño', 'lino', 'pila'],
  ['boca', 'foca', 'roca', 'loca', 'toca', 'bota'],
  ['gota', 'bota', 'nota', 'rota', 'pota', 'gorra'],
  ['rata', 'lata', 'pata', 'bata', 'gata', 'rana'],
  ['caña', 'casa', 'cara', 'cana', 'gana', 'maña'],
  ['peine', 'reina', 'aceite', 'fuente', 'puente', 'diente'],
  ['queso', 'beso', 'peso', 'hueso', 'yeso', 'seso'],
  ['jarra', 'barra', 'parra', 'garra', 'marca', 'carta'],
];

/* ------------------------------ Banda D ----------------------------------- */
/*  9 años – ADULTOS · solo palabras · 6 opciones. Pares mínimos que estresan  */
/*  sonoridad y punto de articulación. Sin assets de imagen.                   */
const BAND_D_DEFS: ItemDef[] = [
  ['cama', 'coma', 'goma', 'toma', 'loma', 'roma'], // familiarización
  ['peso', 'beso', 'queso', 'yeso', 'hueso', 'seso'],
  ['coma', 'goma', 'toma', 'loma', 'roma', 'cama'],
  ['callo', 'gallo', 'rayo', 'mayo', 'cayo', 'fallo'],
  ['pala', 'bala', 'mala', 'gala', 'sala', 'tala'],
  ['tos', 'dos', 'voz', 'sol', 'gol', 'flor'],
  ['higo', 'hijo', 'hilo', 'fijo', 'rico', 'trigo'],
  ['mora', 'hora', 'gorra', 'zorra', 'torre', 'morra'],
  ['ven', 'den', 'ten', 'fen', 'sien', 'bien'],
  ['rosa', 'loza', 'roja', 'roca', 'ropa', 'sosa'],
  ['vaca', 'baca', 'faca', 'maca', 'saca', 'placa'],
];

/** Banco completo (orden estable: los ids de ítem no deben cambiar). */
export const VERBAL_BANDS: VerbalBandDef[] = [
  { band: 'A', label: 'Solo imágenes', ages: '< 4 años', modality: 'images', optionsPerCard: 4, items: buildItems('A', true, BAND_A_DEFS) },
  { band: 'B', label: 'Imagen + palabra', ages: '4–5 años', modality: 'mixed', optionsPerCard: 6, items: buildItems('B', true, BAND_B_DEFS) },
  { band: 'C', label: 'Mixto · pares mínimos', ages: '6–8 años', modality: 'mixed', optionsPerCard: 6, items: buildItems('C', true, BAND_C_DEFS) },
  { band: 'D', label: 'Solo palabras', ages: '9 años – adulto', modality: 'words', optionsPerCard: 6, items: buildItems('D', false, BAND_D_DEFS) },
];

/** Definición de una banda (A/B/C/D). */
export const bandDef = (band: AgeBand): VerbalBandDef => {
  const def = VERBAL_BANDS.find(b => b.band === band);
  if (!def) throw new Error(`Banda desconocida: ${band}`);
  return def;
};

/** Láminas puntuables de una banda (excluye la familiarización). */
export const scoredItemsOfBand = (band: AgeBand): VerbalItem[] =>
  bandDef(band).items.filter(it => !it.practice);

/** Lámina de familiarización de una banda (no puntúa). */
export const practiceItemOfBand = (band: AgeBand): VerbalItem | null =>
  bandDef(band).items.find(it => !!it.practice) ?? null;

/* ---------------------------- aleatorización ------------------------------ */
/*  PRNG determinista (mulberry32) con semilla de sesión: mismo orden dentro   */
/*  de una sesión (reproducible/auditable), distinto entre sesiones y entre    */
/*  pasadas a distinto nivel (usar semillas distintas) para evitar             */
/*  aprendizaje posicional.                                                    */
/* eslint-disable no-bitwise -- aritmética de 32 bits inherente al PRNG */

const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffleWith = <T>(arr: readonly T[], rand: () => number): T[] => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Opciones de una lámina barajadas de forma determinista (semilla de sesión ⊕
 * id de ítem: cada lámina tiene su propio orden, reproducible en la sesión).
 */
export const shuffleOptions = (item: VerbalItem, seed: number): VerbalCardOption[] =>
  shuffleWith(item.options, mulberry32((seed ^ (item.id * 0x9e3779b9)) >>> 0));

/** Orden de presentación de las láminas puntuables de una banda (determinista). */
export const shuffleItems = (items: readonly VerbalItem[], seed: number): VerbalItem[] =>
  shuffleWith(items, mulberry32(seed >>> 0));
/* eslint-enable no-bitwise */

/* ------------------------- inventario de assets --------------------------- */

export interface VerbalAssetInventory {
  /** Claves de audio requeridas (una por palabra objetivo, todas las bandas). */
  audio: string[];
  /** Claves de imagen requeridas (opciones de las bandas con imagen). */
  images: string[];
}

/** Inventario deduplicado de assets que exige el banco (para la Iteración 2). */
export const collectAssetInventory = (): VerbalAssetInventory => {
  const audio = new Set<string>();
  const images = new Set<string>();
  for (const bandD of VERBAL_BANDS) {
    for (const item of bandD.items) {
      audio.add(item.audio);
      for (const opt of item.options) if (opt.image) images.add(opt.image);
    }
  }
  return { audio: [...audio].sort(), images: [...images].sort() };
};
