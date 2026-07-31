import type { AgeBand } from './verbalAudiometryResult';
import { assetKeyForWord, VerbalBandDef, VerbalItem } from './verbalAudiometryLists';

/* -------------------------------------------------------------------------- */
/*  Banco de estímulos EUSKARA (euskara batua).                                */
/*                                                                             */
/*  Igual que el gallego —y a diferencia de es-DO, que hereda el banco          */
/*  castellano y solo sustituye láminas—, el euskera necesita un banco PROPIO:  */
/*  no es una lengua romance y traducir las listas castellanas destruiría los   */
/*  pares mínimos, que es lo único que la prueba mide. Este banco se construye  */
/*  sobre rasgos del euskera:                                                   */
/*                                                                              */
/*   · las SIBILANTES, el contraste más característico y más discriminativo     */
/*     de la lengua: /s̻/ «z», /s̺/ «s» y /ts̻ ts̺/ «tz/ts», más la africada       */
/*     postalveolar /tʃ/ «tx» (gazi/gari, zubi/zuri, katu/kate);                */
/*   · la vibrante múltiple frente a la simple en posición intervocálica        */
/*     (hari/harri, ardi/aldi), contraste que el castellano comparte pero que   */
/*     en euskera aparece en pares léxicos muy frecuentes;                      */
/*   · los DIPTONGOS decrecientes «ai/ei/au/oi», abundantísimos y ausentes de   */
/*     la estructura silábica castellana (mahai, leiho, aulki, koilara,         */
/*     guraize, oilo, arrain);                                                  */
/*   · la «h», muda en el euskera estándar occidental, que crea vecinos         */
/*     ortográficos útiles sin cambiar la sílaba (hari, harri, handi, aho).     */
/*                                                                              */
/*  ESTADO: APROBADO PARA PRODUCCIÓN. Las listas cumplen los invariantes        */
/*  estructurales que verifica la CI (unicidad de objetivos, distractores a ±1  */
/*  sílaba, vecindad fonética en C/D), y la validación CLÍNICA —familiaridad,   */
/*  imaginabilidad y adecuación al euskara batua frente a los dialectos, que es */
/*  justo lo que la CI no puede comprobar— la firmó la logopeda euskaldun de    */
/*  Ulertuz el 31/07/2026, mismo camino que siguió el banco gallego con         */
/*  ACOPROS. Registro en `assets/verbal-approval.eu.json` (scope 'bank'); el    */
/*  audio lleva firma aparte, también de Ulertuz (scope 'audio'). Si se         */
/*  modifica una lámina, la firma deja de aplicar a esa lámina.                 */
/*                                                                              */
/*  IDs: espacio propio a partir de `EU_ID_BASE` para no colisionar nunca con   */
/*  los ids del banco castellano (0..~40) ni con los del gallego (1000..1037).  */
/*                                                                              */
/*  ASSETS: las ilustraciones se heredan de `es` cuando la clave coincide y, si */
/*  no, la tarjeta degrada a pictograma y luego a inicial — las ilustraciones   */
/*  siguen siendo PROVISIONALES y el registro de aprobación las excluye         */
/*  expresamente. El AUDIO nunca se hereda: cada lengua se locuta con su propia */
/*  voz, y el euskera ya tiene sus 32 recortes con la voz Maider (AhoTTS ·      */
/*  HiTZ/Aholab), aprobados por Ulertuz.                                        */
/* -------------------------------------------------------------------------- */

/**
 * Primer id del espacio vasco. Los ids son GLOBALES y estables: el castellano
 * ocupa 0..~40 y el gallego 1000..1037, así que el euskera arranca en 2000
 * para que ampliar cualquiera de los dos nunca invada este rango.
 */
export const EU_ID_BASE = 2000;

let nextId = EU_ID_BASE;

type ItemDef = string[]; // [helburua, ...distraigarriak]

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

/* ------------------------------ A banda ----------------------------------- */
/*  < 4 urte · irudiak bakarrik · 4 aukera. Hiztegi goiztiarra eta laburra.    */
const BAND_A_DEFS: ItemDef[] = [
  ['ogi', 'lore', 'arrain', 'eguzki'], // familiarizazioa
  ['katu', 'ahate', 'ogi', 'esku'],
  ['ahate', 'katu', 'behi', 'oilo'],
  ['etxe', 'gazta', 'esne', 'aho'],
  ['gazta', 'etxe', 'esne', 'behi'],
  ['esku', 'ogi', 'oilo', 'sagu'],
  ['pilota', 'zapata', 'eguzki', 'gaileta'],
  ['zapata', 'pilota', 'gaileta', 'ahate'],
  ['lore', 'arrain', 'eguzki', 'sagar'],
];

/* ------------------------------ B banda ----------------------------------- */
/*  4–5 urte · irudia + hitza · 6 aukera. Diptongoak eta hitz luzeagoak.       */
const BAND_B_DEFS: ItemDef[] = [
  ['pilota', 'zapata', 'eskola', 'botila', 'guraize', 'koilara'], // familiarizazioa
  ['leiho', 'aulki', 'mahai', 'sagar', 'txakur', 'erratz'], // «ei/au/ai» diptongoak
  ['aulki', 'leiho', 'mahai', 'erratz', 'txakur', 'izar'],
  ['botila', 'pilota', 'makila', 'katilu', 'ispilu', 'koilara'],
  ['guraize', 'koilara', 'botila', 'eskola', 'gaztelu', 'armiarma'],
  ['eskola', 'pilota', 'gaztelu', 'ispilu', 'makila', 'zapata'],
  ['tximeleta', 'eskailera', 'armiarma', 'koilara', 'guraize', 'gaztelu'],
  ['eskailera', 'tximeleta', 'armiarma', 'makila', 'botila', 'katilu'],
  ['ilargi', 'belarri', 'eguzki', 'makila', 'katilu', 'bandera'],
];

