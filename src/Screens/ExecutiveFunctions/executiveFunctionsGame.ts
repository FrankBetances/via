/* -------------------------------------------------------------------------- */
/*  Lógica pura de la Exploración de Funciones Ejecutivas (sin UI/DB).         */
/*                                                                            */
/*  Batería LÚDICA de 5 mini-juegos de tarjetas, uno por dominio ejecutivo,    */
/*  pensada para niños (rondas cortas, mecánica de juego, feedback amable):    */
/*                                                                            */
/*   1. Atención           «Busca y encuentra» — búsqueda visual: tocar todos  */
/*      los objetivos de una lámina con distractores.                          */
/*   2. Inhibición         «No despiertes al lobo» — go/no-go: tocar cada      */
/*      animal que aparece, EXCEPTO el lobo.                                   */
/*   3. Flexibilidad       «El juego de las normas» — DCCS (Dimensional        */
/*      Change Card Sort): clasificar por COLOR, luego por FORMA, y bloque     */
/*      mixto en bandas mayores.                                               */
/*   4. Memoria de trabajo «El loro repetidor» — span de tarjetas: repetir la  */
/*      secuencia iluminada (directa; inversa en la banda mayor).              */
/*   5. Planificación      «Ordena la historia» — secuenciación: tocar las     */
/*      tarjetas desordenadas en su orden lógico.                              */
/*                                                                            */
/*  La dificultad se gradúa por BANDA DE EDAD (A–D) elegida antes de empezar:  */
/*  nº de tarjetas, ensayos, velocidad, longitud de secuencias y dirección     */
/*  del span. Los ensayos se generan con PRNG determinista por semilla de     */
/*  sesión (mismo criterio que la audiometría verbal): reproducible dentro    */
/*  de la sesión, distinto entre sesiones.                                     */
/*                                                                            */
/*  ⚠ CRIBADO ORIENTATIVO: puntuaciones 0–100 por dominio con cortes           */
/*  provisionales a validar clínicamente. No es un instrumento diagnóstico    */
/*  (no sustituye BRIEF-2, NEPSY-II, Torre de Londres, CPT, etc.).             */
/* -------------------------------------------------------------------------- */

export type EfAgeBand = 'A' | 'B' | 'C' | 'D';

export type EfDomain = 'attention' | 'inhibition' | 'flexibility' | 'workingMemory' | 'planning';

export type EfStatus = 'ok' | 'warn' | 'alt';

export const EF_BANDS: { band: EfAgeBand; ages: string; label: string; emoji: string }[] = [
  { band: 'A', ages: '3–4 años', label: 'Rondas muy cortas y sencillas', emoji: '🧸' },
  { band: 'B', ages: '5–6 años', label: 'Rondas cortas', emoji: '🎈' },
  { band: 'C', ages: '7–8 años', label: 'Con cambio de norma mezclado', emoji: '✏️' },
  { band: 'D', ages: '9–12 años', label: 'Rápido y con secuencia inversa', emoji: '🚀' },
];

export const EF_DOMAIN_META: Record<
  EfDomain,
  { title: string; game: string; emoji: string; instruction: string }
> = {
  attention: {
    title: 'Atención',
    game: 'Busca y encuentra',
    emoji: '🔎',
    instruction: 'Toca TODOS los gatitos que veas, ¡lo más rápido que puedas!',
  },
  inhibition: {
    title: 'Inhibición',
    game: 'No despiertes al lobo',
    emoji: '🐺',
    instruction: 'Toca cada animal que aparezca… ¡pero NUNCA toques al lobo, que está dormido!',
  },
  flexibility: {
    title: 'Flexibilidad',
    game: 'El juego de las normas',
    emoji: '🔄',
    instruction: 'Mira la tarjeta y tócala donde toque según la norma. ¡Atención, la norma cambia!',
  },
  workingMemory: {
    title: 'Memoria de trabajo',
    game: 'El loro repetidor',
    emoji: '🦜',
    instruction: 'Mira qué tarjetas se encienden y repite la secuencia tocándolas en el mismo orden.',
  },
  planning: {
    title: 'Planificación',
    game: 'Ordena la historia',
    emoji: '🧩',
    instruction: 'Estas tarjetas están desordenadas: tócalas en el orden correcto de la historia.',
  },
};

