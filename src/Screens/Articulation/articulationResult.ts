/* -------------------------------------------------------------------------- */
/*  Lógica pura del Test de Articulación a la Repetición (T.A.R.)              */
/*  Sin dependencias de UI/DB. Reutilizada por la pantalla, el archivo de      */
/*  evaluaciones y el PDF. Equivalente a la del mockup `Articulación TAR.dc.html`. */
/*                                                                              */
/*  Registro descriptivo SODA por fonema sobre un inventario fonético por      */
/*  punto de articulación + dífonos, polisílabas y frases.                     */
/*  ⚠ Registro descriptivo de la producción a la repetición; no sustituye el  */
/*  juicio clínico del fonoaudiólogo.                                          */
/* -------------------------------------------------------------------------- */

export type SodaCode = 'C' | 'S' | 'O' | 'D' | 'A'; // Correcto/Sustitución/Omisión/Distorsión/Adición
export type ArticulationSection = 'consonantes' | 'difvoc' | 'difcons' | 'polisilabas' | 'frases';
export type SyllabicPosition = 'I' | 'M' | 'F' | 'T' | '-'; // inicial/media/final/trabada

export interface ArticulationItem {
  id: number;
  section: ArticulationSection;
  place: string;   // punto de articulación (solo consonantes); etiqueta de sección en el resto
  phoneme: string; // 'B', 'RR', 'Dífono vocálico', 'Frase'…
  word: string;
  position: SyllabicPosition;
}

export type SodaResults = Record<number, SodaCode | null>;
export type Substitutions = Record<number, string>;

export interface AffectedPhoneme {
  phoneme: string; // p. ej. '/r/'
  topCode: SodaCode;
  detail: string;  // 'sust.' | 'omis.' | 'distor.' | 'adic.'
}

export interface PhonemeStatus {
  phoneme: string;
  place: string;
  total: number;
  evaluated: number;
  errors: number;
  status: 'ok' | 'mid' | 'bad' | 'none';
}

export interface ArticulationScore {
  evaluatedCount: number;
  totalCount: number;
  correctPct: number; // 0..100
  sodaCounts: Record<SodaCode, number>;
  affectedPhonemes: AffectedPhoneme[];
  phonemeStatus: PhonemeStatus[];
}

export const SODA_META: { code: SodaCode; letter: string; label: string; hint: string }[] = [
  { code: 'C', letter: '✓', label: 'Correcto', hint: 'producción esperada' },
  { code: 'S', letter: 'S', label: 'Sustitución', hint: 'cambia un fonema' },
  { code: 'O', letter: 'O', label: 'Omisión', hint: 'omite el fonema' },
  { code: 'D', letter: 'D', label: 'Distorsión', hint: 'distorsiona el sonido' },
  { code: 'A', letter: 'A', label: 'Adición', hint: 'añade un fonema' },
];

export const SECTION_LABELS: Record<ArticulationSection, string> = {
  consonantes: 'Consonantes',
  difvoc: 'Dífonos vocálicos',
  difcons: 'Dífonos consonánticos',
  polisilabas: 'Polisílabas',
  frases: 'Frases',
};

export const POSITION_LABELS: Record<SyllabicPosition, string> = {
  I: 'inicial', M: 'media', F: 'final', T: 'trabada', '-': '',
};

const CODE_NAME: Record<Exclude<SodaCode, 'C'>, string> = {
  S: 'sust.', O: 'omis.', D: 'distor.', A: 'adic.',
};

/* ---- Inventario fonético por punto de articulación (consonantes) --------
 *
 * Esta columna es CASTELLANO IBÉRICO. El T.A.R. original es chileno y su
 * léxico llegaba con americanismos que un niño peninsular no reconoce
 * («poroto» por judía, «pasto» por césped, «auto» por coche) y con referentes
 * locales sin equivalente aquí (la diuca es un ave chilena; «carabinero» es
 * allí la policía). Se han sustituido conservando fonema y posición: lo que
 * el ítem mide no cambia, cambia la palabra con la que se mide.
 *
 * Las demás variedades viven en `articulationLexicon`, no aquí.
 */
type PlaceDef = [string, [string, [string, SyllabicPosition][]][]];

const PLACES: PlaceDef[] = [
  ['Bilabiales', [
    ['B', [['Bote', 'I'], ['Cabeza', 'M'], ['Nube', 'F'], ['Objeto', 'T']]],
    ['P', [['Pato', 'I'], ['Zapato', 'M'], ['Copa', 'F'], ['Apto', 'T']]],
    ['M', [['Mano', 'I'], ['Camisa', 'M'], ['Suma', 'F'], ['Campo', 'T']]],
  ]],
  ['Labiodental', [
    ['F', [['Foca', 'I'], ['Búfalo', 'M'], ['Café', 'F'], ['Aftosa', 'T']]],
  ]],
  ['Dentales', [
    ['D', [['Dama', 'I'], ['Cadena', 'M'], ['Codo', 'M'], ['Pared', 'F']]],
    ['T', [['Tapa', 'I'], ['Mata', 'M'], ['Torta', 'T'], ['Etna', 'T']]],
  ]],
  ['Alveolares', [
    ['S', [['Sapo', 'I'], ['Rosa', 'M'], ['Bosque', 'T']]],
    ['N', [['Nido', 'I'], ['Panera', 'M'], ['Canto', 'T']]],
    ['L', [['Luna', 'I'], ['Pala', 'M'], ['Dulce', 'T']]],
    ['R', [['Coro', 'M'], ['Loro', 'M'], ['Torta', 'T']]],
    ['RR', [['Perro', 'M'], ['Carroza', 'M'], ['Rosa', 'I']]],
  ]],
  ['Palatales', [
    ['LL', [['Llave', 'I'], ['Payaso', 'M'], ['Malla', 'M']]],
    ['Ñ', [['Ñu', 'I'], ['Muñeca', 'M'], ['Caña', 'M']]],
    ['CH', [['Chándal', 'I'], ['Lechuga', 'M'], ['Noche', 'M']]],
  ]],
  ['Velares', [
    ['K', [['Casa', 'I'], ['Paquete', 'M'], ['Taco', 'M'], ['Acto', 'T']]],
    ['G', [['Gato', 'I'], ['Laguna', 'M'], ['Signo', 'T']]],
    ['J', [['José', 'I'], ['Tejido', 'M'], ['Reloj', 'F']]],
  ]],
];

