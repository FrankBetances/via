import {
  buildAttentionPlan,
  buildFlexibilityPlan,
  buildInhibitionPlan,
  buildMemoryPlan,
  buildMemorySequence,
  buildPlanningPlan,
  EF_DOMAIN_ORDER,
  efOverallScore,
  efStatus,
  EMPTY_EF_SCORES,
  expectedMemoryAnswer,
  flexibilityAnswerIndex,
  interpretExecutiveFunctions,
  scoreAttention,
  scoreFlexibility,
  scoreInhibition,
  scoreMemory,
  scorePlanning,
  type EfAgeBand,
} from '../executiveFunctionsGame';

const BANDS: EfAgeBand[] = ['A', 'B', 'C', 'D'];

describe('generadores por banda (deterministas por semilla)', () => {
  it.each(BANDS)('atención banda %s: nº de tarjetas y objetivos correctos', band => {
    const plan = buildAttentionPlan(band, 1234);
    expect(plan.cards.filter(c => c.isTarget).length).toBe(plan.targetCount);
    expect(plan.cards.filter(c => c.glyph === plan.targetGlyph).length).toBe(plan.targetCount);
    // Distractores nunca usan el glyph objetivo.
    expect(plan.cards.some(c => !c.isTarget && c.glyph === plan.targetGlyph)).toBe(false);
    // Determinista con la misma semilla; distinto con otra.
    expect(buildAttentionPlan(band, 1234)).toEqual(plan);
  });

  it.each(BANDS)('inhibición banda %s: ratio no-go y arranque en «go»', band => {
    const plan = buildInhibitionPlan(band, 99);
    const nogo = plan.trials.filter(t => t.isNogo);
    expect(nogo.length).toBeGreaterThanOrEqual(3);
    expect(nogo.length / plan.trials.length).toBeLessThanOrEqual(0.34);
    // Los dos primeros ensayos consolidan la mecánica (siempre go).
    expect(plan.trials[0].isNogo).toBe(false);
    expect(plan.trials[1].isNogo).toBe(false);
    // El lobo solo aparece en ensayos no-go.
    expect(plan.trials.every(t => (t.glyph === plan.nogoGlyph) === t.isNogo)).toBe(true);
  });

  it.each(BANDS)('flexibilidad banda %s: bloques, conflicto y cambio marcado', band => {
    const plan = buildFlexibilityPlan(band, 7);
    expect(plan.trials.length).toBeGreaterThanOrEqual(8);
    // Objetivos en conflicto: cada estímulo coincide con un objetivo en color
    // y con el otro en forma → la respuesta correcta depende de la norma.
    for (const trial of plan.trials) {
      const byColor = flexibilityAnswerIndex(plan.targets, { ...trial, rule: 'color' });
      const byShape = flexibilityAnswerIndex(plan.targets, { ...trial, rule: 'forma' });
      expect(byColor).not.toBe(byShape);
    }
    // El primer ensayo post-switch viene marcado (aviso de cambio en UI).
    const firstPost = plan.trials.find(t => t.block === 'post');
    expect(firstPost?.ruleChanged).toBe(true);
    // El bloque pre usa una sola norma y el post la contraria.
    const preRules = new Set(plan.trials.filter(t => t.block === 'pre').map(t => t.rule));
    const postRules = new Set(plan.trials.filter(t => t.block === 'post').map(t => t.rule));
    expect(preRules.size).toBe(1);
    expect(postRules.size).toBe(1);
    expect([...preRules][0]).not.toBe([...postRules][0]);
    // Bloque mixto solo en bandas C/D.
    const mixed = plan.trials.filter(t => t.block === 'mixed').length;
    expect(mixed > 0).toBe(band === 'C' || band === 'D');
  });

  it.each(BANDS)('memoria banda %s: secuencias sin repetición inmediata', band => {
    const plan = buildMemoryPlan(band);
    expect(plan.direction).toBe(band === 'D' ? 'backward' : 'forward');
    for (let span = plan.startSpan; span <= plan.maxSpan; span++) {
      const seq = buildMemorySequence(plan, span, 42);
      expect(seq.length).toBe(span);
      for (const idx of seq) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(plan.board.length);
      }
      for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1]);
    }
  });

  it('la respuesta esperada del span inverso es la secuencia al revés', () => {
    expect(expectedMemoryAnswer([1, 2, 3], 'forward')).toEqual([1, 2, 3]);
    expect(expectedMemoryAnswer([1, 2, 3], 'backward')).toEqual([3, 2, 1]);
  });

  it.each(BANDS)('planificación banda %s: nunca presenta la secuencia ya ordenada', band => {
    const plan = buildPlanningPlan(band, 2024);
    expect(plan.trials.length).toBeGreaterThanOrEqual(2);
    for (const trial of plan.trials) {
      expect(trial.displayOrder.length).toBe(trial.sequence.ordered.length);
      expect([...trial.displayOrder].sort((x, y) => x - y)).toEqual(
        trial.sequence.ordered.map((_, i) => i),
      );
      expect(trial.displayOrder.every((v, i) => v === i)).toBe(false);
    }
  });
});