/** Orden fijo de presentación de los mini-juegos en la batería. */
export const EF_DOMAIN_ORDER: EfDomain[] = [
  'attention',
  'inhibition',
  'flexibility',
  'workingMemory',
  'planning',
];

/* ------------------------------ PRNG (semilla) ----------------------------- */
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
/* eslint-enable no-bitwise */

const clamp100 = (v: number): number => Math.max(0, Math.min(100, Math.round(v)));

/* ------------------------- 1 · Atención (búsqueda) ------------------------- */

export interface AttentionPlan {
  targetGlyph: string;
  /** Tarjetas de la lámina en orden de pantalla (objetivos + distractores). */
  cards: { glyph: string; isTarget: boolean }[];
  targetCount: number;
}

export interface AttentionResult {
  targets: number;
  hits: number; // objetivos encontrados
  falseTaps: number; // toques a distractores (comisiones)
  elapsedMs: number;
}

const ATTENTION_TARGET = '🐱';
const ATTENTION_DISTRACTORS = ['🐶', '🐰', '🐭', '🦊', '🐻', '🐼', '🐨', '🐷', '🐮', '🐵', '🦁', '🐯', '🐹', '🐔'];

const ATTENTION_CONFIG: Record<EfAgeBand, { cards: number; targets: number }> = {
  A: { cards: 9, targets: 3 },
  B: { cards: 12, targets: 4 },
  C: { cards: 16, targets: 5 },
  D: { cards: 20, targets: 6 },
};

export const buildAttentionPlan = (band: EfAgeBand, seed: number): AttentionPlan => {
  const cfg = ATTENTION_CONFIG[band];
  const rand = mulberry32(seed + 11);
  const distractors = shuffleWith(ATTENTION_DISTRACTORS, rand);
  const cards: { glyph: string; isTarget: boolean }[] = [];
  for (let i = 0; i < cfg.targets; i++) cards.push({ glyph: ATTENTION_TARGET, isTarget: true });
  for (let i = 0; i < cfg.cards - cfg.targets; i++) {
    cards.push({ glyph: distractors[i % distractors.length], isTarget: false });
  }
  return { targetGlyph: ATTENTION_TARGET, cards: shuffleWith(cards, rand), targetCount: cfg.targets };
};

/** 0–100: proporción de objetivos encontrados, penalizando cada comisión. */
export const scoreAttention = (r: AttentionResult): number =>
  clamp100((r.hits / Math.max(1, r.targets)) * 100 - r.falseTaps * 12);

/* ------------------------ 2 · Inhibición (go/no-go) ------------------------ */

export interface InhibitionPlan {
  nogoGlyph: string;
  /** Ensayos en orden: glyph + tipo. */
  trials: { glyph: string; isNogo: boolean }[];
  /** Ventana de respuesta por ensayo (ms). */
  stimulusMs: number;
}

export interface InhibitionResult {
  goTrials: number;
  nogoTrials: number;
  goHits: number; // animales tocados a tiempo
  omissions: number; // animales NO tocados
  commissions: number; // lobos tocados (fallo de inhibición)
}

const INHIBITION_NOGO = '🐺';
const INHIBITION_GO = ['🐱', '🐶', '🐰', '🐸', '🐢', '🦆', '🐮', '🐷', '🐭', '🐻'];

const INHIBITION_CONFIG: Record<EfAgeBand, { trials: number; nogo: number; stimulusMs: number }> = {
  A: { trials: 12, nogo: 4, stimulusMs: 2600 },
  B: { trials: 16, nogo: 5, stimulusMs: 2200 },
  C: { trials: 20, nogo: 6, stimulusMs: 1900 },
  D: { trials: 24, nogo: 8, stimulusMs: 1600 },
};

