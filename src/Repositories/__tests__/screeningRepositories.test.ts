/* Ida y vuelta de Screening, SahsScreening y ClinicalAssessment sobre sql.js (NO el driver nitro del dispositivo). */
jest.mock('@/Database/config', () =>
  require('../../../jest/memoryDataSource').configMock(),
);

import { AppDataSource } from '@/Database/config';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { Screening } from '@/Models/Screening/Screening';
import { SahsScreening } from '@/Models/SahsScreening/SahsScreening';
import { ClinicalAssessment } from '@/Models/ClinicalAssessment/ClinicalAssessment';
import { ScreeningRepository } from '@/Repositories/ScreeningRepository';
import { SahsScreeningRepository } from '@/Repositories/SahsScreeningRepository';
import { ClinicalAssessmentRepository } from '@/Repositories/ClinicalAssessmentRepository';
import { makeEvaluation, registerRoundTrip } from '../../../jest/repositoryFixtures';

let a: Evaluation;
let b: Evaluation;

beforeAll(async () => {
  await AppDataSource.initialize();
  a = await makeEvaluation('scrA');
  b = await makeEvaluation('scrB');
});

afterAll(async () => {
  await AppDataSource.destroy();
});

const buildScreening = (ev: Evaluation, instrument = 'M-CHAT-R/F'): Screening =>
  Object.assign(new Screening(), {
    instrument,
    score: 7,
    total: 20,
    riskLevel: 'medium',
    rangeLabel: '3-7',
    recommendation: 'repetir con entrevista de seguimiento',
    answers: { 1: true, 2: false, 3: null, 4: true },
    blockCounts: [2, 0, 1, 4],
    flaggedItems: [{ item: 2, text: 'no señala' }],
    evaluatorName: 'Dra. Prueba',
    evaluatorLicense: 'COL-123',
    evaluation: ev,
  }) as unknown as Screening;

describe('ScreeningRepository', () => {
  registerRoundTrip<Screening>(
    {
      build: ev => buildScreening(ev),
      fields: [
        'instrument', 'score', 'total', 'riskLevel', 'rangeLabel', 'recommendation',
        'answers', 'blockCounts', 'flaggedItems', 'evaluatorName', 'evaluatorLicense',
      ],
      mutatedField: 'score',
      create: item => ScreeningRepository.createScreening(item),
      getById: id => ScreeningRepository.getScreeningById(id),
      getByEvaluation: id => ScreeningRepository.getScreeningsByEvaluation(id),
      mutate: t => { t.score = 12; },
      update: item => ScreeningRepository.updateScreening(item),
      remove: id => ScreeningRepository.deleteScreening(id),
    },
    () => ({ a, b }),
  );

  it('una respuesta sin contestar (null) en answers vuelve null, no false', async () => {
    const t = buildScreening(a);
    t.completedAt = new Date();
    const saved = await ScreeningRepository.createScreening(t);
    const read = await ScreeningRepository.getScreeningById(saved.id);
    expect(read!.answers[3]).toBeNull();
    expect(read!.answers[2]).toBe(false);
  });

  it('getLatestByEvaluationAndInstrument filtra por evaluación E instrumento y toma la más reciente', async () => {
    const ev = await makeEvaluation('scrLatest');
    const other = await makeEvaluation('scrLatestOther');
    const mk = async (e: Evaluation, instrument: string, when: string, score: number) => {
      const s = buildScreening(e, instrument);
      s.score = score;
      s.completedAt = new Date(when);
      return ScreeningRepository.createScreening(s);
    };
    await mk(ev, 'PSQ', '2026-11-01T10:00:00.000Z', 1);
    const newest = await mk(ev, 'PSQ', '2026-11-03T10:00:00.000Z', 2);
    await mk(ev, 'M-CHAT-R/F', '2026-11-09T10:00:00.000Z', 3);
    await mk(other, 'PSQ', '2026-11-20T10:00:00.000Z', 4);

    const got = await ScreeningRepository.getLatestByEvaluationAndInstrument(ev.id, 'PSQ');
    expect(got!.id).toBe(newest.id);
    expect(got!.score).toBe(2);
    expect(await ScreeningRepository.getLatestByEvaluationAndInstrument(ev.id, 'NO-EXISTE')).toBeNull();
  });
});

const buildSahs = (ev: Evaluation): SahsScreening =>
  Object.assign(new SahsScreening(), {
    instrument: 'PSQ-Chervin / SAHS',
    psqAnswers: { 1: true, 2: false, 3: null },
    psqYesCount: 9,
    psqTotal: 22,
    psqPositive: true,
    redFlag: false,
    brodsky: null,
    imc: 'normal',
    signs: ['ronquido', 'pausas'],
    riskFactors: [],
    breakdown: { psq: 4, brodsky: null, signs: 2 },
    totalScore: 6,
    scoreMax: 13,
    suspicionLevel: 'moderate',
    suspicionLabel: 'Sospecha moderada',
    recommendation: 'derivar',
    referral: 'ORL',
    notes: { obs: 'x' },
    evaluatorName: 'Dra. Prueba',
    evaluatorLicense: 'COL-123',
    evaluation: ev,
  }) as unknown as SahsScreening;

