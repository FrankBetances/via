import { CATALOGUES } from '@/I18n/catalog';
import { ALL_UI_LANGS } from '@/I18n/uiLang';
import type { UiLang } from '@/I18n/uiLang';
import { evaluateSessionNlg, isNlgCatalogReady, type SessionEntities } from '@/PDF/nlgReportEngine';

/* -------------------------------------------------------------------------- */
/*  Puerta de léxico del subárbol `nlg`. El resto del catálogo no entra:      */
/*  ahí siguen frases viejas («no descarta») que esta oleada no reescribe.    */
/*  Las siete lenguas tienen bloque. El vetado se mira también en gl, eu,     */
/*  ca y en, y las palabras función castellanas no pueden colarse en las     */
/*  plantillas (el detector de uiCatalog solo ve las cadenas estáticas).      */
/* -------------------------------------------------------------------------- */

const BANNED = [
  'diagnóstico confirmado',
  'patológico',
  'voz perceptualmente normal',
  'dentro de los rangos normativos',
  'sano',
  'enfermo',
  'descarta',
  'pathological',
  'healthy',
  'rules out',
];

const looseWord = (words: string[]): RegExp =>
  new RegExp(`(?<![\\p{L}\\p{N}_-])(${words.join('|')})(?![\\p{L}\\p{N}_])`, 'iu');

const FOREIGN: Partial<Record<UiLang, RegExp>> = {
  eu: looseWord([
    'de', 'del', 'la', 'el', 'los', 'las', 'que', 'para', 'con', 'una', 'por',
    'se', 'ata', 'nivel', 'voz', 'palabra', 'descende', 'però', 'amb', 'dels', 'nivell',
  ]),
  gl: looseWord(['y', 'del', 'los', 'las', 'hasta', 'calidad', 'hallazgos']),
  ca: looseWord(['y', 'los', 'las', 'con', 'para', 'por', 'desde', 'hasta', 'voz', 'selección', 'calidad']),
  en: looseWord(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'con', 'para', 'por', 'voz', 'banco', 'neuronal', 'calidad']),
};

const hits = (text: string): string[] => {
  const lower = text.toLowerCase();
  return BANNED.filter(pattern => lower.includes(pattern.toLowerCase()));
};

const collect = (value: unknown, out: string[], seen: Set<unknown>): void => {
  if (typeof value === 'string') {
    out.push(value);
    return;
  }
  if (typeof value === 'function') {
    const fn = value as (...args: Array<string | number>) => unknown;
    const samples: Array<string | number> = [0, 1, 2, 'x'];
    const packs = samples.map(sample => Array.from({ length: fn.length }, () => sample));
    if (fn.length === 0) packs.push([]);
    for (const args of packs) {
      const result = fn(...args);
      if (typeof result !== 'string') {
        throw new Error('una plantilla nlg no devolvió texto');
      }
      out.push(result);
    }
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  for (const child of Object.values(value as Record<string, unknown>)) {
    collect(child, out, seen);
  }
};

const stringsOf = (lang: UiLang): string[] => {
  const out: string[] = [];
  collect(CATALOGUES[lang].nlg, out, new Set());
  return out;
};

const loud = (): SessionEntities => ({
  audiometries: [
    {
      id: 1,
      transducer: 'air',
      thresholds: {
        OD: { 500: 10, 1000: 10, 2000: 10, 4000: 30 },
        OI: { 500: 10, 1000: 10, 2000: 10, 4000: 10 },
      },
      ptaOD: null,
      ptaOI: null,
    } as never,
  ],
  verbalAudiometries: [
    {
      id: 1,
      ageBand: 'A',
      language: 'ca',
      presentedCount: 10,
      correctCount: 7,
      levelScores: [{ level: 65, presented: 10, correct: 7, pct: 70 }],
      srtDb: 40,
    } as never,
  ],
  voiceAnalyses: [
    {
      id: 1,
      f0: 250,
      jitter: 2,
      shimmer: 5,
      hnr: 8,
      formants: null,
      grbas: { g: 0, r: 0, b: 0, a: 0, s: 0 },
    } as never,
  ],
  articulations: [
    {
      id: 1,
      evaluatedCount: 4,
      totalCount: 8,
      correctPct: 50,
      sodaCounts: null,
      affectedPhonemes: [{ phoneme: 's' }],
      phonemeStatus: [{ phoneme: 's', place: 'fricativa' }],
    } as never,
  ],
  screenings: [
    {
      id: 1,
      instrument: 'autism-tea',
      score: 9,
      total: 2,
      answers: { 1: true, 2: false },
    } as never,
  ],
  ashaTests: [{ id: 'a', ageBand: 'B', riskLevel: 'red', failedDomains: ['receptive'] } as never],
  dysphagias: [
    {
      id: 1,
      safetyAltered: true,
      efficacyAltered: false,
      minSpO2: null,
      maxDrop: null,
      recommendation: 'espesar',
      bolus: [{}],
    } as never,
  ],
  sahsScreenings: [
    { id: 1, psqYesCount: 8, psqTotal: 13, brodsky: null, imc: null, suspicionLevel: 'high' } as never,
  ],
  executiveFunctions: [
    {
      id: 1,
      ageBand: 'C',
      attentionScore: 40,
      inhibitionScore: 40,
      flexibilityScore: 40,
      workingMemoryScore: 40,
      planningScore: 40,
      overallScore: 40,
    } as never,
  ],
  clinicalAssessments: [
    {
      id: 1,
      instrument: 'CAP',
      globalResult: 'BLOCKED',
      domains: {
        otoscopia: { od: 'Cerumen', oi: 'OME', kind: 'block' },
        visual: { kind: 'block' },
        verbal: { kind: 'ok' },
        motor: { kind: 'ok' },
      },
    } as never,
  ],
  prosodyAnalyses: [{ id: 1, reason: 'empty', metrics: { pauseCount: 0 } } as never],
});

describe('puerta de léxico nlg', () => {
  it('las siete lenguas tienen bloque y no contienen un término vetado', () => {
    const ready = ALL_UI_LANGS.filter(lang => isNlgCatalogReady(lang));
    expect(ready.sort()).toEqual([...ALL_UI_LANGS].sort());
    for (const lang of ready) {
      const foreign = FOREIGN[lang];
      for (const text of stringsOf(lang)) {
        expect({ lang, hits: hits(text), text }).toEqual({ lang, hits: [], text });
        if (foreign) {
          expect({ lang, leak: foreign.test(text), text }).toEqual({ lang, leak: false, text });
        }
      }
    }
  });

  it('las salidas arquetipo tampoco contienen un término vetado', () => {
    for (const lang of ALL_UI_LANGS) {
      const foreign = FOREIGN[lang];
      for (const entities of [{}, loud()] as SessionEntities[]) {
        const report = evaluateSessionNlg(entities, lang);
        expect(hits(report.formattedReportText)).toEqual([]);
        if (foreign) expect(foreign.test(report.formattedReportText)).toBe(false);
        for (const fact of report.facts) {
          expect(hits(fact.text)).toEqual([]);
          if (foreign) expect(foreign.test(fact.text)).toBe(false);
        }
      }
    }
  });
});
