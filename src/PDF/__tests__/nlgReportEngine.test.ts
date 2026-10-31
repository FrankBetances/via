import {
  NlgCatalogMissing,
  evaluateSessionNlg,
  evaluateVoiceFacts,
  isNlgCatalogReady,
  type ClinicalFact,
  type SessionEntities,
} from '@/PDF/nlgReportEngine';
import { BLOCKING_FINDINGS } from '@/Screens/ClinicalAssessment/clinicalAssessmentResult';
import { severityOf } from '@/Screens/Audiometry/audiometryResult';
import { EF_OK_CUT, EF_WARN_CUT } from '@/Screens/ExecutiveFunctions/executiveFunctionsGame';
import { DISCRIMINATION_WARN_CUT } from '@/Screens/VerbalAudiometry/verbalAudiometryResult';
import { VOICE_NORMS } from '@/Screens/VoiceAnalysis/voiceAnalysisResult';

/* El proyecto no incluye @types/node (tipado RN puro): los globals que Jest sí
 * provee se declaran localmente, como en `luaProtocolGate.test.ts`. */
declare function require(name: string): any;
declare const __dirname: string;
const fs = require('fs');
const path = require('path');
const ROOT: string = path.resolve(__dirname, '..', '..', '..');

/* -------------------------------------------------------------------------- */
/*  Una regla, un caso que dispara y otro que no. El `null` no entra en la    */
/*  frase de intervalo cumplido. Las cifras del informe son las del plan;     */
/*  las de la pantalla siguen en su sitio porque esta oleada no recolorea.    */
/* -------------------------------------------------------------------------- */

const ear = (db: number, patch: Record<number, number | null> = {}): Record<number, number | null> => ({
  500: db,
  1000: db,
  2000: db,
  4000: db,
  ...patch,
});

const aud = (thresholds: never, extra: Record<string, unknown> = {}): SessionEntities => ({
  audiometries: [
    {
      id: 1,
      transducer: 'air',
      thresholds,
      ptaOD: null,
      ptaOI: null,
      ...extra,
    } as never,
  ],
});

const air = (od: Record<number, number | null>, oi: Record<number, number | null> = od): SessionEntities =>
  aud({ OD: od, OI: oi } as never);

const domains = (over: {
  od?: string | null;
  oi?: string | null;
  visual?: string;
  motor?: string;
  verbal?: string;
  oto?: string;
} = {}): Record<string, unknown> => ({
  otoscopia: { od: over.od ?? null, oi: over.oi ?? null, kind: over.oto ?? 'ok' },
  visual: { kind: over.visual ?? 'ok' },
  verbal: { kind: over.verbal ?? 'ok' },
  motor: { kind: over.motor ?? 'ok' },
});

const cap = (globalResult: string, extra: Record<string, unknown> = {}): SessionEntities => ({
  clinicalAssessments: [
    {
      id: 1,
      instrument: 'CAP',
      globalResult,
      domains: extra.domains ?? null,
      ...extra,
    } as never,
  ],
});

const verbal = (over: Record<string, unknown> = {}): SessionEntities => ({
  verbalAudiometries: [
    {
      id: 1,
      ageBand: 'D',
      language: 'es',
      presentedCount: 10,
      correctCount: 9,
      levelScores: [{ level: 65, presented: 10, correct: 9, pct: 90 }],
      srtDb: null,
      ...over,
    } as never,
  ],
});

const voice = (over: Record<string, unknown> = {}): SessionEntities => ({
  voiceAnalyses: [
    {
      id: 1,
      f0: null,
      jitter: null,
      shimmer: null,
      hnr: null,
      formants: null,
      grbas: null,
      ...over,
    } as never,
  ],
});

const withinVoice = {
  f0: 250,
  jitter: 1.04,
  shimmer: 3.81,
  hnr: 12,
  formants: { f1: 500, f2: 1500, f3: 2500 },
};

const prosody = (reason: string, metrics: Record<string, unknown> | null = null): SessionEntities => ({
  prosodyAnalyses: [{ id: 1, reason, metrics } as never],
});

const art = (over: Record<string, unknown> = {}): SessionEntities => ({
  articulations: [
    {
      id: 1,
      evaluatedCount: 4,
      totalCount: 10,
      correctPct: 75,
      sodaCounts: { S: 0, O: 0, D: 0, A: 0 },
      affectedPhonemes: [],
      phonemeStatus: [],
      ...over,
    } as never,
  ],
});

