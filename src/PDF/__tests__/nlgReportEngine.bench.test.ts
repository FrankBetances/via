import { evaluateSessionNlg, type SessionEntities } from '@/PDF/nlgReportEngine';

/* -------------------------------------------------------------------------- */
/*  Banco de rendimiento del motor (plan de trabajo §4.4).                     */
/*                                                                            */
/*  Mide en NODE, dentro de Jest, en la máquina que lo ejecute. No es la      */
/*  cifra de la tableta y no se publica como tal: «del orden de               */
/*  milisegundos» solo se escribe con el número medido en el dispositivo.     */
/*  El techo de 25 ms es una alarma de regresión grosera (un bucle            */
/*  cuadrático, una lectura de catálogo por hecho), no un requisito clínico.  */
/* -------------------------------------------------------------------------- */

const ear = (db: number) => ({ 500: db, 1000: db, 2000: db, 4000: db });

const busySession = (): SessionEntities => ({
  clinicalAssessments: [
    {
      id: 1,
      instrument: 'CAP',
      globalResult: 'PARTIAL',
      domains: {
        otoscopia: { od: 'OME', oi: 'Cerumen', kind: 'warn' },
        visual: { kind: 'ok' },
        verbal: { kind: 'ok' },
        motor: { kind: 'ok' },
      },
    } as never,
  ],
  audiometries: [
    {
      id: 1,
      transducer: 'air',
      thresholds: { OD: { ...ear(35), 4000: null }, OI: ear(10) },
      noResponseAtMax: { OD: [4000], OI: [] },
      ptaOD: null,
      ptaOI: null,
    } as never,
  ],
  verbalAudiometries: [
    {
      id: 1,
      ageBand: 'C',
      language: 'es',
      presentedCount: 20,
      correctCount: 13,
      levelScores: [
        { level: 65, presented: 10, correct: 7, pct: 70 },
        { level: 50, presented: 10, correct: 6, pct: 60 },
      ],
      srtDb: 40,
    } as never,
  ],
  voiceAnalyses: [
    {
      id: 1,
      f0: 210,
      jitter: 1.3,
      shimmer: 4.2,
      hnr: 10.5,
      formants: null,
      grbas: { g: 1, r: 1, b: 0, a: 0, s: 0 },
    } as never,
  ],
  articulations: [
    {
      id: 1,
      evaluatedCount: 30,
      totalCount: 30,
      correctPct: 70,
      sodaCounts: { S: 5, O: 2, D: 2, A: 0 },
      affectedPhonemes: [{ phoneme: '/s/' }, { phoneme: '/r/' }],
      phonemeStatus: [
        { phoneme: '/s/', place: 'alveolar' },
        { phoneme: '/r/', place: 'alveolar' },
      ],
    } as never,
  ],
  dysphagias: [
    {
      id: 1,
      safetyAltered: true,
      efficacyAltered: true,
      minSpO2: 93,
      maxDrop: 4,
      recommendation: 'néctar 5 ml',
      bolus: [{}, {}],
    } as never,
  ],
  sahsScreenings: [
    { id: 1, psqYesCount: 8, psqTotal: 22, brodsky: 3, imc: 'sobrepeso', suspicionLevel: 'high' } as never,
  ],
  executiveFunctions: [
    {
      id: 1,
      ageBand: 'C',
      attentionScore: 55,
      inhibitionScore: 60,
      flexibilityScore: 70,
      workingMemoryScore: null,
      planningScore: 80,
      overallScore: 66,
    } as never,
  ],
});

describe('nlgReportEngine · banco de rendimiento (Node)', () => {
  it('una sesión cargada se redacta muy por debajo del techo de regresión', () => {
    const session = busySession();
    for (let i = 0; i < 50; i++) evaluateSessionNlg(session, 'es'); // calentamiento
    const runs = 500;
    const start = Date.now();
    let facts = 0;
    for (let i = 0; i < runs; i++) facts = evaluateSessionNlg(session, 'es').facts.length;
    const meanMs = (Date.now() - start) / runs;
    console.log(`NLG bench (Node): ${meanMs.toFixed(3)} ms por sesión · ${facts} hechos · ${runs} corridas`);
    expect(facts).toBeGreaterThan(15);
    expect(meanMs).toBeLessThan(25);
  });
});
