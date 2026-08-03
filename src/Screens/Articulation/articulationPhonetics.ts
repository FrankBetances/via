import type { SodaCode } from './articulationResult';

/* -------------------------------------------------------------------------- */
/*  Fonética del T.A.R.: de una transcripción a una propuesta SODA por fonema. */
/*                                                                            */
/*  MÓDULO PURO. Sin modelos, sin red, sin código nativo: el principio «cero   */
/*  IA en el dispositivo» queda intacto.                                      */
/*                                                                            */
/*  QUÉ PROBLEMA RESUELVE                                                     */
/*                                                                            */
/*  Hasta ahora el módulo comparaba la transcripción con la palabra objetivo   */
/*  por CONTENCIÓN DE CADENAS (`matchesTarget`): devolvía «coincide» o «no     */
/*  coincide». Eso no es una clasificación SODA, es un semáforo. Si el niño    */
/*  dice «tato» por «gato», el clínico obtiene un «revisar» y nada más: ni     */
/*  qué fonema falló, ni de qué tipo fue el error.                            */
/*                                                                            */
/*  Aquí se transcriben las dos cadenas a FONEMAS —la ortografía española es   */
/*  casi biunívoca, así que la conversión es reglada y auditable, no           */
/*  estadística—, se alinean con distancia de edición y cada diferencia se     */
/*  traduce al código SODA que le corresponde:                                */
/*                                                                            */
/*      sustitución → S     omisión → O     adición → A     igual → C         */
/*                                                                            */
/*  LO QUE ESTE MÓDULO NO PUEDE HACER, Y ES IMPORTANTE                        */
/*                                                                            */
/*  1. **La D (distorsión) es indetectable desde texto.** Una /s/ interdental  */
/*     o una /r/ mal vibrada producen EXACTAMENTE la misma cadena que la       */
/*     producción correcta. Distinguirlas exige mirar la señal acústica, no la */
/*     transcripción. Este módulo nunca propone D, y lo dice.                  */
/*                                                                            */
/*  2. **Depende de que el reconocedor no haya normalizado el error.** Un ASR  */
/*     de propósito general lleva un modelo de lenguaje cuyo trabajo es llevar */
/*     lo oído a la palabra de diccionario más próxima: «tato» puede llegar    */
/*     aquí ya convertido en «gato», y entonces no hay nada que alinear. Por   */
/*     eso la salida es una PROPUESTA con su nivel de confianza, y la          */
/*     clasificación la sigue firmando el clínico.                            */
/*                                                                            */
/*  Es, por tanto, la mitad no acústica del scoring fonético: la que se puede  */
/*  construir sin meter un modelo en el dispositivo. La otra mitad —GOP sobre  */
/*  posteriorgramas— sigue exigiendo decisión regulatoria y corpus anotado.    */
/* -------------------------------------------------------------------------- */

/** Fonemas en las etiquetas del propio inventario T.A.R., más las vocales. */
export type Phone =
  | 'B' | 'CH' | 'D' | 'F' | 'G' | 'J' | 'K' | 'L' | 'LL' | 'M' | 'N' | 'Ñ'
  | 'P' | 'R' | 'RR' | 'S' | 'T' | 'Z' | 'W' | 'KS'
  | 'A' | 'E' | 'I' | 'O' | 'U';

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/** Quita tildes y diéresis salvo la ü, que sí cambia la pronunciación. */
const stripAccents = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[áàâ]/g, 'a')
    .replace(/[éèê]/g, 'e')
    .replace(/[íìî]/g, 'i')
    .replace(/[óòô]/g, 'o')
    .replace(/[úù]/g, 'u');

export interface G2POptions {
  /**
   * Seseo: `c`+e/i y `z` se realizan como /s/ y no como /θ/.
   *
   * No es un detalle de estilo. El T.A.R. se usa en sesión castellana y
   * dominicana, y en dominicano el seseo es la norma: sin esta opción, cada
   * «zapato» de un niño dominicano se marcaría como sustitución de un fonema
   * que en su variedad no existe. Por defecto va ACTIVADO, que es lo que
   * cubre a más hablantes y nunca inventa un error dialectal.
   */
  seseo?: boolean;
}

/**
 * Grafemas → fonemas del español. Reglado y determinista.
 *
 * La ortografía española es casi biunívoca, así que esto no es un modelo:
 * es una tabla de reglas que se puede leer, discutir y corregir. Cubre los
 * dígrafos (ch, ll, rr, qu, gu, gü), la vibrante múltiple en posición inicial
 * y tras n/l/s, la g ante e/i, la h muda y la equivalencia b = v.
 */