const asha = (riskLevel: string, failedDomains: string[] = []): SessionEntities => ({
  ashaTests: [{ id: 'a', ageBand: 'C', riskLevel, failedDomains } as never],
});

const answers = (n: number, hole: number | null = null): Record<number, boolean | null> => {
  const out: Record<number, boolean | null> = {};
  for (let i = 1; i <= n; i++) out[i] = hole === i ? null : false;
  return out;
};

const mchat = (score: number, complete: boolean): SessionEntities => ({
  screenings: [
    {
      id: 1,
      instrument: 'autism-tea',
      score,
      total: 2,
      answers: complete ? answers(2) : answers(2, 2),
    } as never,
  ],
});

const dys = (over: Record<string, unknown>): SessionEntities => ({
  dysphagias: [
    {
      id: 1,
      safetyAltered: false,
      efficacyAltered: false,
      minSpO2: null,
      maxDrop: null,
      recommendation: '',
      bolus: [{}],
      ...over,
    } as never,
  ],
});

const sahs = (suspicionLevel: string): SessionEntities => ({
  sahsScreenings: [
    {
      id: 1,
      psqYesCount: 2,
      psqTotal: 13,
      brodsky: 2,
      imc: 'normo',
      suspicionLevel,
    } as never,
  ],
});

const ef = (over: Record<string, unknown> = {}): SessionEntities => ({
  executiveFunctions: [
    {
      id: 1,
      ageBand: 'B',
      attentionScore: null,
      inhibitionScore: null,
      flexibilityScore: null,
      workingMemoryScore: null,
      planningScore: null,
      overallScore: null,
      ...over,
    } as never,
  ],
});

const reportOf = (entities: SessionEntities) => evaluateSessionNlg(entities, 'es');
const ids = (entities: SessionEntities): string[] => reportOf(entities).ruleIds;
const has = (entities: SessionEntities, id: string): boolean => ids(entities).includes(id);
const textOf = (entities: SessionEntities, id: string): string =>
  reportOf(entities)
    .facts.filter(fact => fact.ruleId === id)
    .map(fact => fact.text)
    .join('\n');
const factOf = (entities: SessionEntities, id: string): ClinicalFact | undefined =>
  reportOf(entities).facts.find(fact => fact.ruleId === id);

const doneEf = {
  attentionScore: 80,
  inhibitionScore: 80,
  flexibilityScore: 80,
  workingMemoryScore: 80,
  planningScore: 80,
  overallScore: 80,
};

interface RuleCase {
  id: string;
  fire: SessionEntities;
  quiet: SessionEntities;
}