const DIFVOC = ['Piano', 'Vaina', 'Violín', 'Autobús', 'Ciudad', 'Fui'];
const DIFCONS = ['Tabla', 'Regla', 'Premio', 'Clavo', 'Brazo', 'Atlas', 'Flecha', 'Fruta', 'Tigre', 'Dragón', 'Crema', 'Plato'];
const POLI = ['Locomotora', 'Panadería', 'Caperucita', 'Ametralladora', 'Helicóptero', 'Bicicleta'];
const FRASES = [
  'El perro salta.',
  'La niña rubia come.',
  'Ana fue al jardín con su gatita.',
  'El bebé lloraba porque tenía hambre.',
  'El mono que estaba dentro de la jaula se perdió.',
  'Juanito se metió debajo de la cama para que no lo pillara su mamá.',
];

/** Construye el inventario completo de ítems del T.A.R. (orden estable). */
export const buildArticulationItems = (): ArticulationItem[] => {
  const items: ArticulationItem[] = [];
  let id = 0;
  PLACES.forEach(([place, phs]) =>
    phs.forEach(([ph, ws]) =>
      ws.forEach(([w, pos]) =>
        items.push({ id: id++, section: 'consonantes', place, phoneme: ph, word: w, position: pos }),
      ),
    ),
  );
  DIFVOC.forEach(w => items.push({ id: id++, section: 'difvoc', place: 'Dífonos vocálicos', phoneme: 'Dífono vocálico', word: w, position: '-' }));
  DIFCONS.forEach(w => items.push({ id: id++, section: 'difcons', place: 'Dífonos consonánticos', phoneme: 'Dífono consonántico', word: w, position: '-' }));
  POLI.forEach(w => items.push({ id: id++, section: 'polisilabas', place: 'Polisílabas', phoneme: 'Palabra polisilábica', word: w, position: '-' }));
  FRASES.forEach(w => items.push({ id: id++, section: 'frases', place: 'Frases', phoneme: 'Frase', word: w, position: '-' }));
  return items;
};

/** Lista ordenada de fonemas consonánticos (para el inventario / mapa de estado). */
export const consonantPhonemes = (): { place: string; phonemes: string[] }[] =>
  PLACES.map(([place, phs]) => ({ place, phonemes: phs.map(([ph]) => ph) }));

/** Índice del primer ítem de una sección (para saltar entre pestañas). */
export const firstIndexOfSection = (items: ArticulationItem[], section: ArticulationSection): number =>
  items.findIndex(it => it.section === section);

/** Índice del primer ítem de un fonema concreto. */
export const firstIndexOfPhoneme = (items: ArticulationItem[], phoneme: string): number =>
  items.findIndex(it => it.phoneme === phoneme);

const emptyCounts = (): Record<SodaCode, number> => ({ C: 0, S: 0, O: 0, D: 0, A: 0 });

/** Agrega los resultados SODA en el resumen clínico (porcentaje, recuentos, fonemas afectados). */
export const computeArticulationScore = (
  items: ArticulationItem[],
  results: SodaResults,
): ArticulationScore => {
  const sodaCounts = emptyCounts();
  let evaluatedCount = 0;
  for (const it of items) {
    const r = results[it.id];
    if (r) { sodaCounts[r]++; evaluatedCount++; }
  }
  const correctPct = evaluatedCount ? Math.round((sodaCounts.C / evaluatedCount) * 100) : 0;

  // estado por fonema consonántico
  const map = new Map<string, PhonemeStatus & { codes: Record<string, number> }>();
  PLACES.forEach(([place, phs]) =>
    phs.forEach(([ph]) => map.set(ph, { phoneme: ph, place, total: 0, evaluated: 0, errors: 0, status: 'none', codes: {} })),
  );
  for (const it of items) {
    if (it.section !== 'consonantes') continue;
    const st = map.get(it.phoneme);
    if (!st) continue;
    st.total++;
    const r = results[it.id];
    if (r) {
      st.evaluated++;
      if (r !== 'C') { st.errors++; st.codes[r] = (st.codes[r] || 0) + 1; }
    }
  }

  const phonemeStatus: PhonemeStatus[] = [];
  const affectedPhonemes: AffectedPhoneme[] = [];
  for (const st of map.values()) {
    st.status = st.evaluated === 0 ? 'none' : st.errors === 0 ? 'ok' : st.errors === st.evaluated ? 'bad' : 'mid';
    phonemeStatus.push({ phoneme: st.phoneme, place: st.place, total: st.total, evaluated: st.evaluated, errors: st.errors, status: st.status });
    if (st.status === 'mid' || st.status === 'bad') {
      const top = Object.keys(st.codes).sort((a, b) => st.codes[b] - st.codes[a])[0] as Exclude<SodaCode, 'C'>;
      affectedPhonemes.push({ phoneme: '/' + st.phoneme.toLowerCase() + '/', topCode: top, detail: CODE_NAME[top] || 'error' });
    }
  }

  return { evaluatedCount, totalCount: items.length, correctPct, sodaCounts, affectedPhonemes, phonemeStatus };
};