export function graphemesToPhones(word: string, opts: G2POptions = {}): Phone[] {
  const seseo = opts.seseo !== false;
  const w = stripAccents(word).replace(/[^a-zñáéíóúü]/g, '');
  const out: Phone[] = [];
  let i = 0;

  while (i < w.length) {
    const c = w[i];
    const next = w[i + 1] ?? '';
    const prev = out.length ? out[out.length - 1] : null;

    // --- dígrafos ---
    if (c === 'c' && next === 'h') { out.push('CH'); i += 2; continue; }
    if (c === 'l' && next === 'l') { out.push('LL'); i += 2; continue; }
    if (c === 'r' && next === 'r') { out.push('RR'); i += 2; continue; }
    if (c === 'q' && next === 'u' && (w[i + 2] === 'e' || w[i + 2] === 'i')) {
      out.push('K'); i += 2; continue;
    }
    if (c === 'g' && next === 'u' && (w[i + 2] === 'e' || w[i + 2] === 'i')) {
      out.push('G'); i += 2; continue; // gue/gui: la u es muda
    }
    if (c === 'g' && next === 'ü' && (w[i + 2] === 'e' || w[i + 2] === 'i')) {
      out.push('G'); out.push('W'); i += 2; continue; // güe/güi: la u suena
    }

    // --- consonantes con contexto ---
    if (c === 'c') {
      out.push(next === 'e' || next === 'i' ? (seseo ? 'S' : 'Z') : 'K');
      i += 1; continue;
    }
    if (c === 'g') {
      out.push(next === 'e' || next === 'i' ? 'J' : 'G');
      i += 1; continue;
    }
    if (c === 'r') {
      /* Vibrante MÚLTIPLE en inicial de palabra y tras n, l o s («honra»,
       * «alrededor», «israelí»); simple en el resto. Es la distinción que el
       * T.A.R. evalúa por separado como R y RR. */
      const multiple = out.length === 0 || prev === 'N' || prev === 'L' || prev === 'S';
      out.push(multiple ? 'RR' : 'R');
      i += 1; continue;
    }
    if (c === 'y') {
      // Consonante ante vocal; vocal /i/ en final de palabra o sola («hay»).
      out.push(next && VOWELS.has(next) ? 'LL' : 'I');
      i += 1; continue;
    }
    if (c === 'x') { out.push('KS'); i += 1; continue; }
    if (c === 'h') { i += 1; continue; } // muda
    if (c === 'ü') { out.push('U'); i += 1; continue; }

    // --- correspondencias directas ---
    const direct: Record<string, Phone> = {
      a: 'A', e: 'E', i: 'I', o: 'O', u: 'U',
      b: 'B', v: 'B', // b y v son el MISMO fonema en español
      d: 'D', f: 'F', j: 'J', k: 'K', l: 'L', m: 'M', n: 'N', 'ñ': 'Ñ',
      p: 'P', s: 'S', t: 'T', w: 'W',
      z: seseo ? 'S' : 'Z',
    };
    const phone = direct[c];
    if (phone) out.push(phone);
    i += 1;
  }

  return out;
}

/** Transcribe una frase completa (varias palabras) a una sola secuencia. */
export const phraseToPhones = (text: string, opts: G2POptions = {}): Phone[] =>
  stripAccents(text)
    .split(/\s+/)
    .filter(Boolean)
    .flatMap(w => graphemesToPhones(w, opts));

/* -------------------------------------------------------------------------- */
/*  Alineamiento                                                               */
/* -------------------------------------------------------------------------- */

export type AlignOp = 'match' | 'sub' | 'del' | 'ins';

export interface PhoneAlignment {
  op: AlignOp;
  /** Fonema esperado (`null` en una adición). */
  expected: Phone | null;
  /** Fonema producido (`null` en una omisión). */
  produced: Phone | null;
  /** Índice en la secuencia ESPERADA (para localizar el error en la palabra). */
  expectedIndex: number;
}

/**
 * Alineamiento óptimo por distancia de edición con retroceso (Needleman-Wunsch
 * con coste unitario). Devuelve la secuencia de operaciones, que es lo que
 * permite decir QUÉ fonema falló y no solo cuántos.
 *
 * Ante empates se prefiere `sub` sobre `del`+`ins`: un fonema cambiado se lee
 * clínicamente como UNA sustitución, no como una omisión seguida de una
 * adición.
 */
export function alignPhones(expected: Phone[], produced: Phone[]): PhoneAlignment[] {
  const n = expected.length;
  const m = produced.length;
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = expected[i - 1] === produced[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j - 1] + cost, d[i - 1][j] + 1, d[i][j - 1] + 1);
    }
  }

  const ops: PhoneAlignment[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const cost = i > 0 && j > 0 && expected[i - 1] === produced[j - 1] ? 0 : 1;
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + cost) {
      ops.push({
        op: cost === 0 ? 'match' : 'sub',
        expected: expected[i - 1],
        produced: produced[j - 1],
        expectedIndex: i - 1,
      });
      i -= 1;
      j -= 1;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      ops.push({ op: 'del', expected: expected[i - 1], produced: null, expectedIndex: i - 1 });
      i -= 1;
    } else {
      ops.push({ op: 'ins', expected: null, produced: produced[j - 1], expectedIndex: i });
      j -= 1;
    }
  }
  return ops.reverse();
}

