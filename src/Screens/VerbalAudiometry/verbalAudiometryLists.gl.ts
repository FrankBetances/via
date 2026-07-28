import type { AgeBand } from './verbalAudiometryResult';
import { assetKeyForWord, VerbalBandDef, VerbalItem } from './verbalAudiometryLists';

/* -------------------------------------------------------------------------- */
/*  Banco de estímulos GALEGO (plan Proxecto Nós · ILENIA, hito M3).           */
/*                                                                             */
/*  A diferencia de es-DO —que hereda el banco español y solo sustituye las    */
/*  láminas afectadas por la fonología caribeña—, el gallego necesita un banco */
/*  PROPIO: sus contrastes fonológicos no son los del castellano y traducir    */
/*  las listas españolas destruiría los pares mínimos (docs/design/            */
/*  integracion-proxecto-nos.md §M3). Este banco se construye sobre rasgos     */
/*  del galego:                                                                */
/*                                                                             */
/*   · /ʃ/ grafía «x» (xerra, xeso, páxaro, queixo, fixo), ausente en          */
/*     castellano y muy discriminativa;                                        */
/*   · vocalismo con ditongos decrecentes «ou»/«ei» (lousa, vasoira, estrela,  */
/*     bandeira, tesoiras) frente a los monoptongos castellanos;               */
/*   · nasal palatal /ɲ/ y lateral palatal /ʎ/ en piño/viño/liño y             */
/*     abella/ovella/botella;                                                   */
/*   · oxítonas en -á (ventá, mazá, campá, mañá), patrón propio del galego.    */
/*                                                                             */
/*  ESTADO: PROVISIONAL. Las listas cumplen los invariantes estructurales que  */
/*  verifica la CI (unicidad de objetivos, distractores a ±1 sílaba, vecindad  */
/*  fonética en C/D), pero la validación CLÍNICA —familiaridad, imaxinabilidade*/
/*  y variante normativa— la firma el logopeda galego-falante en la sesión     */
/*  T3.3, igual que se hizo con el banco castellano. Hasta entonces la         */
/*  pantalla lo etiqueta como provisional.                                      */
/*                                                                             */
/*  IDs: espacio propio a partir de `GL_ID_BASE` para no colisionar nunca con  */
/*  los ids globales del banco castellano (que es-DO hereda tal cual).         */
/*                                                                             */
/*  ASSETS: las ilustraciones se heredan de `es` cuando la palabra coincide    */
/*  (pan, gato, casa, pelota…) y, si no, la tarjeta degrada a pictograma y     */
/*  luego a inicial. El AUDIO nunca se hereda: cada lengua se locuta con su    */
/*  propia voz (T4.1, voz Celtia); mientras no existan los recortes gallegos,  */
/*  el adaptador degrada a la voz del sistema y la pantalla lo advierte.       */
/* -------------------------------------------------------------------------- */

/**
 * Primer id del espacio gallego. Los ids son GLOBALES y estables: el banco
 * castellano ocupa 0..~40, así que el gallego arranca muy por encima para que
 * añadir láminas en castellano nunca invada este rango.
 */
export const GL_ID_BASE = 1000;

let nextId = GL_ID_BASE;

type ItemDef = string[]; // [obxectivo, ...distractores]

const buildItems = (
  band: AgeBand,
  withImages: boolean,
  defs: ItemDef[],
  practiceCount = 1,
): VerbalItem[] =>
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
/*  < 4 anos · só imaxes · 4 opcións. Palabras moi familiares e curtas.        */
const BAND_A_DEFS: ItemDef[] = [
  ['pan', 'flor', 'peixe', 'sol'], // familiarización
  ['pato', 'gato', 'pan', 'man'],
  ['gato', 'pato', 'vaca', 'man'],
  ['casa', 'taza', 'mesa', 'boca'],
  ['taza', 'casa', 'pala', 'vaca'],
  ['man', 'pan', 'can', 'sal'], // monosílabos: contraste de punto de articulación
  ['pelota', 'galleta', 'zapato', 'mazá'],
  ['zapato', 'pato', 'plátano', 'pelota'],
  ['flor', 'sol', 'pan', 'peixe'],
];

/* ------------------------------ Banda B ----------------------------------- */
/*  4–5 anos · imaxe + palabra · 6 opcións. Ditongos «ei/ou» e lateral palatal.*/
const BAND_B_DEFS: ItemDef[] = [
  ['pelota', 'zapato', 'estrela', 'vasoira', 'tesoiras', 'botella'], // familiarización
  ['ventá', 'mazá', 'campá', 'cabana', 'semana', 'mañá'], // oxítonas en -á
  ['abella', 'ovella', 'botella', 'cadela', 'canela', 'estrela'], // /ʎ/ vs /l/
  ['bolboreta', 'mangueira', 'escaleira', 'tesoiras', 'bandeira', 'pelota'],
  ['plátano', 'páxaro', 'sábado', 'lámpada', 'cámara', 'número'], // proparoxítonas
  ['tesoiras', 'orellas', 'abellas', 'cereixas', 'madeiras', 'vasoira'],
  ['vasoira', 'escola', 'estrela', 'balea', 'botella', 'cadea'],
  ['botella', 'balea', 'estrela', 'botón', 'pelota', 'maleta'],
  ['cebola', 'rodela', 'pastilla', 'cabalo', 'semente', 'galiña'],
];