/* ------------------------------ C banda ----------------------------------- */
/*  6–8 urte · mistoa · 6 aukera. Euskarazko bikote minimoak.                  */
const BAND_C_DEFS: ItemDef[] = [
  ['ardi', 'ardo', 'argi', 'handi', 'harri', 'aldi'], // familiarizazioa
  ['ardo', 'ardi', 'argi', 'aldi', 'handi', 'harri'],
  ['argi', 'ardi', 'ardo', 'garbi', 'handi', 'harri'],
  ['gari', 'sari', 'hari', 'gazi', 'gori', 'zuri'], // «z» /s̻/ vs «s» /s̺/
  ['gazi', 'gari', 'gori', 'sari', 'hari', 'zuri'],
  ['katu', 'kate', 'kalte', 'kanta', 'karta', 'sagu'],
  ['kate', 'katu', 'kanta', 'karta', 'kalte', 'sagu'],
  ['zubi', 'zuri', 'gari', 'hari', 'sari', 'gori'],
  ['mahai', 'mahats', 'gari', 'hari', 'sari', 'zuri'],
];

/* ------------------------------ D banda ----------------------------------- */
/*  9 urte – HELDUAK · hitzak bakarrik · 6 aukera. Bikote minimoak, sibilanteak */
/*  eta dardarkariak lanean. Irudirik gabe.                                    */
const BAND_D_DEFS: ItemDef[] = [
  ['gari', 'sari', 'hari', 'gazi', 'gori', 'zuri'], // familiarizazioa
  ['sari', 'gari', 'hari', 'gazi', 'gori', 'zuri'],
  ['hari', 'gari', 'sari', 'gori', 'zuri', 'gazi'],
  ['ardi', 'ardo', 'argi', 'aldi', 'handi', 'harri'], // /r/ vs /rr/ eta «h» muta
  ['aldi', 'ardi', 'ardo', 'argi', 'handi', 'harri'],
  ['kate', 'katu', 'kalte', 'kanta', 'karta', 'kanpo'],
  ['karta', 'kanta', 'kalte', 'kate', 'katu', 'marka'],
  ['beso', 'baso', 'bero', 'bela', 'bide', 'bete'],
  ['bero', 'beso', 'baso', 'bete', 'bela', 'bide'],
  ['bete', 'bide', 'bero', 'beso', 'bela', 'baso'],
];

/** Banco completo vasco (orden estable: los ids de ítem no deben cambiar). */
export const EU_VERBAL_BANDS: VerbalBandDef[] = [
  { band: 'A', label: 'Irudiak bakarrik', ages: '< 4 urte', modality: 'images', optionsPerCard: 4, items: buildItems('A', true, BAND_A_DEFS) },
  { band: 'B', label: 'Irudia + hitza', ages: '4–5 urte', modality: 'mixed', optionsPerCard: 6, items: buildItems('B', true, BAND_B_DEFS) },
  { band: 'C', label: 'Mistoa · bikote minimoak', ages: '6–8 urte', modality: 'mixed', optionsPerCard: 6, items: buildItems('C', true, BAND_C_DEFS) },
  { band: 'D', label: 'Hitzak bakarrik', ages: '9 urte – helduak', modality: 'words', optionsPerCard: 6, items: buildItems('D', false, BAND_D_DEFS) },
];

/**
 * Pictogramas provisionales de las palabras VASCAS que no existen en el banco
 * castellano (las coincidentes reutilizan `VERBAL_GLYPHS`). Igual que en las
 * demás lenguas: la tarjeta muestra imagen > pictograma > inicial.
 */
export const VERBAL_GLYPHS_EU: Record<string, string> = {
  // A banda
  ogi: '🍞', katu: '🐱', txakur: '🐕', etxe: '🏠', esku: '✋', behi: '🐄',
  ahate: '🦆', oilo: '🐔', lore: '🌸', eguzki: '☀️', arrain: '🐟', sagar: '🍎',
  gazta: '🧀', esne: '🥛', aho: '👄', sagu: '🐭', izar: '⭐',
  zapata: '👟', pilota: '⚽', gaileta: '🍪',
  // B banda
  aulki: '🪑', leiho: '🪟', erratz: '🧹', botila: '🍾', koilara: '🥄',
  guraize: '✂️', makila: '🪵', katilu: '🥣', ispilu: '🪞', gaztelu: '🏰',
  eskola: '🏫', armiarma: '🕷️', tximeleta: '🦋', eskailera: '🪜',
  ilargi: '🌙', belarri: '👂', bandera: '🚩', mahai: '🪑',
  // C/D bandak
  ardi: '🐑', ardo: '🍷', argi: '💡', handi: '🔠', harri: '🪨', aldi: '⏱️',
  garbi: '🧼', gari: '🌾', sari: '🏆', hari: '🧵', gazi: '🧂', gori: '🔥',
  zuri: '⬜', kate: '⛓️', kalte: '⚠️', kanta: '🎵', karta: '🃏', kanpo: '🌳',
  marka: '🏷️', zubi: '🌉', mahats: '🍇', beso: '💪', baso: '🌲', bero: '🌡️',
  bela: '⛵', bide: '🛤️', bete: '🪣',
};
