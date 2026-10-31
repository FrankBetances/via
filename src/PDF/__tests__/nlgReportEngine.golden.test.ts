import type { UiLang } from '@/I18n/uiLang';
import { evaluateSessionNlg, isNlgCatalogReady, type SessionEntities } from '@/PDF/nlgReportEngine';

/* -------------------------------------------------------------------------- */
/*  Oro de una sesión limpia. es, es-419 y es-DO comparten el castellano      */
/*  peninsular (las dos variedades son un delta sobre ES). gl, eu, ca y en    */
/*  narran en su bloque: mismas reglas, texto distinto del castellano,        */
/*  estable en cincuenta corridas.                                            */
/* -------------------------------------------------------------------------- */

const mchat = (): Record<number, boolean> => {
  const answers: Record<number, boolean> = {};
  for (let i = 1; i <= 20; i++) answers[i] = false;
  return answers;
};

const archetype = (): SessionEntities => {
  const ear = { 500: 10, 1000: 10, 2000: 10, 4000: 10 };
  return {
    clinicalAssessments: [{ id: 1, instrument: 'CAP', globalResult: 'FULL', domains: null } as never],
    audiometries: [
      {
        id: 1,
        transducer: 'air',
        thresholds: { OD: ear, OI: { ...ear } },
        ptaOD: null,
        ptaOI: null,
      } as never,
    ],
    verbalAudiometries: [
      {
        id: 1,
        ageBand: 'D',
        language: 'es',
        presentedCount: 10,
        correctCount: 9,
        levelScores: [{ level: 65, presented: 10, correct: 9, pct: 90 }],
        srtDb: null,
      } as never,
    ],
    voiceAnalyses: [
      {
        id: 1,
        f0: 250,
        jitter: 0.5,
        shimmer: 2,
        hnr: 18,
        formants: { f1: 500, f2: 1500, f3: 2500 },
        grbas: null,
      } as never,
    ],
    prosodyAnalyses: [
      {
        id: 1,
        reason: 'ok',
        metrics: {
          spanSec: 4,
          syllableCount: 12,
          pauseCount: 1,
          f0RangeSt: 5,
          speechRateSps: 3,
          articulationRateSps: 4,
        },
      } as never,
    ],
    articulations: [
      {
        id: 1,
        evaluatedCount: 8,
        totalCount: 10,
        correctPct: 80,
        sodaCounts: { S: 1, O: 0, D: 0, A: 0 },
        affectedPhonemes: [],
        phonemeStatus: [],
      } as never,
    ],
    ashaTests: [{ id: 'a', ageBand: 'C', riskLevel: 'green', failedDomains: [] } as never],
    screenings: [
      { id: 1, instrument: 'autism-tea', score: 0, total: 20, answers: mchat() } as never,
    ],
    dysphagias: [
      {
        id: 1,
        safetyAltered: false,
        efficacyAltered: false,
        minSpO2: 98,
        maxDrop: 0,
        recommendation: 'mantener',
        bolus: [{}],
      } as never,
    ],
    sahsScreenings: [
      {
        id: 1,
        psqYesCount: 1,
        psqTotal: 13,
        brodsky: 1,
        imc: 'normo',
        suspicionLevel: 'low',
      } as never,
    ],
    executiveFunctions: [
      {
        id: 1,
        ageBand: 'B',
        attentionScore: 80,
        inhibitionScore: 80,
        flexibilityScore: 80,
        workingMemoryScore: 80,
        planningScore: 80,
        overallScore: 80,
      } as never,
    ],
  };
};

const GOLD_RULE_IDS = [
  'R-CAP-001',
  'R-AUD-002',
  'R-AUD-002',
  'R-VER-002',
  'R-VER-003',
  'R-VOZ-002',
  'R-VOZ-004',
  'R-PRO-002',
  'R-ART-002',
  'R-ASH-001',
  'R-AUT-002',
  'R-DYS-001',
  'R-SAH-001',
  'R-EF-002',
];