export const buildInhibitionPlan = (band: EfAgeBand, seed: number): InhibitionPlan => {
  const cfg = INHIBITION_CONFIG[band];
  const rand = mulberry32(seed + 22);
  const flags: boolean[] = [
    ...Array(cfg.nogo).fill(true),
    ...Array(cfg.trials - cfg.nogo).fill(false),
  ];
  // Los dos primeros ensayos son SIEMPRE «go»: consolidan la mecánica antes
  // de exigir inhibición (estándar en go/no-go infantil).
  let order = shuffleWith(flags, rand);
  for (let guard = 0; (order[0] || order[1]) && guard < 50; guard++) {
    order = shuffleWith(flags, rand);
  }
  const trials = order.map(isNogo => ({
    glyph: isNogo ? INHIBITION_NOGO : INHIBITION_GO[Math.floor(rand() * INHIBITION_GO.length)],
    isNogo,
  }));
  return { nogoGlyph: INHIBITION_NOGO, trials, stimulusMs: cfg.stimulusMs };
};

/** 0–100: aciertos go + rechazos correctos no-go sobre el total de ensayos. */
export const scoreInhibition = (r: InhibitionResult): number => {
  const total = r.goTrials + r.nogoTrials;
  if (!total) return 0;
  const correct = r.goHits + (r.nogoTrials - r.commissions);
  return clamp100((correct / total) * 100);
};

/* ----------------------- 3 · Flexibilidad (DCCS) --------------------------- */

export type EfColor = 'rojo' | 'azul';
export type EfShape = 'pez' | 'flor';
export type EfRule = 'color' | 'forma';

export const EF_SHAPE_GLYPH: Record<EfShape, string> = { pez: '🐟', flor: '🌸' };

/* ---- anuncios hablados de la norma vigente (flexibilidad · DCCS) ----------
 * Viven aquí, en el módulo PURO del juego, para que el banco de voz
 * (`viaVoiceConsignas.ts`) los enumere DERIVÁNDOLOS de la misma función que
 * los dicta en pantalla: si el texto cambia, cambia su id de locución y el
 * asset se regenera, sin que corpus y juego puedan divergir (P3).
 * Antes el componente componía estas frases al vuelo y las locutaba sin
 * lengua, así que en una sesión dominicana el juego cambiaba de acento a
 * mitad de prueba. */

/** Complemento hablado de cada norma («por color» / «por forma»). */
export const EF_RULE_PHRASE: Record<EfRule, string> = {
  color: 'por color',
  forma: 'por forma',
};

/** Aviso de CAMBIO de norma (el niño debe enterarse aunque no sepa leer). */
export const efRuleChangeText = (rule: EfRule): string =>
  `¡Atención! La norma ha cambiado: ahora se juega ${EF_RULE_PHRASE[rule]}.`;

/** Anuncio de la norma INICIAL (la consigna de la antesala es genérica). */
export const efRuleIntroText = (rule: EfRule): string => `Se juega ${EF_RULE_PHRASE[rule]}.`;

/** Todas las normas, para que el corpus las enumere sin repetir la lista. */
export const EF_RULES: readonly EfRule[] = ['color', 'forma'];
export const EF_COLOR_BG: Record<EfColor, string> = { rojo: '#FECACA', azul: '#BFDBFE' };
export const EF_COLOR_BORDER: Record<EfColor, string> = { rojo: '#EF4444', azul: '#3B82F6' };

export interface FlexibilityCard {
  shape: EfShape;
  color: EfColor;
}

export interface FlexibilityTrial {
  rule: EfRule;
  stimulus: FlexibilityCard;
  /** true si es el primer ensayo tras un cambio de norma (aviso grande en UI). */
  ruleChanged: boolean;
  /** Bloque al que pertenece: pre (1ª norma), post (2ª norma), mixed. */
  block: 'pre' | 'post' | 'mixed';
}

export interface FlexibilityPlan {
  /** Tarjetas objetivo fijas (izquierda/derecha), en conflicto por diseño. */
  targets: [FlexibilityCard, FlexibilityCard];
  trials: FlexibilityTrial[];
}

export interface FlexibilityResult {
  preCorrect: number;
  preTotal: number;
  postCorrect: number;
  postTotal: number;
  mixedCorrect: number;
  mixedTotal: number;
}

const FLEXIBILITY_CONFIG: Record<EfAgeBand, { pre: number; post: number; mixed: number }> = {
  A: { pre: 4, post: 4, mixed: 0 },
  B: { pre: 5, post: 5, mixed: 0 },
  C: { pre: 5, post: 5, mixed: 6 },
  D: { pre: 4, post: 4, mixed: 10 },
};