/* -------------------------------------------------------------------------- */
/*  Propuesta SODA                                                             */
/* -------------------------------------------------------------------------- */

/** Código SODA que corresponde a cada operación de alineamiento. */
export const OP_TO_SODA: Record<Exclude<AlignOp, 'match'>, SodaCode> = {
  sub: 'S',
  del: 'O',
  ins: 'A',
};

export interface SodaProposal {
  /** Código propuesto, o `null` si no hay base para proponer. */
  code: SodaCode | null;
  /** Alineamiento completo, para que el clínico vea EN QUÉ se basa. */
  alignment: PhoneAlignment[];
  /** Errores que afectan al fonema DIANA del ítem (si se indicó). */
  targetErrors: PhoneAlignment[];
  /** Todos los errores, en orden de aparición. */
  errors: PhoneAlignment[];
  /** `baja` cuando el reconocedor pudo haber normalizado el error. */
  confidence: 'alta' | 'baja';
  /** Explicación en una línea para la pantalla. */
  note: string;
}

const EMPTY: SodaProposal = {
  code: null,
  alignment: [],
  targetErrors: [],
  errors: [],
  confidence: 'baja',
  note: 'Sin transcripción: clasifique manualmente.',
};

/**
 * Propone un código SODA comparando lo esperado con lo transcrito.
 *
 * `targetPhoneme` es el fonema que el ítem evalúa (`ArticulationItem.phoneme`).
 * Cuando se indica y es un fonema simple, los errores que caen SOBRE ÉL pesan
 * más que los del resto de la palabra: un ítem de /r/ en el que el niño falla
 * una vocal átona no es un fallo de /r/.
 *
 * NUNCA devuelve `'D'`: la distorsión no se ve en el texto (ver cabecera).
 */
export function proposeSoda(
  targetWord: string,
  heardText: string,
  targetPhoneme?: string,
  opts: G2POptions = {},
): SodaProposal {
  if (!targetWord.trim() || !heardText.trim()) return EMPTY;

  const expected = phraseToPhones(targetWord, opts);
  const produced = phraseToPhones(heardText, opts);
  if (!expected.length || !produced.length) return EMPTY;

  const alignment = alignPhones(expected, produced);
  const errors = alignment.filter(a => a.op !== 'match');

  if (!errors.length) {
    return {
      code: 'C',
      alignment,
      targetErrors: [],
      errors: [],
      /* Confianza BAJA a propósito: que la cadena coincida no descarta una
       * distorsión, y el reconocedor pudo haber normalizado el error hacia la
       * palabra de diccionario. «Correcto en la transcripción» no es
       * «correcto en la producción». */
      confidence: 'baja',
      note: 'La transcripción coincide. No descarta distorsión: confirme de oído.',
    };
  }

  // ¿Alguno de los errores cae sobre el fonema que el ítem evalúa?
  const target = (targetPhoneme ?? '').toUpperCase();
  const isSimpleTarget = (['B','CH','D','F','G','J','K','L','LL','M','N','Ñ','P','R','RR','S','T'] as string[])
    .includes(target);
  const targetErrors = isSimpleTarget
    ? errors.filter(e => e.expected === target || e.produced === target)
    : [];

  const decisive = targetErrors.length ? targetErrors : errors;
  const first = decisive[0];
  const code = OP_TO_SODA[first.op as Exclude<AlignOp, 'match'>];

  const note = targetErrors.length
    ? `Afecta a /${target.toLowerCase()}/: ${describe(first)}.`
    : isSimpleTarget
      ? `Error fuera de /${target.toLowerCase()}/: ${describe(first)}. Valore si procede.`
      : describe(first);

  return { code, alignment, targetErrors, errors, confidence: 'alta', note: `${note} Confirme de oído.` };
}

/** Descripción legible de una diferencia concreta. */
export function describe(a: PhoneAlignment): string {
  const low = (p: Phone | null) => (p ? `/${p.toLowerCase()}/` : '');
  switch (a.op) {
    case 'sub':
      return `${low(a.expected)} → ${low(a.produced)}`;
    case 'del':
      return `omite ${low(a.expected)}`;
    case 'ins':
      return `añade ${low(a.produced)}`;
    default:
      return 'sin diferencia';
  }
}

/**
 * Por qué este módulo NUNCA propone `'D'`.
 *
 * Se expone como constante para que quede en el código y no solo en un
 * comentario: cualquier futuro consumidor que espere distorsiones aquí debe
 * encontrarse con la razón.
 */
export const DISTORTION_REQUIRES_ACOUSTICS =
  'La distorsión (D) no es detectable desde la transcripción: una /s/ interdental ' +
  'o una /r/ mal vibrada producen la misma cadena que la producción correcta. ' +
  'Requiere análisis de la señal, no de texto.';
