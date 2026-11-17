import { MCHAT_FOLLOW, MCHAT_REFER } from '@/PDF/nlgThresholds';

import { INVERSE_ITEMS, isRiskAns, levelFromScore, rangeLabelFromScore, ScreeningAnswers } from '../autismScreeningResult';

/* -------------------------------------------------------------------------- */
/*  Fija el comportamiento ACTUAL de la lógica del cribado M-CHAT-R.          */
/*  Instrumento publicado (Robins et al., 2014): 20 ítems; riesgo = «No»      */
/*  salvo en los ítems 2, 5 y 12, donde el riesgo es «Sí». Bajo 0-2,          */
/*  medio 3-7 (entrevista de seguimiento), alto 8-20 (derivación directa).    */
/* -------------------------------------------------------------------------- */

/** Puntuación tal como la suma la pantalla: un punto por respuesta de riesgo. */
const scoreOf = (answers: ScreeningAnswers): number => {
  let s = 0;
  for (let i = 1; i <= 20; i++) if (isRiskAns(i, answers[i] ?? null)) s++;
  return s;
};

describe('ítems invertidos', () => {
  it('son exactamente el 2, el 5 y el 12 (instrumento publicado)', () => {
    expect(Object.keys(INVERSE_ITEMS).map(Number).sort((a, b) => a - b)).toEqual([2, 5, 12]);
  });

  it.each([2, 5, 12])('ítem %i: «Sí» es riesgo, «No» no', id => {
    expect(isRiskAns(id, true)).toBe(true);
    expect(isRiskAns(id, false)).toBe(false);
  });

  it.each([1, 3, 4, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20])('ítem %i: «No» es riesgo, «Sí» no', id => {
    expect(isRiskAns(id, false)).toBe(true);
    expect(isRiskAns(id, true)).toBe(false);
  });

  it('sin respuesta (null/undefined) no es riesgo en ningún ítem', () => {
    for (let id = 1; id <= 20; id++) {
      expect(isRiskAns(id, null)).toBe(false);
      expect(isRiskAns(id, undefined as unknown as null)).toBe(false);
    }
  });

  it('el patrón «todo normal» (Sí salvo 2/5/12 en No) puntúa 0 y el contrario 20', () => {
    const normal: ScreeningAnswers = {};
    const worst: ScreeningAnswers = {};
    for (let i = 1; i <= 20; i++) {
      const inv = !!INVERSE_ITEMS[i];
      normal[i] = !inv;
      worst[i] = inv;
    }
    expect(scoreOf(normal)).toBe(0);
    expect(scoreOf(worst)).toBe(20);
  });
});

describe('bandas de riesgo (completo): bajo 0-2, medio 3-7, alto 8-20', () => {
  it.each([
    [0, 'low'],
    [2, 'low'], // justo bajo el corte de medio
    [3, 'med'], // en el corte
    [7, 'med'], // justo bajo el corte de alto
    [8, 'high'], // en el corte
    [20, 'high'],
  ])('puntuación %i -> %s', (score, level) => {
    expect(levelFromScore(score, true)).toBe(level);
  });

  it.each([
    [0, 'Bajo (0–2)'],
    [2, 'Bajo (0–2)'],
    [3, 'Medio (3–7)'],
    [7, 'Medio (3–7)'],
    [8, 'Alto (8–20)'],
    [20, 'Alto (8–20)'],
  ])('rangeLabelFromScore(%i) = %s', (score, label) => {
    expect(rangeLabelFromScore(score, true)).toBe(label);
  });
});

describe('cortes frente a nlgThresholds.ts', () => {
  it('seguimiento desde 3 y derivación desde 8, igual que el motor NLG', () => {
    expect(MCHAT_FOLLOW).toBe(3);
    expect(MCHAT_REFER).toBe(8);
    expect(levelFromScore(MCHAT_FOLLOW - 1, true)).toBe('low');
    expect(levelFromScore(MCHAT_FOLLOW, true)).toBe('med');
    expect(levelFromScore(MCHAT_REFER - 1, true)).toBe('med');
    expect(levelFromScore(MCHAT_REFER, true)).toBe('high');
  });
});

describe('respuestas incompletas', () => {
  it.each([0, 2, 3, 8, 20])('puntuación %i sin todas las respuestas -> «inc», nunca una banda', score => {
    expect(levelFromScore(score, false)).toBe('inc');
    expect(rangeLabelFromScore(score, false)).toBe('Incompleto');
  });

  it('un cuestionario vacío puntúa 0 (las ausentes no suman) y por eso solo «inc» lo protege', () => {
    const a: ScreeningAnswers = {};
    for (let i = 1; i <= 20; i++) a[i] = null;
    expect(scoreOf(a)).toBe(0);
    expect(levelFromScore(scoreOf(a), false)).toBe('inc');
    // Con el indicador de «completo» mal puesto, el 0 caería en la banda favorable.
    expect(levelFromScore(scoreOf(a), true)).toBe('low');
  });
});