/** Objetivo correcto de un ensayo DCCS: por color o por forma. */
export const flexibilityAnswerIndex = (
  targets: [FlexibilityCard, FlexibilityCard],
  trial: FlexibilityTrial,
): 0 | 1 => {
  const match = (t: FlexibilityCard) =>
    trial.rule === 'color' ? t.color === trial.stimulus.color : t.shape === trial.stimulus.shape;
  return match(targets[0]) ? 0 : 1;
};

export const buildFlexibilityPlan = (band: EfAgeBand, seed: number): FlexibilityPlan => {
  const cfg = FLEXIBILITY_CONFIG[band];
  const rand = mulberry32(seed + 33);
  // Objetivos clásicos del DCCS: cada estímulo coincide con un objetivo en
  // color y con el OTRO en forma (conflicto garantizado).
  const targets: [FlexibilityCard, FlexibilityCard] = [
    { shape: 'pez', color: 'azul' },
    { shape: 'flor', color: 'rojo' },
  ];
  const stimuli: FlexibilityCard[] = [
    { shape: 'pez', color: 'rojo' },
    { shape: 'flor', color: 'azul' },
  ];
  const firstRule: EfRule = rand() < 0.5 ? 'color' : 'forma';
  const secondRule: EfRule = firstRule === 'color' ? 'forma' : 'color';

  const trials: FlexibilityTrial[] = [];
  const pushTrial = (rule: EfRule, block: FlexibilityTrial['block'], ruleChanged: boolean) =>
    trials.push({ rule, stimulus: stimuli[Math.floor(rand() * 2)], ruleChanged, block });

  for (let i = 0; i < cfg.pre; i++) pushTrial(firstRule, 'pre', false);
  for (let i = 0; i < cfg.post; i++) pushTrial(secondRule, 'post', i === 0);
  let lastRule: EfRule = secondRule;
  for (let i = 0; i < cfg.mixed; i++) {
    const rule: EfRule = rand() < 0.5 ? 'color' : 'forma';
    pushTrial(rule, 'mixed', rule !== lastRule);
    lastRule = rule;
  }
  return { targets, trials };
};

/** 0–100 ponderando el coste del cambio: el bloque post-switch y el mixto
 *  valen el doble que el pre-switch (miden la flexibilidad de verdad). */
export const scoreFlexibility = (r: FlexibilityResult): number => {
  let num = 0;
  let den = 0;
  if (r.preTotal) {
    num += (r.preCorrect / r.preTotal) * 1;
    den += 1;
  }
  if (r.postTotal) {
    num += (r.postCorrect / r.postTotal) * 2;
    den += 2;
  }
  if (r.mixedTotal) {
    num += (r.mixedCorrect / r.mixedTotal) * 2;
    den += 2;
  }
  return den ? clamp100((num / den) * 100) : 0;
};

/* ------------------- 4 · Memoria de trabajo (span de tarjetas) ------------- */

export type SpanDirection = 'forward' | 'backward';

export interface MemoryPlan {
  /** Tarjetas del tablero (fijas durante todo el juego). */
  board: string[];
  direction: SpanDirection;
  startSpan: number;
  maxSpan: number;
  /** Nº de intentos por longitud (avanza con ≥1 correcto). */
  attemptsPerSpan: number;
  /** ms que cada tarjeta permanece iluminada / pausa entre tarjetas. */
  litMs: number;
  gapMs: number;
}

export interface MemoryResult {
  direction: SpanDirection;
  startSpan: number;
  maxSpan: number;
  /** Mayor longitud reproducida correctamente (0 = ninguna). */
  bestSpan: number;
  trialsDone: number;
}

const MEMORY_BOARD_SMALL = ['🐸', '🦆', '🐢', '🐦'];
const MEMORY_BOARD_LARGE = ['🐸', '🦆', '🐢', '🐦', '🐹', '🐙'];

const MEMORY_CONFIG: Record<
  EfAgeBand,
  { board: string[]; direction: SpanDirection; startSpan: number; maxSpan: number; litMs: number; gapMs: number }
