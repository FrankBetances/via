import {
  BOLUS_LIST,
  MIN_SPO2_DROP,
  BoloState,
  emptyBoloState,
  deriveBolo,
  nextBoloId,
  analyzeDysphagia,
  dysphagiaVerdict,
} from '../dysphagiaResult';

/* Sin @types/node: globals de Jest declarados localmente (como luaProtocolGate.test.ts). */
declare function require(name: string): any;
declare const __dirname: string;
const fs = require('fs');
const path = require('path');

const BASAL = 98;

const empty = (): Record<number, BoloState> => {
  const r: Record<number, BoloState> = {};
  for (let i = 1; i <= 9; i++) r[i] = emptyBoloState();
  return r;
};
const ev = (over: Partial<BoloState> = {}, safety = {}, efficacy = {}): BoloState => ({
  ...emptyBoloState(),
  evaluated: true,
  spo2: BASAL,
  ...over,
  safety: { tos: false, cambio_voz: false, ...safety },
  efficacy: { sello_labial: false, residuo: false, deglucion_fraccionada: false, ...efficacy },
});
const run = (states: Record<number, BoloState>, basal = BASAL) => {
  const a = analyzeDysphagia(states, basal);
  return { ...a, verdict: dysphagiaVerdict(a) };
};

describe('deriveBolo', () => {
  it('desaturación: borde exacto de MIN_SPO2_DROP', () => {
    expect(deriveBolo(ev({ spo2: BASAL - (MIN_SPO2_DROP - 1) }), BASAL).desat).toBe(false);
    expect(deriveBolo(ev({ spo2: BASAL - MIN_SPO2_DROP }), BASAL).desat).toBe(true);
    expect(deriveBolo(ev({ spo2: BASAL - MIN_SPO2_DROP - 1 }), BASAL).hasSafety).toBe(true);
  });
  it('subida de SpO2 no es desaturación', () => {
    expect(deriveBolo(ev({ spo2: 99 }), 95).desat).toBe(false);
  });
  it('tos o cambio de voz son seguridad; los de eficacia no', () => {
    expect(deriveBolo(ev({}, { tos: true }), BASAL).hasSafety).toBe(true);
    expect(deriveBolo(ev({}, { cambio_voz: true }), BASAL).hasSafety).toBe(true);
    const e = deriveBolo(ev({}, {}, { residuo: true }), BASAL);
    expect(e.hasSafety).toBe(false);
    expect(e.hasEfficacy).toBe(true);
  });
  it.each(['sello_labial', 'residuo', 'deglucion_fraccionada'])('eficacia por %s', k => {
    expect(deriveBolo(ev({}, {}, { [k]: true }), BASAL).hasEfficacy).toBe(true);
  });
});

describe('veredicto', () => {
  it('safe: evaluado sin alteración', () => {
    const s = empty();
    s[1] = ev();
    expect(run(s).verdict).toBe('safe');
  });
  it('efficacy: solo eficacia', () => {
    const s = empty();
    s[1] = ev({}, {}, { sello_labial: true });
    expect(run(s).verdict).toBe('efficacy');
  });
  it('safety: tos', () => {
    const s = empty();
    s[1] = ev({}, { tos: true });
    expect(run(s).verdict).toBe('safety');
  });
  it('safety gana a efficacy', () => {
    const s = empty();
    s[1] = ev({}, {}, { residuo: true });
    s[2] = ev({}, { cambio_voz: true });
    expect(run(s).verdict).toBe('safety');
  });
  it('safety solo por desaturación (caída = 3)', () => {
    const s = empty();
    s[1] = ev({ spo2: 95 });
    const r = run(s);
    expect(r.verdict).toBe('safety');
    expect(r.minSpO2).toBe(95);
    expect(r.maxDrop).toBe(3);
  });
  it('caída de 2 no es seguridad', () => {
    const s = empty();
    s[1] = ev({ spo2: 96 });
    expect(run(s).verdict).toBe('safe');
  });
  it('un bolo no evaluado se ignora aunque lleve marcas', () => {
    const s = empty();
    s[1] = { ...ev({}, { tos: true }), evaluated: false };
    expect(run(s).hasSafetyAlt).toBe(false);
  });
});

