import {
  DEFAULT_LEVEL,
  DISCRIMINATION_OK_CUT,
  DISCRIMINATION_WARN_CUT,
  VerbalItemResult,
  VerbalResults,
  bandForAge,
  computeReliability,
  computeVerbalScore,
  estimateSrtDb,
  interpretVerbal,
  resultKey,
  verbalDiscriminationStatus,
  verbalNeedsReferral,
} from '../verbalAudiometryResult';

/* -------------------------------------------------------------------------- */
/*  Pruebas de la lógica clínica de la Audiometría Verbal: selección de banda  */
/*  por edad, agregación por nivel, cortes de discriminación, URV estimado,    */
/*  fiabilidad e interpretación.                                               */
/* -------------------------------------------------------------------------- */

/** Construye un mapa de resultados a partir de tuplas [itemId, level, correct, repeats?]. */
const results = (rows: [number, number, boolean, number?][]): VerbalResults => {
  const out: VerbalResults = {};
  for (const [itemId, level, correct, repeats] of rows) {
    const r: VerbalItemResult = { itemId, level, chosenWord: 'x', correct, repeats: repeats ?? 0 };
    out[resultKey(itemId, level)] = r;
  }
  return out;
};

describe('bandForAge', () => {
  it('propone la banda por franja de edad (bordes incluidos)', () => {
    expect(bandForAge(1)).toBe('A');
    expect(bandForAge(3.9)).toBe('A');
    expect(bandForAge(4)).toBe('B');
    expect(bandForAge(5)).toBe('B');
    expect(bandForAge(6)).toBe('C');
    expect(bandForAge(8)).toBe('C');
    expect(bandForAge(9)).toBe('D');
    expect(bandForAge(15)).toBe('D');
    expect(bandForAge(42)).toBe('D'); // adultos → Banda D (solo palabras)
  });

  it('sin edad disponible (dob cifrada en Fase 1) cae a la banda más conservadora', () => {
    expect(bandForAge(null)).toBe('A');
  });
});

describe('verbalDiscriminationStatus', () => {
  it('aplica los cortes exactamente en los límites', () => {
    expect(verbalDiscriminationStatus(100)).toBe('ok');
    expect(verbalDiscriminationStatus(DISCRIMINATION_OK_CUT)).toBe('ok'); // 90
    expect(verbalDiscriminationStatus(DISCRIMINATION_OK_CUT - 1)).toBe('warn'); // 89
    expect(verbalDiscriminationStatus(DISCRIMINATION_WARN_CUT)).toBe('warn'); // 70
    expect(verbalDiscriminationStatus(DISCRIMINATION_WARN_CUT - 1)).toBe('alt'); // 69
    expect(verbalDiscriminationStatus(0)).toBe('alt');
  });
});

describe('computeVerbalScore', () => {
  it('sin respuestas devuelve el resumen vacío', () => {
    const s = computeVerbalScore({});
    expect(s.levelScores).toEqual([]);
    expect(s.presentedCount).toBe(0);
    expect(s.correctCount).toBe(0);
    expect(s.discriminationPct).toBe(0);
  });

  it('agrega por nivel, redondea el % y ordena por nivel descendente', () => {
    const s = computeVerbalScore(
      results([
        // 65 dB: 2/3 → 67 %
        [0, 65, true],
        [1, 65, true],
        [2, 65, false],
        // 50 dB: 1/2 → 50 %
        [0, 50, true],
        [1, 50, false],
      ]),
    );
    expect(s.levelScores).toEqual([
      { level: 65, presented: 3, correct: 2, pct: 67 },
      { level: 50, presented: 2, correct: 1, pct: 50 },
    ]);
    expect(s.presentedCount).toBe(5);
    expect(s.correctCount).toBe(3);
    expect(s.discriminationPct).toBe(67); // % del nivel principal (65 dB)
  });

  it('el mismo ítem a niveles distintos son resultados independientes', () => {
    const r = results([
      [7, 65, true],
      [7, 50, false],
    ]);
    expect(Object.keys(r)).toHaveLength(2);
    const s = computeVerbalScore(r);
    expect(s.presentedCount).toBe(2);
  });

  it('sin datos a 65 dB usa el mayor nivel presentado como principal', () => {
    const s = computeVerbalScore(
      results([
        [0, 50, true],
        [1, 50, true],
        [0, 40, false],
      ]),
    );
    expect(s.discriminationPct).toBe(100); // 50 dB (mayor presentado), no 40
    expect(s.levelScores[0].level).toBe(50);
  });

  it('DEFAULT_LEVEL es la voz conversacional (65 dB)', () => {
    expect(DEFAULT_LEVEL).toBe(65);
  });
});

