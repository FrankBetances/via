/* -------------------------------------------------------------------------- */
/*  Lógica pura de la Audiometría Verbal en campo libre.                       */
/*  Sin dependencias de UI/DB (como `articulationResult.ts`): fuente única     */
/*  para la pantalla, la hoja de resultados y el PDF.                          */
/*                                                                             */
/*  Logoaudiometría de reconocimiento de CONJUNTO CERRADO: suena una palabra   */
/*  por el altavoz (campo libre, binaural, sin audífonos) y el paciente        */
/*  selecciona la tarjeta correspondiente entre N alternativas fonéticamente   */
/*  confundibles. Salida primaria: % de discriminación por nivel; opcional el  */
/*  URV (umbral de recepción verbal) por descenso.                             */
/*                                                                             */
/*  ⚠ El nivel absoluto por altavoz es ORIENTATIVO (ver                        */
/*  `audiometryCalibration.ts`); los resultados no constituyen diagnóstico.    */
/*  Diseño: docs/design/audiometria-verbal.md                                  */
/* -------------------------------------------------------------------------- */

/** Franja de edad → lista de estímulos y modalidad de tarjeta. */
export type AgeBand = 'A' | 'B' | 'C' | 'D';

/** Modalidad de la tarjeta de selección (WordCard). */
export type CardModality = 'images' | 'mixed' | 'words';

/** Modo de la prueba: % a nivel fijo o búsqueda del URV por descenso. */
export type VerbalMode = 'discrimination' | 'threshold';

/** Respuesta registrada a un ítem presentado a un nivel concreto. */
export interface VerbalItemResult {
  itemId: number;
  level: number; // dB de presentación (orientativo)
  chosenWord: string; // palabra de la tarjeta elegida
  correct: boolean;
  repeats: number; // repeticiones del estímulo usadas (ayuda)
}

/** Mapa de resultados. Clave = `resultKey(itemId, level)`. */
export type VerbalResults = Record<string, VerbalItemResult>;

/** Agregado de aciertos por nivel de presentación. */
export interface LevelScore {
  level: number;
  presented: number;
  correct: number;
  pct: number; // 0..100 (redondeado)
}

export interface VerbalScore {
  levelScores: LevelScore[]; // orden descendente de nivel
  presentedCount: number; // total de láminas respondidas (todos los niveles)
  correctCount: number;
  /** % al nivel principal (65 dB si se presentó; si no, el mayor presentado). */
  discriminationPct: number;
}

export type VerbalStatus = 'ok' | 'warn' | 'alt';

/* ----------------------------- parámetros -------------------------------- */

/** Niveles de presentación soportados (dB, orientativos). */
export const PRESENTATION_LEVELS = [65, 50] as const;

/** Nivel principal de la prueba: voz conversacional. */
export const DEFAULT_LEVEL = 65;

/** Repeticiones máximas del estímulo por lámina (se registran como ayuda). */
export const MAX_REPEATS = 2;

/**
 * Cortes orientativos de discriminación a voz conversacional (a validar
 * clínicamente): ≥ OK_CUT esperado · ≥ WARN_CUT revisar · < WARN_CUT derivar.
 */
export const DISCRIMINATION_OK_CUT = 90;
export const DISCRIMINATION_WARN_CUT = 70;

/** Etiquetas cortas de nivel para chips/tablas ('65 dB · voz normal'). */
export const LEVEL_LABEL: Record<number, string> = {
  65: 'voz conversacional',
  50: 'voz baja',
};

export const BAND_LABEL: Record<AgeBand, string> = {
  A: 'Banda A · < 4 años',
  B: 'Banda B · 4–5 años',
  C: 'Banda C · 6–8 años',
  D: 'Banda D · 9 años – adulto',
};

export const MODALITY_LABEL: Record<CardModality, string> = {
  images: 'solo imágenes',
  mixed: 'imagen + palabra',
  words: 'solo palabras',
};

/* ------------------------------- helpers --------------------------------- */

/**
 * Banda autopropuesta por edad (años). `null` (edad no disponible: la fecha de
 * nacimiento viaja cifrada en Fase 1) → banda A, la más conservadora; el
 * profesional siempre puede hacer override manual.
 */
export const bandForAge = (years: number | null): AgeBand => {
  if (years == null || years < 4) return 'A';
  if (years <= 5) return 'B';
  if (years <= 8) return 'C';
  return 'D';
};

/** Clave estable de un resultado en `VerbalResults`. */
export const resultKey = (itemId: number, level: number): string => `${itemId}@${level}`;

/** Estado clínico del % de discriminación (semáforo de la hoja de resultados). */
export const verbalDiscriminationStatus = (pct: number): VerbalStatus =>
  pct >= DISCRIMINATION_OK_CUT ? 'ok' : pct >= DISCRIMINATION_WARN_CUT ? 'warn' : 'alt';

/* ------------------------------ puntuación ------------------------------- */