const cases: RuleCase[] = [
  { id: 'R-CAP-001', fire: cap('FULL'), quiet: cap('PARTIAL', { domains: domains({ visual: 'warn' }) }) },
  { id: 'R-CAP-002', fire: cap('PARTIAL', { domains: domains({ visual: 'warn' }) }), quiet: cap('FULL') },
  { id: 'R-CAP-003', fire: cap('BLOCKED'), quiet: cap('FULL') },
  { id: 'R-AUD-001', fire: air({}, ear(10)), quiet: air(ear(10)) },
  { id: 'R-AUD-002', fire: air(ear(10)), quiet: air({}, {}) },
  { id: 'R-AUD-003', fire: air(ear(10, { 4000: null })), quiet: air(ear(10)) },
  { id: 'R-AUD-004', fire: air(ear(21)), quiet: air(ear(20)) },
  {
    id: 'R-AUD-005',
    fire: aud({ OD: ear(10), OI: ear(10), CL: ear(10) } as never, { transducer: 'soundfield' }),
    quiet: air(ear(10)),
  },
  { id: 'R-VER-001', fire: verbal({ presentedCount: 0, correctCount: 0, levelScores: [] }), quiet: verbal() },
  { id: 'R-VER-002', fire: verbal(), quiet: verbal({ presentedCount: 0, correctCount: 0, levelScores: [] }) },
  { id: 'R-VER-003', fire: verbal(), quiet: {} },
  {
    id: 'R-VER-004',
    fire: verbal({
      presentedCount: 10,
      correctCount: 7,
      levelScores: [{ level: 65, presented: 10, correct: 7, pct: 79 }],
    }),
    quiet: verbal({
      presentedCount: 10,
      correctCount: 8,
      levelScores: [{ level: 65, presented: 10, correct: 8, pct: 80 }],
    }),
  },
  { id: 'R-VOZ-001', fire: voice(), quiet: voice(withinVoice) },
  { id: 'R-VOZ-002', fire: voice(withinVoice), quiet: voice() },
  { id: 'R-VOZ-003', fire: voice({ ...withinVoice, jitter: 1.05 }), quiet: voice(withinVoice) },
  { id: 'R-VOZ-004', fire: voice(withinVoice), quiet: voice({ f0: 250, jitter: 0.4, shimmer: null, hnr: 18 }) },
  {
    id: 'R-PRO-001',
    fire: prosody('silent', { pauseCount: 0, syllableCount: 0, spanSec: 0 }),
    quiet: prosody('ok', { spanSec: 3, syllableCount: 8, pauseCount: 1, f0RangeSt: 4, speechRateSps: 2, articulationRateSps: 3 }),
  },
  {
    id: 'R-PRO-002',
    fire: prosody('ok', { spanSec: 3, syllableCount: 8, pauseCount: 0, f0RangeSt: 4, speechRateSps: 2, articulationRateSps: 3 }),
    quiet: prosody('silent', { pauseCount: 0 }),
  },
  { id: 'R-ART-001', fire: art({ evaluatedCount: 0 }), quiet: art() },
  { id: 'R-ART-002', fire: art(), quiet: art({ evaluatedCount: 0 }) },
  { id: 'R-ART-003', fire: art({ affectedPhonemes: [{ phoneme: 'k' }] }), quiet: art() },
  { id: 'R-ASH-001', fire: asha('green'), quiet: asha('yellow', ['expressive']) },
  { id: 'R-ASH-002', fire: asha('yellow', ['expressive']), quiet: asha('green') },
  { id: 'R-ASH-003', fire: asha('red', ['receptive']), quiet: asha('green') },
  { id: 'R-AUT-001', fire: mchat(4, false), quiet: mchat(0, true) },
  { id: 'R-AUT-002', fire: mchat(0, true), quiet: mchat(4, false) },
  { id: 'R-DYS-001', fire: dys({}), quiet: dys({ bolus: [] }) },
  { id: 'R-DYS-002', fire: dys({ efficacyAltered: true }), quiet: dys({ bolus: [] }) },
  { id: 'R-DYS-003', fire: dys({ safetyAltered: true }), quiet: dys({}) },
  { id: 'R-SAH-001', fire: sahs('low'), quiet: {} },
  { id: 'R-EF-001', fire: ef({ overallScore: 80 }), quiet: ef(doneEf) },
  { id: 'R-EF-002', fire: ef(doneEf), quiet: ef({ overallScore: 80 }) },
  {
    id: 'R-CROSS-001',
    fire: {
      ...cap('FULL', { domains: domains({ od: 'Cerumen' }) }),
      ...air(ear(10)),
    },
    quiet: {
      ...cap('FULL', { domains: domains({ od: 'Cerumen' }) }),
      ...air({}, {}),
    },
  },
  {
    id: 'R-CROSS-002',
    fire: {
      ...cap('FULL', { domains: domains({ od: 'OME' }) }),
      ...air(ear(21)),
    },
    quiet: {
      ...cap('FULL', { domains: domains({ od: 'OME' }) }),
      ...air(ear(20)),
    },
  },
  {
    id: 'R-CROSS-003',
    fire: {
      ...air(ear(10)),
      ...verbal({
        presentedCount: 10,
        correctCount: 7,
        levelScores: [{ level: 65, presented: 10, correct: 7, pct: 70 }],
        srtDb: null,
      }),
    },
    quiet: {
      ...air(ear(10)),
      ...verbal({
        presentedCount: 10,
        correctCount: 8,
        levelScores: [{ level: 65, presented: 10, correct: 8, pct: 80 }],
        srtDb: 10,
      }),
    },
  },
  {
    id: 'R-CROSS-004',
    fire: {
      ...air(ear(10, { 4000: 26 })),
      ...art({ affectedPhonemes: [{ phoneme: 's' }] }),
    },
    quiet: {
      ...air(ear(10, { 4000: 25 })),
      ...art({ affectedPhonemes: [{ phoneme: 's' }] }),
    },
  },
  {
    id: 'R-CROSS-005',
    fire: {
      ...voice({ ...withinVoice, jitter: 1.05 }),
      ...dys({ safetyAltered: true }),
    },
    quiet: {
      ...voice(withinVoice),
      ...dys({ safetyAltered: true }),
    },
  },
  {
    id: 'R-CROSS-006',
    fire: { ...asha('red', ['receptive']), ...mchat(3, true) },
    quiet: { ...asha('red', ['receptive']), ...mchat(2, true) },
  },
  {
    id: 'R-CROSS-007',
    fire: {
      ...sahs('med'),
      ...ef({ ...doneEf, overallScore: 69 }),
    },
    quiet: {
      ...sahs('high'),
      ...ef({ ...doneEf, flexibilityScore: 40 }),
    },
  },
];