describe('estimateSrtDb', () => {
  it('devuelve el nivel más bajo con ≥ 50 % de reconocimiento', () => {
    const { levelScores } = computeVerbalScore(
      results([
        [0, 65, true], [1, 65, true], // 100 %
        [0, 50, true], [1, 50, false], // 50 %
        [0, 40, false], [1, 40, false], // 0 %
      ]),
    );
    expect(estimateSrtDb(levelScores)).toBe(50);
  });

  it('null si ningún nivel alcanza el 50 % o no hay datos', () => {
    expect(estimateSrtDb([])).toBeNull();
    const { levelScores } = computeVerbalScore(
      results([[0, 65, false], [1, 65, false], [2, 65, true]]), // 33 %
    );
    expect(estimateSrtDb(levelScores)).toBeNull();
  });
});

describe('computeReliability', () => {
  it('null sin respuestas · 100 % sin ayudas', () => {
    expect(computeReliability({})).toBeNull();
    expect(computeReliability(results([[0, 65, true], [1, 65, false]]))).toBe(100);
  });

  it('descuenta las repeticiones usadas y satura en el suelo de 40', () => {
    expect(computeReliability(results([[0, 65, true, 1], [1, 65, true, 2]]))).toBe(76); // 100 - 3·8
    const many = results([[0, 65, true, 2], [1, 65, true, 2], [2, 65, true, 2], [3, 65, true, 2]]);
    expect(computeReliability(many)).toBe(40); // 100 - 64 → suelo
  });
});

describe('verbalNeedsReferral · interpretVerbal', () => {
  const good = computeVerbalScore(
    results([[0, 65, true], [1, 65, true], [2, 65, true], [3, 65, true], [4, 65, true],
             [5, 65, true], [6, 65, true], [7, 65, true], [8, 65, true], [9, 65, false]]), // 90 %
  );
  const bad = computeVerbalScore(
    results([[0, 65, true], [1, 65, false], [2, 65, false], [3, 65, true], [4, 65, false]]), // 40 %
  );

  it('deriva solo por debajo del corte de alerta (y nunca sin datos)', () => {
    expect(verbalNeedsReferral(good)).toBe(false);
    expect(verbalNeedsReferral(bad)).toBe(true);
    expect(verbalNeedsReferral(computeVerbalScore({}))).toBe(false);
  });

  it('la interpretación incluye %, nivel, banda y el disclaimer de campo libre', () => {
    const text = interpretVerbal('D', good, null);
    expect(text).toContain('90 %');
    expect(text).toContain('9/10');
    expect(text).toContain('65 dB');
    expect(text).toContain('voz conversacional');
    expect(text).toContain('Banda D');
    expect(text).toContain('no descarta una pérdida unilateral');
    expect(text).not.toContain('derivación'); // 90 % no deriva
  });

  it('con discriminación alterada recomienda derivación', () => {
    const text = interpretVerbal('A', bad, null);
    expect(text).toContain('40 %');
    expect(text).toContain('derivación');
    expect(text).toContain('ORL/audiología');
  });

  it('incluye los niveles secundarios y el URV cuando existen', () => {
    const score = computeVerbalScore(
      results([[0, 65, true], [1, 65, true], [0, 50, true], [1, 50, false]]),
    );
    const text = interpretVerbal('B', score, 50);
    expect(text).toContain('a 50 dB (voz baja): 50 % (1/2)');
    expect(text).toContain('URV estimado ≈ 50 dB');
  });

  it('sin respuestas lo dice explícitamente sin recomendar derivación', () => {
    const text = interpretVerbal('C', computeVerbalScore({}), null);
    expect(text).toContain('sin respuestas suficientes');
    expect(text).not.toContain('derivación');
  });
});