/**
 * Agrega el mapa de resultados en el resumen clínico: % por nivel (orden
 * descendente de nivel) y % principal (65 dB si se presentó; si no, el mayor
 * nivel presentado; 0 si no hay respuestas).
 */
export const computeVerbalScore = (results: VerbalResults): VerbalScore => {
  const byLevel = new Map<number, { presented: number; correct: number }>();
  let presentedCount = 0;
  let correctCount = 0;

  for (const r of Object.values(results)) {
    const acc = byLevel.get(r.level) ?? { presented: 0, correct: 0 };
    acc.presented++;
    if (r.correct) acc.correct++;
    byLevel.set(r.level, acc);
    presentedCount++;
    if (r.correct) correctCount++;
  }

  const levelScores: LevelScore[] = [...byLevel.entries()]
    .map(([level, { presented, correct }]) => ({
      level,
      presented,
      correct,
      pct: Math.round((correct / presented) * 100),
    }))
    .sort((a, b) => b.level - a.level);

  const main =
    levelScores.find(ls => ls.level === DEFAULT_LEVEL) ?? levelScores[0] ?? null;

  return {
    levelScores,
    presentedCount,
    correctCount,
    discriminationPct: main ? main.pct : 0,
  };
};

/**
 * URV / SRT estimado: nivel MÁS BAJO presentado con ≥ 50 % de reconocimiento.
 * `null` si ningún nivel alcanza el 50 % o no hay datos. Estimación gruesa
 * (pasos de bloque, sin interpolación) y en dB orientativos.
 */
export const estimateSrtDb = (levelScores: LevelScore[]): number | null => {
  const reached = levelScores.filter(ls => ls.pct >= 50);
  if (!reached.length) return null;
  return Math.min(...reached.map(ls => ls.level));
};

/**
 * Fiabilidad orientativa (0–100): parte de 100 y descuenta las ayudas
 * (repeticiones del estímulo) usadas. `null` sin respuestas. Suelo en 40 para
 * que el indicador siga siendo legible («muy baja») sin colapsar a 0.
 */
export const computeReliability = (results: VerbalResults): number | null => {
  const values = Object.values(results);
  if (!values.length) return null;
  const totalRepeats = values.reduce((acc, r) => acc + r.repeats, 0);
  return Math.max(40, 100 - totalRepeats * 8);
};

/* ---------------------------- interpretación ----------------------------- */

/**
 * ¿Se recomienda derivar a ORL/audiología? Con datos al nivel principal:
 * discriminación < DISCRIMINATION_WARN_CUT. Sin datos: no interpretable
 * (se deriva la decisión al clínico, no se recomienda automáticamente).
 */
export const verbalNeedsReferral = (score: VerbalScore): boolean => {
  if (!score.presentedCount) return false;
  return score.discriminationPct < DISCRIMINATION_WARN_CUT;
};

const statusText = (pct: number): string => {
  const st = verbalDiscriminationStatus(pct);
  if (st === 'ok') return 'reconocimiento verbal dentro de lo esperado';
  if (st === 'warn') return 'reconocimiento verbal reducido';
  return 'reconocimiento verbal alterado';
};

/**
 * Interpretación clínica orientativa (misma voz que `interpretAudiometry`):
 * resumen por nivel + URV + recomendación + disclaimers de campo libre.
 */
export const interpretVerbal = (
  band: AgeBand,
  score: VerbalScore,
  srtDb: number | null,
): string => {
  const parts: string[] = [];

  if (!score.presentedCount) {
    parts.push('Audiometría verbal: sin respuestas suficientes para valorar la discriminación');
  } else {
    const main =
      score.levelScores.find(ls => ls.level === DEFAULT_LEVEL) ?? score.levelScores[0];
    parts.push(
      `Audiometría verbal en campo libre (${BAND_LABEL[band]}): discriminación ${main.pct} % ` +
        `(${main.correct}/${main.presented}) a ${main.level} dB` +
        (LEVEL_LABEL[main.level] ? ` (${LEVEL_LABEL[main.level]})` : '') +
        ` — ${statusText(main.pct)}`,
    );
    for (const ls of score.levelScores) {
      if (ls.level === main.level) continue;
      parts.push(
        `a ${ls.level} dB` +
          (LEVEL_LABEL[ls.level] ? ` (${LEVEL_LABEL[ls.level]})` : '') +
          `: ${ls.pct} % (${ls.correct}/${ls.presented})`,
      );
    }
    if (srtDb !== null) parts.push(`URV estimado ≈ ${srtDb} dB`);
  }

  let text = parts.join(' · ') + '.';
  if (verbalNeedsReferral(score)) {
    text +=
      ' Ante indicios de dificultad de reconocimiento verbal, se recomienda derivación a un centro' +
      ' especializado (ORL/audiología) para logoaudiometría diagnóstica.';
  }
  text +=
    ' Prueba de conjunto cerrado en campo libre binaural con nivel orientativo: estima el mejor' +
    ' oído y no descarta una pérdida unilateral.';
  return text;
};