const GOLD_ES = [
  'Condiciones visuales, motoras, verbales y otoscópicas verificadas. Veredicto global del certificado de aptitud: FULL.',
  'oído derecho: PTA 10 dB HL. Umbral dentro del rango de referencia (≤ 20 dB HL). curva plana (la diferencia entre 500 Hz y 4000 Hz es menor de 15 dB).',
  'oído izquierdo: PTA 10 dB HL. Umbral dentro del rango de referencia (≤ 20 dB HL). curva plana (la diferencia entre 500 Hz y 4000 Hz es menor de 15 dB).',
  'Audiometría verbal, banda D: reconocimiento 90 % (9/10) a 65 dB. URV/SRT estimado: no disponible dB.',
  'Variante lingüística registrada: es.',
  'Parámetros medidos en esta toma: F0 250 Hz, jitter local ciclo a ciclo 0.5 %, shimmer local ciclo a ciclo 2 %, HNR 18 dB. Formantes F1–F3: 500, 1500, 2500. Parámetros acústicos registrados dentro de los intervalos de referencia orientativos para voz pediátrica en esta toma (F0, jitter, shimmer y HNR sin desvíos por encima del umbral de alerta).',
  'La estimación ciclo a ciclo del shimmer comprime la cifra entre 1,3 y 1,7 veces respecto a Praat. Los formantes F1–F3 de esta toma están registrados.',
  'Registro descriptivo de habla conectada: 4 s, 12 núcleos silábicos, 1 pausas, rango tonal 5 semitonos, velocidad 3/4. No hay baremo poblacional de referencia para estas medidas. La lectura corresponde al profesional.',
  'T.A.R.: 8 de 10 ítems evaluados, 80 % de producción concordante. Desglose SODA (sustitución, omisión, distorsión, adición): S 1, O 0, D 0, A 0.',
  'Banda C: hitos contestados cumplidos en el cribado ASHA.',
  'M-CHAT-R: puntuación 0 sobre 20, banda baja (0–2). La puntuación queda por debajo de 3.',
  'MECV-V: sin signos de compromiso de eficacia ni de seguridad en los bolos evaluados.',
  'PSQ de Chervin: 1 de 13 respuestas afirmativas. Grado amigdalar de Brodsky: 1. IMC en el intervalo de referencia. Sospecha orientativa: baja. La confirmación corresponde a una polisomnografía en Unidad de Sueño.',
  'Funciones ejecutivas, banda B: índice global 80/100. Dominios completados: (5/5) attention 80/100, inhibition 80/100, flexibility 80/100, workingMemory 80/100, planning 80/100. Puntuaciones iguales o superiores al umbral orientativo (≥ 65/100) en los dominios completados.',
  'Aviso SaMD Clase IIa. El texto describe medidas y desvíos respecto a umbrales de referencia. La decisión clínica corresponde al profesional presente.',
].join('\n');

const repeat = (lang: UiLang) => {
  const first = evaluateSessionNlg(archetype(), lang);
  for (let i = 0; i < 49; i++) {
    const again = evaluateSessionNlg(archetype(), lang);
    expect(again.formattedReportText).toBe(first.formattedReportText);
    expect(again.ruleIds).toEqual(first.ruleIds);
  }
  return first;
};

describe('oro NLG', () => {
  it('castellano peninsular: mismas reglas y el mismo texto cincuenta veces', () => {
    const report = repeat('es');
    expect(report.unavailableReason).toBeNull();
    expect(report.ruleIds).toEqual(GOLD_RULE_IDS);
    expect(report.formattedReportText).toBe(GOLD_ES);
  });

  it('es-419 y es-DO repiten el oro peninsular byte a byte', () => {
    const es = evaluateSessionNlg(archetype(), 'es');
    for (const lang of ['es-419', 'es-DO'] as const) {
      expect(isNlgCatalogReady(lang)).toBe(true);
      const report = repeat(lang);
      expect(report.formattedReportText).toBe(es.formattedReportText);
      expect(report.ruleIds).toEqual(es.ruleIds);
    }
  });

  it('gl, eu, ca y en repiten sus reglas y no copian el oro castellano', () => {
    const anchor = {
      gl: 'limiar de alerta',
      eu: 'alerta-atalase',
      ca: 'llindar d’alerta',
      en: 'alert threshold',
    } as const;
    for (const lang of ['gl', 'eu', 'ca', 'en'] as const) {
      expect(isNlgCatalogReady(lang)).toBe(true);
      const report = repeat(lang);
      expect(report.unavailableReason).toBeNull();
      expect(report.ruleIds).toEqual(GOLD_RULE_IDS);
      expect(report.formattedReportText).not.toBe(GOLD_ES);
      expect(report.formattedReportText).toContain(anchor[lang]);
    }
  });
});