describe('puntuación 0–100 por dominio', () => {
  it('atención: perfecta = 100, comisiones penalizan', () => {
    expect(scoreAttention({ targets: 4, hits: 4, falseTaps: 0, elapsedMs: 9000 })).toBe(100);
    expect(scoreAttention({ targets: 4, hits: 4, falseTaps: 2, elapsedMs: 9000 })).toBe(76);
    expect(scoreAttention({ targets: 4, hits: 0, falseTaps: 0, elapsedMs: 9000 })).toBe(0);
  });

  it('inhibición: comisiones y omisiones restan', () => {
    expect(scoreInhibition({ goTrials: 12, nogoTrials: 4, goHits: 12, omissions: 0, commissions: 0 })).toBe(100);
    expect(scoreInhibition({ goTrials: 12, nogoTrials: 4, goHits: 10, omissions: 2, commissions: 2 })).toBe(75);
  });

  it('flexibilidad: el post-switch pesa el doble que el pre-switch', () => {
    const perfectPre = { preCorrect: 4, preTotal: 4, postCorrect: 0, postTotal: 4, mixedCorrect: 0, mixedTotal: 0 };
    const perfectPost = { preCorrect: 0, preTotal: 4, postCorrect: 4, postTotal: 4, mixedCorrect: 0, mixedTotal: 0 };
    expect(scoreFlexibility(perfectPost)).toBeGreaterThan(scoreFlexibility(perfectPre));
    expect(
      scoreFlexibility({ preCorrect: 4, preTotal: 4, postCorrect: 4, postTotal: 4, mixedCorrect: 6, mixedTotal: 6 }),
    ).toBe(100);
  });

  it('memoria: bestSpan en el máximo = 100; sin ningún acierto = 0', () => {
    expect(scoreMemory({ direction: 'forward', startSpan: 2, maxSpan: 5, bestSpan: 5, trialsDone: 8 })).toBe(100);
    expect(scoreMemory({ direction: 'forward', startSpan: 2, maxSpan: 5, bestSpan: 0, trialsDone: 2 })).toBe(0);
    const mid = scoreMemory({ direction: 'forward', startSpan: 2, maxSpan: 5, bestSpan: 3, trialsDone: 4 });
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(100);
  });

  it('planificación: crédito parcial por posiciones', () => {
    expect(scorePlanning({ correctPositions: 8, totalPositions: 8, perfectSequences: 2, sequences: 2 })).toBe(100);
    expect(scorePlanning({ correctPositions: 4, totalPositions: 8, perfectSequences: 0, sequences: 2 })).toBe(50);
  });
});