describe('nlgReportEngine · cada ruleId', () => {
  it.each(cases)('$id dispara y el caso contrario no', ({ id, fire, quiet }) => {
    expect(has(fire, id)).toBe(true);
    expect(has(quiet, id)).toBe(false);
  });

  it('los ruleId del motor y los de la matriz son el mismo conjunto', () => {
    const source = fs.readFileSync(path.join(ROOT, 'src/PDF/nlgReportEngine.ts'), 'utf8');
    const fromSource = [...source.matchAll(/'(R-[A-Z]+-\d+)'/g)].map(match => match[1]);
    const matrix = fs.readFileSync(path.join(ROOT, 'docs/design/matriz-evidencia-nlg.md'), 'utf8');
    const fromMatrix = [...matrix.matchAll(/^## (R-[A-Z]+-\d+)$/gm)].map(match => match[1]);
    const fromCases = cases.map(item => item.id);
    expect([...new Set(fromSource)].sort()).toEqual([...fromCases].sort());
    expect([...new Set(fromMatrix)].sort()).toEqual([...fromCases].sort());
  });

  it('evidenceRef lleva la versión 1.0.0', () => {
    const fact = factOf(cap('FULL'), 'R-CAP-001');
    expect(fact?.evidenceRef).toBe('R-CAP-001@1.0.0');
  });
});

describe('nlgReportEngine · null y bordes del plan', () => {
  it('una sesión vacía no narra y es estable', () => {
    const first = evaluateSessionNlg({}, 'es');
    const second = evaluateSessionNlg({}, 'es');
    expect(first.facts).toEqual([]);
    expect(first.ruleIds).toEqual([]);
    expect(first.formattedReportText).toBe('');
    expect(first.unavailableReason).toBeNull();
    expect(second).toEqual(first);
  });

  it('un parámetro de voz null no cae en la frase de intervalo cumplido', () => {
    const partial = voice({ f0: 250, jitter: null, shimmer: 2, hnr: 18 });
    const text = textOf(partial, 'R-VOZ-002');
    expect(factOf(partial, 'R-VOZ-002')?.level).toBe('warning');
    expect(text).toContain('no disponible');
    expect(text).not.toContain('sin desvíos por encima del umbral de alerta');
    expect(has(partial, 'R-VOZ-003')).toBe(false);
  });

  it('los cuatro números en el borde del plan sí entran en el intervalo', () => {
    const text = textOf(voice(withinVoice), 'R-VOZ-002');
    expect(factOf(voice(withinVoice), 'R-VOZ-002')?.level).toBe('info');
    expect(text).toContain('sin desvíos por encima del umbral de alerta');
    expect(textOf(voice(withinVoice), 'R-VOZ-004')).toContain('1,3');
    expect(textOf(voice(withinVoice), 'R-VOZ-004')).toContain('1,7');
  });

  it('F0 219 y 321, HNR 11.99 y shimmer 3.82 salen del intervalo', () => {
    expect(has(voice({ ...withinVoice, f0: 219 }), 'R-VOZ-003')).toBe(true);
    expect(has(voice({ ...withinVoice, f0: 321 }), 'R-VOZ-003')).toBe(true);
    expect(has(voice({ ...withinVoice, f0: 220 }), 'R-VOZ-003')).toBe(false);
    expect(has(voice({ ...withinVoice, f0: 320 }), 'R-VOZ-003')).toBe(false);
    expect(has(voice({ ...withinVoice, hnr: 11.99 }), 'R-VOZ-003')).toBe(true);
    expect(has(voice({ ...withinVoice, shimmer: 3.82 }), 'R-VOZ-003')).toBe(true);
  });

  it('el campo libre no trata los oídos vacíos como sin respuesta', () => {
    const field = aud({ OD: {}, OI: {}, CL: ear(10) } as never, { transducer: 'soundfield' });
    expect(has(field, 'R-AUD-001')).toBe(false);
    expect(has(field, 'R-AUD-005')).toBe(true);
    expect(textOf(field, 'R-AUD-005')).toContain('mejor oído');
    expect(textOf(field, 'R-AUD-005')).not.toContain('no descarta');
  });

  it('las bandas y la morfología son las del plan', () => {
    expect(textOf(air(ear(20)), 'R-AUD-002')).toContain('rango de referencia');
    expect(textOf(air(ear(21)), 'R-AUD-002')).toContain('21 y 40');
    expect(textOf(air(ear(40)), 'R-AUD-002')).toContain('21 y 40');
    expect(textOf(air(ear(41)), 'R-AUD-002')).toContain('41 y 70');
    expect(textOf(air(ear(70)), 'R-AUD-002')).toContain('41 y 70');
    expect(textOf(air(ear(71)), 'R-AUD-002')).toContain('71 y 90');
    expect(textOf(air(ear(90)), 'R-AUD-002')).toContain('71 y 90');
    expect(textOf(air(ear(91)), 'R-AUD-002')).toContain('por encima de 90');
    expect(textOf(air(ear(10, { 500: 10, 4000: 25 })), 'R-AUD-002')).toContain('descendente');
    expect(textOf(air(ear(10, { 500: 30, 4000: 15 })), 'R-AUD-002')).toContain('ascendente');
    expect(textOf(air(ear(10)), 'R-AUD-002')).toContain('curva plana');
    expect(textOf(air(ear(10, { 4000: null })), 'R-AUD-002')).toContain('morfología no afirmable');
    expect(factOf(air(ear(20)), 'R-AUD-002')?.level).toBe('info');
    expect(factOf(air(ear(21)), 'R-AUD-002')?.level).toBe('warning');
  });

  it('el 80 % a 65 dB no deriva; el 70 % a 50 dB tampoco', () => {
    const atCut = verbal({
      levelScores: [{ level: 65, presented: 10, correct: 8, pct: 80 }],
    });
    const onlyLow = verbal({
      presentedCount: 4,
      correctCount: 2,
      levelScores: [{ level: 50, presented: 4, correct: 2, pct: 50 }],
    });
    expect(has(atCut, 'R-VER-004')).toBe(false);
    expect(has(onlyLow, 'R-VER-004')).toBe(false);
    expect(textOf(onlyLow, 'R-VER-002')).toContain('a 50 dB');
    expect(textOf(onlyLow, 'R-VER-002')).not.toContain('nivel conversacional');
  });

  it('el hueco URV de 15 dB no cruza y el de 16 sí', () => {
    const edge = {
      ...air(ear(10)),
      ...verbal({ srtDb: 25, levelScores: [{ level: 65, presented: 10, correct: 9, pct: 90 }] }),
    };
    const over = {
      ...air(ear(10)),
      ...verbal({ srtDb: 26, levelScores: [{ level: 65, presented: 10, correct: 9, pct: 90 }] }),
    };
    expect(has(edge, 'R-CROSS-003')).toBe(false);
    expect(has(over, 'R-CROSS-003')).toBe(true);
  });

  it('un bolo vacío no inventa ausencia de compromiso', () => {
    const empty = dys({ bolus: [] });
    expect(ids(empty).filter(id => id.startsWith('R-DYS'))).toEqual([]);
  });

  it('la seguridad sin SpO2 no fabrica la caída medida', () => {
    const text = textOf(dys({ safetyAltered: true, minSpO2: null, maxDrop: null }), 'R-DYS-003');
    expect(text).toContain('SpO2 mínima no disponible');
    expect(text).toContain('Caída máxima no disponible');
  });

  it('la prosodia silenciosa con pausas 0 no dice «0 pausas»', () => {
    const text = textOf(prosody('silent', { pauseCount: 0, syllableCount: 4 }), 'R-PRO-001');
    expect(text).toContain('no contiene habla');
    expect(text).not.toContain('0 pausas');
    expect(has(prosody('silent', { pauseCount: 0 }), 'R-PRO-002')).toBe(false);
  });

  it('M-CHAT incompleto no emite banda de puntuación', () => {
    expect(ids(mchat(8, false))).toEqual(['R-AUT-001']);
  });

  it('SAHS no dice diagnóstico definitivo y el cruce 001 no invalida técnicamente', () => {
    expect(textOf(sahs('high'), 'R-SAH-001')).toContain('polisomnografía');
    expect(textOf(sahs('high'), 'R-SAH-001')).not.toContain('diagnóstico definitivo');
    const cross = textOf(
      { ...cap('FULL', { domains: domains({ od: 'OMA' }) }), ...air(ear(30)) },
      'R-CROSS-001',
    );
    expect(cross).toContain('no es interpretable');
    expect(cross).not.toContain('invalida técnicamente');
  });

  it('el índice global sin dominios no entra en la frase favorable', () => {
    const text = textOf(ef({ overallScore: 90 }), 'R-EF-001');
    expect(text).toContain('sin mini-juegos completados');
    expect(text).not.toContain('iguales o superiores');
    expect(textOf(ef({ ...doneEf, attentionScore: 64 }), 'R-EF-002')).toContain('attention');
    expect(textOf(ef(doneEf), 'R-EF-002')).toContain('iguales o superiores');
  });

  it('la lengua prestada avisa y el banco propio no', () => {
    expect(textOf(verbal({ language: 'ca' }), 'R-VER-003')).toContain('prestado');
    expect(textOf(verbal({ language: 'es' }), 'R-VER-003')).not.toContain('prestado');
  });
});

describe('nlgReportEngine · paridad de cifras', () => {
  it('el informe usa el plan; la pantalla conserva los cortes de color', () => {
    // Igualar estos números recolorea tarjetas y mueve verbalNeedsReferral.
    // Esta oleada no lo hace. El test falla si el motor se aparta del plan
    // o si la pantalla cambia de corte sin que el informe lo acompañe.
    expect(VOICE_NORMS.f0).toEqual({ min: 200, max: 320 });
    expect(VOICE_NORMS.jitter.max).toBe(1);
    expect(VOICE_NORMS.shimmer.max).toBe(3);
    expect(VOICE_NORMS.hnr.min).toBe(20);
    expect(DISCRIMINATION_WARN_CUT).toBe(70);
    expect(EF_OK_CUT).toBe(80);
    expect(EF_WARN_CUT).toBe(60);
    expect(severityOf(65)?.key).toBe('severe');
    expect(textOf(air(ear(65)), 'R-AUD-002')).toContain('41 y 70');
    expect(BLOCKING_FINDINGS).toEqual(['Cerumen', 'OMA', 'Perforación']);
    for (const finding of BLOCKING_FINDINGS) {
      expect(
        has({ ...cap('FULL', { domains: domains({ od: finding }) }), ...air(ear(10)) }, 'R-CROSS-001'),
      ).toBe(true);
    }
    expect(has({ ...cap('FULL', { domains: domains({ od: 'OME' }) }), ...air(ear(10)) }, 'R-CROSS-001')).toBe(false);
    // 1,01 supera el corte de pantalla (1,0) y no el del informe (1,04).
    expect(has(voice({ ...withinVoice, jitter: 1.01 }), 'R-VOZ-003')).toBe(false);
    // 75 % deriva en el informe (corte 80) y no en verbalNeedsReferral (corte 70).
    expect(
      has(
        verbal({ levelScores: [{ level: 65, presented: 4, correct: 3, pct: 75 }] }),
        'R-VER-004',
      ),
    ).toBe(true);
  });
});

describe('nlgReportEngine · catálogo ausente', () => {
  it('gl, eu, ca y en no lanzan TypeError en la sesión', () => {
    for (const lang of ['gl', 'eu', 'ca', 'en'] as const) {
      expect(isNlgCatalogReady(lang)).toBe(false);
      const synthesis = evaluateSessionNlg(voice(withinVoice), lang);
      expect(synthesis.unavailableReason).toBe('catalog-missing');
      expect(synthesis.facts).toEqual([]);
      expect(synthesis.formattedReportText).toContain(`(${lang})`);
    }
  });

  it('evaluateVoiceFacts en eu lanza NlgCatalogMissing', () => {
    expect(isNlgCatalogReady('es')).toBe(true);
    expect(isNlgCatalogReady('es-DO')).toBe(true);
    expect(isNlgCatalogReady('es-419')).toBe(true);
    let thrown: unknown;
    try {
      evaluateVoiceFacts({}, 'eu');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(NlgCatalogMissing);
    expect(thrown).not.toBeInstanceOf(TypeError);
    expect(String(thrown)).not.toContain('Cannot read properties');
  });
});
