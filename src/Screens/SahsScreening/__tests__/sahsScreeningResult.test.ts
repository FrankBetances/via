import {
  computeSahsScore,
  imcLabel,
  isPsqPositive,
  isPsqRisk,
  PSQ_QUESTIONS,
  PSQ_TOTAL,
  PsqAnswers,
  recommendationFor,
  SAHS_SCORE_MAX,
  SahsInput,
  suspicionLabel,
} from '../sahsScreeningResult';

/* -------------------------------------------------------------------------- */
/*  Fija el comportamiento ACTUAL del cálculo del cribado de SAHS infantil.   */
/*  Los tests `it.failing` marcan un FALLO REAL (regla 4 de CLAUDE.md: un     */
/*  estado no comprobado no se presume favorable): hoy el código lo incumple  */
/*  y el test pasa SOLO mientras siga incumpliéndolo; al arreglarlo, Jest     */
/*  avisará de que hay que quitar el `.failing`.                              */
/* -------------------------------------------------------------------------- */

/** Respuestas con «Sí» en los primeros `n` ítems que NO son 6 ni 7 (alarma), el resto «No». */
const psqYes = (n: number, extraYes: number[] = []): PsqAnswers => {
  const a: PsqAnswers = {};
  let given = 0;
  for (let i = 1; i <= PSQ_TOTAL; i++) {
    const isFlag = i === 6 || i === 7;
    if (!isFlag && given < n) {
      a[i] = true;
      given++;
    } else {
      a[i] = false;
    }
  }
  extraYes.forEach(id => {
    a[id] = true;
  });
  return a;
};

const allNo = (): PsqAnswers => psqYes(0);

const input = (over: Partial<SahsInput> = {}): SahsInput => ({
  psq: allNo(),
  brodsky: 0,
  imc: 'normo',
  riskFactors: [],
  ...over,
});

describe('PSQ de Chervin: corte de cribado positivo (33 %)', () => {
  it('7/22 (31,8 %) no es positivo; 8/22 (36,4 %) sí', () => {
    expect(isPsqPositive(7)).toBe(false);
    expect(isPsqPositive(8)).toBe(true);
    expect(computeSahsScore(input({ psq: psqYes(7) })).psqPositive).toBe(false);
    expect(computeSahsScore(input({ psq: psqYes(8) })).psqPositive).toBe(true);
  });

  it('isPsqRisk: solo «Sí» (true) es respuesta de riesgo; «No», null y ausencia no', () => {
    expect(isPsqRisk(true)).toBe(true);
    expect(isPsqRisk(false)).toBe(false);
    expect(isPsqRisk(null)).toBe(false);
    expect(isPsqRisk(undefined)).toBe(false);
  });

  it('el modelo tiene 22 ítems y los de alarma son el 6 y el 7', () => {
    expect(PSQ_QUESTIONS).toHaveLength(PSQ_TOTAL);
    expect(PSQ_QUESTIONS.filter(q => q.flag).map(q => q.id)).toEqual([6, 7]);
  });
});

describe('puntos del PSQ (0 / 2 / 3)', () => {
  it.each([
    [0, 0],
    [7, 0], // 31,8 %: justo bajo el 33 %
    [8, 2], // 36,4 %: en el corte
    [10, 2], // 45,5 %: justo bajo el 50 %
    [11, 3], // 50 %: en el corte
    [20, 3],
  ])('%i «Sí» (sin 6 ni 7) -> %i puntos', (yes, pts) => {
    expect(computeSahsScore(input({ psq: psqYes(yes) })).breakdown.psq).toBe(pts);
  });

  it('cuenta yesCount, answeredCount y prop', () => {
    const s = computeSahsScore(input({ psq: psqYes(11) }));
    expect(s.yesCount).toBe(11);
    expect(s.answeredCount).toBe(22);
    expect(s.prop).toBeCloseTo(0.5, 10);
  });
});

describe('apnea presenciada / preocupación (ítems 6 y 7)', () => {
  it('ninguno -> 0; el 6 solo, el 7 solo o ambos -> 2 (no suma 4)', () => {
    expect(computeSahsScore(input()).breakdown.apnea).toBe(0);
    expect(computeSahsScore(input({ psq: psqYes(0, [6]) })).breakdown.apnea).toBe(2);
    expect(computeSahsScore(input({ psq: psqYes(0, [7]) })).breakdown.apnea).toBe(2);
    const both = computeSahsScore(input({ psq: psqYes(0, [6, 7]) }));
    expect(both.breakdown.apnea).toBe(2);
    expect(both.redFlag).toBe(true);
  });
});