> = {
  A: { board: MEMORY_BOARD_SMALL, direction: 'forward', startSpan: 2, maxSpan: 4, litMs: 900, gapMs: 400 },
  B: { board: MEMORY_BOARD_SMALL, direction: 'forward', startSpan: 2, maxSpan: 5, litMs: 800, gapMs: 350 },
  C: { board: MEMORY_BOARD_LARGE, direction: 'forward', startSpan: 3, maxSpan: 6, litMs: 700, gapMs: 300 },
  D: { board: MEMORY_BOARD_LARGE, direction: 'backward', startSpan: 2, maxSpan: 5, litMs: 700, gapMs: 300 },
};

export const buildMemoryPlan = (band: EfAgeBand): MemoryPlan => {
  const cfg = MEMORY_CONFIG[band];
  return { ...cfg, attemptsPerSpan: 2 };
};

/** Secuencia de índices del tablero para una longitud dada (sin repetición
 *  inmediata: dos destellos seguidos en la misma tarjeta se confunden). */
export const buildMemorySequence = (plan: MemoryPlan, span: number, seed: number): number[] => {
  const rand = mulberry32(seed + 44 + span * 101);
  const seq: number[] = [];
  for (let i = 0; i < span; i++) {
    let idx = Math.floor(rand() * plan.board.length);
    while (i > 0 && idx === seq[i - 1]) idx = Math.floor(rand() * plan.board.length);
    seq.push(idx);
  }
  return seq;
};

/** Respuesta esperada según la dirección del span. */
export const expectedMemoryAnswer = (sequence: number[], direction: SpanDirection): number[] =>
  direction === 'forward' ? sequence : [...sequence].reverse();

/** 0–100 relativo al recorrido de la banda (startSpan−1 → 0 · maxSpan → 100). */
export const scoreMemory = (r: MemoryResult): number => {
  const floor = r.startSpan - 1;
  if (r.bestSpan <= floor) return r.bestSpan > 0 ? 20 : 0;
  return clamp100(((r.bestSpan - floor) / Math.max(1, r.maxSpan - floor)) * 100);
};

/* --------------------- 5 · Planificación (secuenciación) ------------------- */

export interface PlanningSequence {
  id: string;
  title: string;
  /** Tarjetas EN ORDEN correcto; la UI las presenta barajadas. */
  ordered: string[];
}

export interface PlanningTrial {
  sequence: PlanningSequence;
  /** Orden de pantalla (barajado, nunca igual al correcto). */
  displayOrder: number[]; // índices sobre `ordered`
}

export interface PlanningPlan {
  trials: PlanningTrial[];
}

export interface PlanningResult {
  /** Posiciones correctas conseguidas sobre el total (crédito parcial). */
  correctPositions: number;
  totalPositions: number;
  /** Secuencias perfectas. */
  perfectSequences: number;
  sequences: number;
}

const SEQ_BANK_3: PlanningSequence[] = [
  { id: 'planta3', title: 'La planta crece', ordered: ['🌱', '🌿', '🌳'] },
  { id: 'pollito3', title: 'El pollito nace', ordered: ['🥚', '🐣', '🐤'] },
  { id: 'tamanyo3', title: 'De pequeño a grande', ordered: ['🐭', '🐱', '🐘'] },
];

const SEQ_BANK_4: PlanningSequence[] = [
  { id: 'pollito4', title: 'Del huevo a la gallina', ordered: ['🥚', '🐣', '🐤', '🐔'] },
  { id: 'edades4', title: 'De bebé a abuelo', ordered: ['👶', '🧒', '🧑', '🧓'] },
  { id: 'tamanyo4', title: 'De pequeño a grande', ordered: ['🐜', '🐭', '🐶', '🐘'] },
  { id: 'luna4', title: 'La luna crece', ordered: ['🌑', '🌒', '🌓', '🌕'] },
];