describe('SahsScreeningRepository', () => {
  registerRoundTrip<SahsScreening>(
    {
      build: buildSahs,
      fields: [
        'instrument', 'psqAnswers', 'psqYesCount', 'psqTotal', 'psqPositive', 'redFlag', 'brodsky',
        'imc', 'signs', 'riskFactors', 'breakdown', 'totalScore', 'scoreMax', 'suspicionLevel',
        'suspicionLabel', 'recommendation', 'referral', 'notes',
      ],
      mutatedField: 'totalScore',
      create: item => SahsScreeningRepository.createSahsScreening(item),
      getById: id => SahsScreeningRepository.getSahsScreeningById(id),
      getByEvaluation: id => SahsScreeningRepository.getSahsScreeningsByEvaluation(id),
      mutate: t => { t.totalScore = 11; },
      update: item => SahsScreeningRepository.updateSahsScreening(item),
      remove: id => SahsScreeningRepository.deleteSahsScreening(id),
    },
    () => ({ a, b }),
  );

  it('booleanos (psqPositive true / redFlag false) vuelven como booleanos y brodsky null vuelve null', async () => {
    const t = buildSahs(a);
    t.completedAt = new Date();
    const saved = await SahsScreeningRepository.createSahsScreening(t);
    const read = await SahsScreeningRepository.getSahsScreeningById(saved.id);
    expect(read!.psqPositive).toBe(true);
    expect(read!.redFlag).toBe(false);
    expect(read!.brodsky).toBeNull();
  });
});

const buildCap = (ev: Evaluation): ClinicalAssessment =>
  Object.assign(new ClinicalAssessment(), {
    instrument: 'CAP',
    globalResult: 'PARTIAL',
    globalLabel: 'APTO PARCIAL',
    activeGames: 3,
    totalGames: 5,
    domains: {
      otoscopia: { od: 'normal', oi: null, odNotes: '', oiNotes: 'cerumen', notes: '', kind: 'warn' },
      visual: { answers: { v1: true, v2: null }, notes: '', kind: 'ok' },
      verbal: { ageGroup: '3-4', answers: { l1: false }, notes: '', kind: 'pending' },
      motor: { answers: {}, notes: '', kind: 'block' },
    },
    games: [
      { code: 'J01', title: 'Juego 1', active: true, reason: 'Habilitado' },
      { code: 'J02', title: 'Juego 2', active: false, reason: 'Bloqueado por otoscopia' },
    ],
    evaluatorName: 'Dra. Prueba',
    evaluatorLicense: 'COL-123',
    evaluation: ev,
  }) as unknown as ClinicalAssessment;

describe('ClinicalAssessmentRepository', () => {
  registerRoundTrip<ClinicalAssessment>(
    {
      build: buildCap,
      fields: [
        'instrument', 'globalResult', 'globalLabel', 'activeGames', 'totalGames', 'domains',
        'games', 'evaluatorName', 'evaluatorLicense',
      ],
      mutatedField: 'globalResult',
      create: item => ClinicalAssessmentRepository.createClinicalAssessment(item),
      getById: id => ClinicalAssessmentRepository.getClinicalAssessmentById(id),
      getByEvaluation: id => ClinicalAssessmentRepository.getClinicalAssessmentsByEvaluation(id),
      mutate: t => { t.globalResult = 'FULL'; },
      update: item => ClinicalAssessmentRepository.updateClinicalAssessment(item),
      remove: id => ClinicalAssessmentRepository.deleteClinicalAssessment(id),
    },
    () => ({ a, b }),
  );

  it('los dominios anidados conservan los null (oído sin explorar) sin pasarlos a cadena vacía', async () => {
    const t = buildCap(a);
    t.completedAt = new Date();
    const saved = await ClinicalAssessmentRepository.createClinicalAssessment(t);
    const read = await ClinicalAssessmentRepository.getClinicalAssessmentById(saved.id);
    expect(read!.domains.otoscopia.oi).toBeNull();
    expect(read!.domains.visual.answers.v2).toBeNull();
    expect(read!.domains.motor.kind).toBe('block');
  });

  it('getLatestByEvaluation toma la más reciente de ESA evaluación', async () => {
    const ev = await makeEvaluation('capLatest');
    const other = await makeEvaluation('capLatestOther');
    const mk = async (e: Evaluation, when: string, label: string) => {
      const c = buildCap(e);
      c.globalLabel = label;
      c.completedAt = new Date(when);
      return ClinicalAssessmentRepository.createClinicalAssessment(c);
    };
    await mk(ev, '2026-11-01T10:00:00.000Z', 'vieja');
    const newest = await mk(ev, '2026-11-05T10:00:00.000Z', 'nueva');
    await mk(other, '2026-11-30T10:00:00.000Z', 'ajena');
    const got = await ClinicalAssessmentRepository.getLatestByEvaluation(ev.id);
    expect(got!.id).toBe(newest.id);
    expect(got!.globalLabel).toBe('nueva');
  });
});