describe('Brodsky e IMC', () => {
  it.each([
    [null, 0],
    [0, 0],
    [1, 0],
    [2, 0], // justo bajo el corte
    [3, 2], // en el corte
    [4, 3], // justo por encima
  ])('Brodsky %p -> %i puntos', (grade, pts) => {
    expect(computeSahsScore(input({ brodsky: grade })).breakdown.brodsky).toBe(pts);
  });

  it.each([
    [null, 0],
    ['normo', 0],
    ['sobrepeso', 1],
    ['obesidad', 2],
  ] as const)('IMC %p -> %i puntos', (imc, pts) => {
    expect(computeSahsScore(input({ imc })).breakdown.imc).toBe(pts);
  });

  it('imcLabel nombra la categoría y da «—» sin dato', () => {
    expect(imcLabel('normo')).toBe('Normopeso');
    expect(imcLabel('sobrepeso')).toBe('Sobrepeso');
    expect(imcLabel('obesidad')).toBe('Obesidad');
    expect(imcLabel(null)).toBe('—');
  });
});

describe('factores de riesgo (tope 3)', () => {
  it.each([
    [0, 0],
    [1, 1],
    [3, 3],
    [4, 3],
    [10, 3],
  ])('%i factores -> %i puntos', (n, pts) => {
    const riskFactors = Array.from({ length: n }, (_, i) => `f${i}`);
    expect(computeSahsScore(input({ riskFactors })).breakdown.risk).toBe(pts);
  });
});

describe('nivel de sospecha: cortes del total (<3 baja, 3-5 media, >=6 alta)', () => {
  // Totales construidos con Brodsky/IMC/factores para no mezclar el override del PSQ.
  it('total 2 -> low (justo bajo el corte de media)', () => {
    const s = computeSahsScore(input({ imc: 'obesidad' }));
    expect(s.total).toBe(2);
    expect(s.level).toBe('low');
  });

  it('total 3 -> med (en el corte)', () => {
    const s = computeSahsScore(input({ imc: 'obesidad', riskFactors: ['a'] }));
    expect(s.total).toBe(3);
    expect(s.level).toBe('med');
  });

  it('total 5 -> med (justo bajo el corte de alta)', () => {
    const s = computeSahsScore(input({ brodsky: 4, imc: 'obesidad' }));
    expect(s.total).toBe(5);
    expect(s.level).toBe('med');
  });

  it('total 6 -> high (en el corte)', () => {
    const s = computeSahsScore(input({ brodsky: 4, imc: 'obesidad', riskFactors: ['a'] }));
    expect(s.total).toBe(6);
    expect(s.level).toBe('high');
  });

  it('el máximo es 13 y coincide con SAHS_SCORE_MAX', () => {
    const s = computeSahsScore({
      psq: psqYes(20, [6, 7]),
      brodsky: 4,
      imc: 'obesidad',
      riskFactors: ['a', 'b', 'c'],
    });
    expect(s.total).toBe(13);
    expect(s.totalMax).toBe(SAHS_SCORE_MAX);
    expect(SAHS_SCORE_MAX).toBe(13);
    expect(s.level).toBe('high');
  });

  it('el total es la suma exacta del desglose', () => {
    const s = computeSahsScore({ psq: psqYes(9, [7]), brodsky: 3, imc: 'sobrepeso', riskFactors: ['a', 'b'] });
    const b = s.breakdown;
    expect(s.total).toBe(b.psq + b.apnea + b.brodsky + b.imc + b.risk);
    expect(s.total).toBe(2 + 2 + 2 + 1 + 2);
  });
});