const SEQ_BANK_5: PlanningSequence[] = [
  { id: 'luna5', title: 'La luna crece', ordered: ['🌑', '🌒', '🌓', '🌔', '🌕'] },
  { id: 'tamanyo5', title: 'De pequeño a grande', ordered: ['🐜', '🐭', '🐱', '🐴', '🐘'] },
  { id: 'numeros5', title: 'Cuenta en orden', ordered: ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'] },
];

const PLANNING_CONFIG: Record<EfAgeBand, { bank: PlanningSequence[]; count: number }> = {
  A: { bank: SEQ_BANK_3, count: 2 },
  B: { bank: SEQ_BANK_4, count: 2 },
  C: { bank: SEQ_BANK_4, count: 3 },
  D: { bank: SEQ_BANK_5, count: 3 },
};

export const buildPlanningPlan = (band: EfAgeBand, seed: number): PlanningPlan => {
  const cfg = PLANNING_CONFIG[band];
  const rand = mulberry32(seed + 55);
  const sequences = shuffleWith(cfg.bank, rand).slice(0, cfg.count);
  const trials = sequences.map(sequence => {
    const indices = sequence.ordered.map((_, i) => i);
    let displayOrder = shuffleWith(indices, rand);
    // Nunca presentar ya ordenada (no habría nada que planificar).
    for (let guard = 0; displayOrder.every((v, i) => v === i) && guard < 20; guard++) {
      displayOrder = shuffleWith(indices, rand);
    }
    return { sequence, displayOrder };
  });
  return { trials };
};

/** 0–100: crédito parcial por posiciones correctas. */
export const scorePlanning = (r: PlanningResult): number =>
  r.totalPositions ? clamp100((r.correctPositions / r.totalPositions) * 100) : 0;

/* ------------------------------ agregación -------------------------------- */

export interface EfDomainScores {
  attention: number | null;
  inhibition: number | null;
  flexibility: number | null;
  workingMemory: number | null;
  planning: number | null;
}

/** Detalle bruto por dominio que se persiste en `results` (simple-json). */
export interface EfRawResults {
  attention?: AttentionResult;
  inhibition?: InhibitionResult;
  flexibility?: FlexibilityResult;
  workingMemory?: MemoryResult;
  planning?: PlanningResult;
}

export const EMPTY_EF_SCORES: EfDomainScores = {
  attention: null,
  inhibition: null,
  flexibility: null,
  workingMemory: null,
  planning: null,
};

/** Cortes orientativos (a validar clínicamente). */
export const EF_OK_CUT = 80;
export const EF_WARN_CUT = 60;

export const efStatus = (score: number): EfStatus =>
  score >= EF_OK_CUT ? 'ok' : score >= EF_WARN_CUT ? 'warn' : 'alt';

/** Media de los dominios completados (null si no hay ninguno). */
export const efOverallScore = (scores: EfDomainScores): number | null => {
  const done = EF_DOMAIN_ORDER.map(d => scores[d]).filter((v): v is number => v !== null);
  if (!done.length) return null;
  return Math.round(done.reduce((a, b) => a + b, 0) / done.length);
};

export const EF_BAND_LABEL: Record<EfAgeBand, string> = {
  A: 'Banda A · 3–4 años',
  B: 'Banda B · 5–6 años',
  C: 'Banda C · 7–8 años',
  D: 'Banda D · 9–12 años',
};

/** Interpretación clínica orientativa (misma voz que el resto de módulos). */
export const interpretExecutiveFunctions = (band: EfAgeBand, scores: EfDomainScores): string => {
  const overall = efOverallScore(scores);
  if (overall === null) {
    return 'Exploración de funciones ejecutivas: sin juegos completados, no interpretable.';
  }
  const parts: string[] = [
    `Exploración lúdica de funciones ejecutivas (${EF_BAND_LABEL[band]}): índice global ${overall}/100`,
  ];
  const flagged: string[] = [];
  const pending: string[] = [];
  for (const domain of EF_DOMAIN_ORDER) {
    const s = scores[domain];
    const meta = EF_DOMAIN_META[domain];
    if (s === null) {
      pending.push(meta.title.toLowerCase());
      continue;
    }
    parts.push(`${meta.title.toLowerCase()} ${s}/100`);
    if (efStatus(s) !== 'ok') flagged.push(`${meta.title.toLowerCase()} (${s})`);
  }
  let text = parts.join(' · ') + '.';
  if (pending.length) text += ` Juegos no completados: ${pending.join(', ')}.`;
  if (flagged.length) {
    text +=
      ` Rendimiento por debajo de lo esperado en: ${flagged.join(', ')}.` +
      ' Se recomienda valoración neuropsicológica con instrumentos estandarizados.';
  } else {
    text += ' Rendimiento dentro de lo esperado en todos los dominios explorados.';
  }
  text +=
    ' Cribado orientativo mediante juego de tarjetas con dificultad graduada por edad: no constituye diagnóstico.';
  return text;
};