describe('SpO2 mínima y caída máxima', () => {
  it('toma el mínimo y la mayor caída entre bolos', () => {
    const s = empty();
    s[1] = ev({ spo2: 97 });
    s[2] = ev({ spo2: 93 });
    s[3] = ev({ spo2: 96 });
    const r = run(s);
    expect(r.minSpO2).toBe(93);
    expect(r.maxDrop).toBe(5);
  });
  it('sin caída: mínima = basal y caída 0', () => {
    const s = empty();
    s[1] = ev();
    const r = run(s);
    expect(r.minSpO2).toBe(BASAL);
    expect(r.maxDrop).toBe(0);
  });
});

describe('recomendación', () => {
  it('líquido 20 mL si néctar y líquido pasan completos', () => {
    const s = empty();
    for (const i of [1, 2, 3, 4, 5, 6]) s[i] = ev();
    expect(run(s).recom).toBe('Líquido 20 mL');
  });
  it('mínimo recomendable: 5 mL de cada viscosidad bastan', () => {
    const l = empty();
    l[1] = ev();
    l[4] = ev();
    expect(run(l).recom).toBe('Líquido 5 mL');
    const n = empty();
    n[1] = ev();
    n[4] = ev({}, { tos: true });
    expect(run(n).recom).toBe('Néctar 5 mL');
    const p = empty();
    p[1] = ev({}, { tos: true });
    p[7] = ev();
    expect(run(p).recom).toBe('Pudin 5 mL');
  });
  it('líquido se descarta si el néctar falla', () => {
    const s = empty();
    s[1] = ev({}, { tos: true });
    s[4] = ev();
    expect(run(s).recom).not.toMatch(/^Líquido/);
  });
  it('néctar si el líquido falla', () => {
    const s = empty();
    s[1] = ev();
    s[2] = ev();
    s[4] = ev({}, { tos: true });
    expect(run(s).recom).toBe('Néctar 10 mL');
  });
  it('pudin si néctar y líquido fallan', () => {
    const s = empty();
    s[1] = ev({}, { tos: true });
    s[7] = ev();
    s[8] = ev();
    expect(run(s).recom).toBe('Pudin 10 mL');
  });
  it('suspender vía oral si todo falla', () => {
    const s = empty();
    s[1] = ev({}, { tos: true });
    s[7] = ev({ spo2: 90 });
    expect(run(s).recom).toBe('Suspender vía oral (nutrición alternativa)');
  });
  it('un volumen seguro tras uno inseguro de la misma viscosidad no cuenta', () => {
    const s = empty();
    s[7] = ev({}, { tos: true });
    s[8] = ev();
    expect(run(s).recom).toBe('Suspender vía oral (nutrición alternativa)');
  });
});

describe('ruta de bolos', () => {
  it('seguro avanza a nextSafe, inseguro a nextUnsafe', () => {
    expect(nextBoloId(BOLUS_LIST[0], ev(), BASAL)).toBe(2);
    expect(nextBoloId(BOLUS_LIST[0], ev({}, { tos: true }), BASAL)).toBe(7);
    expect(nextBoloId(BOLUS_LIST[8], ev(), BASAL)).toBeNull();
  });
});

describe('datos ausentes (regla 4: no se presume favorable)', () => {
  // FALLO REAL: ningún bolo evaluado devuelve verdict 'safe' (exploración negativa).
  // Sin datos, la pantalla diría «Exploración negativa · sin disfagia».
  it('sin ningún bolo evaluado NO es safe (arreglado el 19/11/2026)', () => {
    expect(run(empty()).verdict).not.toBe('safe');
  });

  // FALLO REAL: SpO2 ausente (null) se sustituye por la basal => caída 0 => sin
  // desaturación. La ausencia de lectura cuenta como «sin caída».
  it('SpO2 ausente en un bolo evaluado no cuenta como lectura normal (arreglado el 19/11/2026)', () => {
    const s = empty();
    s[1] = ev({ spo2: null });
    expect(run(s).verdict).not.toBe('safe');
  });

  // FALLO REAL: basal no finita (NaN) deja pasar todo como safe.
  it('basal NaN no produce veredicto safe (arreglado el 19/11/2026)', () => {
    const s = empty();
    s[1] = ev({ spo2: 90 });
    expect(run(s, NaN).verdict).not.toBe('safe');
  });

  it('sin ningún bolo evaluado la recomendación NO es favorable (comportamiento actual correcto)', () => {
    expect(run(empty()).recom).toBe('Suspender vía oral (nutrición alternativa)');
  });
});