/* ------------------------------ Banda C ----------------------------------- */
/*  6–8 anos · mixto · 6 opcións. Pares mínimos do galego.                     */
const BAND_C_DEFS: ItemDef[] = [
  ['bota', 'gota', 'nota', 'rata', 'lata', 'boca'], // familiarización
  ['piño', 'viño', 'fino', 'niño', 'liño', 'pila'], // /ɲ/ e punto de articulación
  ['boca', 'foca', 'roca', 'louca', 'toca', 'bota'],
  ['gota', 'bota', 'nota', 'rota', 'pota', 'gorra'],
  ['rata', 'lata', 'pata', 'bata', 'gata', 'ra'],
  ['cana', 'casa', 'cara', 'lama', 'gaña', 'maza'],
  ['peite', 'aceite', 'ponte', 'fonte', 'dente', 'monte'], // ditongo «ei»
  ['xeso', 'peso', 'seso', 'óso', 'queixo', 'bico'], // /ʃ/ inicial
  ['xerra', 'barra', 'parra', 'garra', 'marca', 'carta'],
];

/* ------------------------------ Banda D ----------------------------------- */
/*  9 anos – ADULTOS · só palabras · 6 opcións. Pares mínimos que estresan     */
/*  sonoridade e punto de articulación. Sen assets de imaxe.                   */
const BAND_D_DEFS: ItemDef[] = [
  ['cama', 'coma', 'goma', 'toma', 'soma', 'roma'], // familiarización
  ['pote', 'ponte', 'monte', 'fonte', 'corte', 'dente'],
  ['coma', 'goma', 'toma', 'soma', 'roma', 'cama'],
  ['galo', 'calo', 'malo', 'ralo', 'valo', 'falo'],
  ['pala', 'bala', 'mala', 'gala', 'sala', 'tala'],
  ['sol', 'sal', 'col', 'gol', 'son', 'sor'],
  ['figo', 'fixo', 'fillo', 'fío', 'rico', 'trigo'], // /ʃ/ e /ʎ/ en contraste
  ['mora', 'hora', 'morra', 'moura', 'porra', 'torre'],
  ['ben', 'ten', 'den', 'sen', 'ren', 'cen'],
  ['rosa', 'roxa', 'roca', 'sosa', 'roupa', 'lousa'],
  ['vaca', 'baca', 'faca', 'maca', 'saca', 'placa'],
];

/** Banco completo galego (orde estable: os ids de ítem non deben cambiar). */
export const GL_VERBAL_BANDS: VerbalBandDef[] = [
  { band: 'A', label: 'Só imaxes', ages: '< 4 anos', modality: 'images', optionsPerCard: 4, items: buildItems('A', true, BAND_A_DEFS) },
  { band: 'B', label: 'Imaxe + palabra', ages: '4–5 anos', modality: 'mixed', optionsPerCard: 6, items: buildItems('B', true, BAND_B_DEFS) },
  { band: 'C', label: 'Mixto · pares mínimos', ages: '6–8 anos', modality: 'mixed', optionsPerCard: 6, items: buildItems('C', true, BAND_C_DEFS) },
  { band: 'D', label: 'Só palabras', ages: '9 anos – adulto', modality: 'words', optionsPerCard: 6, items: buildItems('D', false, BAND_D_DEFS) },
];

/**
 * Pictogramas provisionales de las palabras GALLEGAS que no existen en el
 * banco castellano (las coincidentes reutilizan `VERBAL_GLYPHS`). Igual que en
 * castellano: la tarjeta muestra imagen > pictograma > inicial.
 */
export const VERBAL_GLYPHS_GL: Record<string, string> = {
  // Banda A
  peixe: '🐟', man: '✋', can: '🐕', sal: '🧂', mazá: '🍎',
  // Banda B
  estrela: '⭐', vasoira: '🧹', tesoiras: '✂️', ventá: '🪟', campá: '🔔',
  cabana: '🛖', mañá: '🌅', abella: '🐝', ovella: '🐑', cadela: '🐕',
  canela: '🌿', bolboreta: '🦋', mangueira: '🚿', escaleira: '🪜',
  bandeira: '🚩', páxaro: '🐦', sábado: '📅', lámpada: '💡', orellas: '👂',
  abellas: '🐝', cereixas: '🍒', madeiras: '🪵', escola: '🏫', balea: '🐋',
  cadea: '⛓️', cebola: '🧅', rodela: '⭕', cabalo: '🐴', semente: '🌱',
  galiña: '🐔',
  // Banda C
  piño: '🌲', viño: '🍷', niño: '🪹', liño: '🧵', louca: '🤪', pota: '🍲',
  gaña: '😋', lama: '🟤', maza: '🔨', peite: '🪮', ponte: '🌉', fonte: '⛲',
  dente: '🦷', monte: '⛰️', xeso: '🩹', óso: '🦴', queixo: '🧀', bico: '💋',
  xerra: '🏺', ra: '🐸',
};