describe('override clínico: PSQ positivo + apnea presenciada eleva media a alta', () => {
  it('PSQ positivo + ítem 6 con total 4 (media) -> high', () => {
    const s = computeSahsScore(input({ psq: psqYes(7, [6]) })); // 8 «Sí» con el 6 => 2 + 2 puntos
    expect(s.psqPositive).toBe(true);
    expect(s.redFlag).toBe(true);
    expect(s.total).toBe(4);
    expect(s.level).toBe('high');
  });

  it('PSQ positivo SIN apnea (total 4) se queda en med', () => {
    const s = computeSahsScore(input({ psq: psqYes(8), brodsky: 3 }));
    expect(s.redFlag).toBe(false);
    expect(s.total).toBe(4);
    expect(s.level).toBe('med');
  });

  it('apnea SIN PSQ positivo (total 3) se queda en med', () => {
    const s = computeSahsScore(input({ psq: psqYes(0, [6]), riskFactors: ['a'] }));
    expect(s.psqPositive).toBe(false);
    expect(s.total).toBe(3);
    expect(s.level).toBe('med');
  });

  it('con 7 «Sí» (incluido el 6) el PSQ no es positivo y no hay override', () => {
    const s = computeSahsScore(input({ psq: psqYes(6, [6]) })); // 7 «Sí»
    expect(s.psqPositive).toBe(false);
    expect(s.level).toBe('low');
  });

  it('apnea presenciada SOLA (total 2) queda en low: comportamiento actual', () => {
    const s = computeSahsScore(input({ psq: psqYes(0, [6]) }));
    expect(s.total).toBe(2);
    expect(s.level).toBe('low');
  });
});

describe('respuestas incompletas o ausentes', () => {
  it('null y ausencia no cuentan como respondidas ni como «Sí»', () => {
    const s = computeSahsScore(input({ psq: { 1: true, 2: false, 3: null } }));
    expect(s.answeredCount).toBe(2);
    expect(s.yesCount).toBe(1);
  });

  it('hoy, sin datos: total 0 y nivel low (documenta el estado actual)', () => {
    const s = computeSahsScore({ psq: {}, brodsky: null, imc: null, riskFactors: [] });
    expect(s.total).toBe(0);
    expect(s.level).toBe('low');
    expect(s.answeredCount).toBe(0);
  });

  // FALLO REAL: regla 4 de CLAUDE.md. `computeSahsScore` no tiene estado «incompleto»:
  // sin una sola respuesta devuelve level 'low' («Sospecha baja», banner VERDE en
  // SahsScreeningScreen.tsx:270-280 y 739-765). `SahsSuspicionOrInc` y suspicionLabel('inc')
  // existen, pero la función nunca devuelve 'inc'.
  it.failing('FALLO REAL: sin ningún dato el nivel no puede ser el favorable «low»', () => {
    // FALLO REAL: sin datos cae en la banda favorable
    const s = computeSahsScore({ psq: {}, brodsky: null, imc: null, riskFactors: [] });
    expect(s.level).not.toBe('low');
  });

  // FALLO REAL: con la exploración sin registrar (Brodsky e IMC null) también da 'low';
  // la pantalla deja llegar al informe sin exigirla (SahsScreeningScreen.tsx:228-229).
  it.failing('FALLO REAL: PSQ casi vacío y sin exploración no da «low»', () => {
    // FALLO REAL: Brodsky/IMC null puntúan 0 igual que un resultado normal
    const s = computeSahsScore({ psq: { 1: false }, brodsky: null, imc: null, riskFactors: [] });
    expect(s.level).not.toBe('low');
  });
});

describe('etiquetas y recomendación', () => {
  it('suspicionLabel', () => {
    expect(suspicionLabel('high')).toBe('Sospecha alta');
    expect(suspicionLabel('med')).toBe('Sospecha media');
    expect(suspicionLabel('low')).toBe('Sospecha baja');
    expect(suspicionLabel('inc')).toBe('Incompleto');
  });

  it('recomendación por nivel', () => {
    expect(recommendationFor('high')).toMatchObject({ action: 'Derivar a Unidad de Sueño', referral: 'PSG · ORL' });
    expect(recommendationFor('med')).toMatchObject({ action: 'Valorar derivación', referral: 'PR · Pulsioximetría' });
    expect(recommendationFor('low')).toMatchObject({ action: 'Control evolutivo', referral: 'Revisión de salud' });
  });

  // FALLO REAL (latente, solo alcanzable saltándose el tipo): cualquier valor que no sea
  // high/med -- incluido 'inc' -- cae en «Control evolutivo», la rama favorable.
  it.failing('FALLO REAL (latente): un nivel incompleto no recibe «Control evolutivo»', () => {
    // FALLO REAL: el `default` del switch es la rama favorable
    const rec = recommendationFor('inc' as unknown as 'low');
    expect(rec.action).not.toBe('Control evolutivo');
  });
});