describe('paridad con DysphagiaTestScreen.tsx (lectura como texto)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'DysphagiaTestScreen.tsx'), 'utf8');

  it('MIN_SPO2_DROP', () => {
    const m = src.match(/const MIN_SPO2_DROP = (\d+);/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBe(MIN_SPO2_DROP);
  });
  it('condición de desaturación', () => {
    expect(src).toContain('const desat = basalSpO2 - eff >= MIN_SPO2_DROP;');
  });
  it('BOLUS_LIST: viscosidad, volumen y saltos', () => {
    const re =
      /\{ id: (\d+), viscosity: '(\w+)', viscosityLabel: '[^']*', volume: '[^']*', volumeVal: (\d+), nextSafe: (\w+), nextUnsafe: (\w+),/g;
    const found = [...src.matchAll(re)].map(m => ({
      id: Number(m[1]),
      viscosity: m[2],
      volumeVal: Number(m[3]),
      nextSafe: m[4] === 'null' ? null : Number(m[4]),
      nextUnsafe: m[5] === 'null' ? null : Number(m[5]),
    }));
    expect(found).toEqual(BOLUS_LIST);
  });
  it('umbral de volumen mínimo (>= 5) y textos de recomendación', () => {
    expect(src).toContain("let recom = 'Suspender vía oral (nutrición alternativa)';");
    expect(src).toContain('if (lSafe >= 5 && !lBad && !nBad) recom = `Líquido ${lSafe} mL`;');
    expect(src).toContain('else if (nSafe >= 5 && !nBad) recom = `Néctar ${nSafe} mL`;');
    expect(src).toContain('else if (pSafe >= 5 && !pBad) recom = `Pudin ${pSafe} mL`;');
  });
  it('veredicto y ramas de seguridad/eficacia', () => {
    expect(src).toMatch(
      /analysis\.hasSafetyAlt\s*\?\s*'safety'\s*:\s*analysis\.hasEfficacyAlt\s*\?\s*'efficacy'\s*:\s*'safe'/,
    );
    expect(src).toContain('const hasSafety = s.safety.tos || s.safety.cambio_voz || desat;');
    expect(src).toContain(
      'const hasEfficacy = s.efficacy.sello_labial || s.efficacy.residuo || s.efficacy.deglucion_fraccionada;',
    );
  });
  it('mínima y caída máxima', () => {
    expect(src).toContain('minSpO2 = Math.min(minSpO2, d.eff);');
    expect(src).toContain('maxDrop = Math.max(maxDrop, basalSpO2 - d.eff);');
  });
});

describe('la pantalla de disfagia no presume una exploración favorable (19/11/2026)', () => {
  const src: string = fs.readFileSync(path.join(__dirname, '..', 'DysphagiaTestScreen.tsx'), 'utf8');

  it('no rellena la SpO₂ de un bolo con la basal', () => {
    expect(src).not.toMatch(/spo2:\s*basalSpO2/);
    expect(src).not.toMatch(/\.spo2 \?\? basalSpO2,/);
  });

  it('«Siguiente» exige una SpO₂ medida', () => {
    expect(src).toContain('isDisabled={activeState.spo2 == null}');
    expect(src).toContain('if (activeState.spo2 == null) return;');
  });

  it('sin bolos evaluados no dice «sin disfagia» ni deja guardar', () => {
    expect(src).toContain('const noneEvaluated = analysis.evaluatedCount === 0;');
    expect(src).toMatch(/reportTitle = noneEvaluated\s*\?/);
    expect(src).toContain('if (isSaving || noneEvaluated) return;');
    expect(src).toContain('isDisabled={noneEvaluated ||');
  });
});