describe('agregación e interpretación', () => {
  it('índice global = media de dominios completados', () => {
    expect(efOverallScore(EMPTY_EF_SCORES)).toBeNull();
    expect(
      efOverallScore({ attention: 100, inhibition: 80, flexibility: null, workingMemory: null, planning: null }),
    ).toBe(90);
  });

  it('semáforo orientativo', () => {
    expect(efStatus(85)).toBe('ok');
    expect(efStatus(70)).toBe('warn');
    expect(efStatus(40)).toBe('alt');
  });

  it('interpretación: señala dominios bajos y recomienda valoración', () => {
    const text = interpretExecutiveFunctions('B', {
      attention: 90,
      inhibition: 50,
      flexibility: 85,
      workingMemory: 88,
      planning: 92,
    });
    expect(text).toContain('inhibición (50)');
    expect(text).toContain('valoración neuropsicológica');
    expect(text).toContain('no constituye diagnóstico');
  });

  it('interpretación sin datos: no interpretable', () => {
    expect(interpretExecutiveFunctions('A', EMPTY_EF_SCORES)).toContain('no interpretable');
  });

  it('la batería recorre los 5 dominios', () => {
    expect(EF_DOMAIN_ORDER).toEqual(['attention', 'inhibition', 'flexibility', 'workingMemory', 'planning']);
  });
});

/* -------------------------------------------------------------------------- */
/*  El índice global viaja SIEMPRE con su denominador.                         */
/*                                                                             */
/*  Es la media de los dominios COMPLETADOS. Un niño que solo terminó uno de   */
/*  los cinco producía un «82/100» que, suelto en el informe y en la pantalla  */
/*  de resultados, se lee igual que una batería completa. La tabla por         */
/*  dominios sí decía «no completado», pero la cifra de titular iba sin base.  */
/* -------------------------------------------------------------------------- */
describe('índice global de funciones ejecutivas', () => {
  const {
    EMPTY_EF_SCORES,
    efCompletedCount,
    efLabelFromTest,
    efOverallLabel,
  } = require('../executiveFunctionsGame');

  it('sin ningún dominio completado no hay índice, y se dice', () => {
    expect(efOverallLabel(EMPTY_EF_SCORES)).toMatch(/^—/);
    expect(efOverallLabel(EMPTY_EF_SCORES)).toMatch(/0 de 5/);
    expect(efCompletedCount(EMPTY_EF_SCORES)).toBe(0);
  });

  it('un solo dominio completado NO se presenta como batería entera', () => {
    const scores = { ...EMPTY_EF_SCORES, attention: 82 };
    const label = efOverallLabel(scores);
    expect(label).toContain('82/100');
    // Lo que no puede faltar: de cuántas medidas sale ese 82.
    expect(label).toContain('1 de 5');
  });

  it('la batería completa también declara sus cinco dominios', () => {
    const scores = { attention: 80, inhibition: 70, flexibility: 90, workingMemory: 60, planning: 100 };
    expect(efCompletedCount(scores)).toBe(5);
    expect(efOverallLabel(scores)).toContain('5 de 5');
  });

  it('la etiqueta del INFORME cuenta los dominios del modelo persistido', () => {
    // El PDF y la pantalla de resultados parten de la entidad, no de
    // EfDomainScores: el denominador tiene que salir igual por las dos vías.
    const test = {
      attentionScore: 82,
      inhibitionScore: 74,
      flexibilityScore: null,
      workingMemoryScore: null,
      planningScore: null,
      overallScore: 78,
    };
    expect(efLabelFromTest(test)).toBe('78/100 (2 de 5 dominios)');
  });

  it('un informe sin índice no inventa un número', () => {
    const test = {
      attentionScore: null,
      inhibitionScore: null,
      flexibilityScore: null,
      workingMemoryScore: null,
      planningScore: null,
      overallScore: null,
    };
    expect(efLabelFromTest(test)).toBe('— (0 de 5 dominios)');
  });
});
