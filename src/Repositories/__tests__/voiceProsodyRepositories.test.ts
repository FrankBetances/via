/* Ida y vuelta de VoiceAnalysisRepository y ProsodyAnalysisRepository sobre sql.js (NO el driver nitro del dispositivo). */
jest.mock('@/Database/config', () =>
  require('../../../jest/memoryDataSource').configMock(),
);

import { AppDataSource } from '@/Database/config';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { VoiceAnalysis } from '@/Models/VoiceAnalysis/VoiceAnalysis';
import { ProsodyAnalysis } from '@/Models/ProsodyAnalysis/ProsodyAnalysis';
import { VoiceAnalysisRepository } from '@/Repositories/VoiceAnalysisRepository';
import { ProsodyAnalysisRepository } from '@/Repositories/ProsodyAnalysisRepository';
import { makeEvaluation, registerRoundTrip } from '../../../jest/repositoryFixtures';

let a: Evaluation;
let b: Evaluation;

beforeAll(async () => {
  await AppDataSource.initialize();
  a = await makeEvaluation('vozA');
  b = await makeEvaluation('vozB');
});

afterAll(async () => {
  await AppDataSource.destroy();
});

const buildVoice = (ev: Evaluation): VoiceAnalysis =>
  Object.assign(new VoiceAnalysis(), {
    vowel: 'a',
    source: 'mic',
    durationSec: 4.75,
    quality: 'good',
    f0: 231.4,
    jitter: 0.52,
    shimmer: 3.1,
    hnr: 18.2,
    formants: { f1: 850, f2: 1220, f3: 2810 },
    grbas: { G: 1, R: 0, B: 1, A: 0, S: 0 },
    interpretation: 'dentro de referencia',
    notes: 'toma 1',
    evaluatorName: 'Dra. Prueba',
    evaluatorLicense: 'COL-123',
    evaluatorSignatureSvg: '<svg><path d="M0 0L10 10"/></svg>',
    evaluation: ev,
  });

describe('VoiceAnalysisRepository', () => {
  registerRoundTrip<VoiceAnalysis>(
    {
      build: buildVoice,
      fields: [
        'vowel', 'source', 'durationSec', 'quality', 'f0', 'jitter', 'shimmer', 'hnr',
        'formants', 'grbas', 'interpretation', 'notes', 'evaluatorName', 'evaluatorLicense',
        'evaluatorSignatureSvg',
      ],
      mutatedField: 'f0',
      create: item => VoiceAnalysisRepository.createVoiceAnalysis(item),
      getById: id => VoiceAnalysisRepository.getVoiceAnalysisById(id),
      getByEvaluation: id => VoiceAnalysisRepository.getVoiceAnalysisByEvaluation(id),
      mutate: t => { t.f0 = 199.9; },
      update: item => VoiceAnalysisRepository.updateVoiceAnalysis(item),
      remove: id => VoiceAnalysisRepository.deleteVoiceAnalysis(id),
    },
    () => ({ a, b }),
  );

  it('una toma sin medir (f0/jitter/shimmer/hnr/formantes/GRBAS null) vuelve null, no 0', async () => {
    const t = buildVoice(a);
    t.f0 = null;
    t.jitter = null;
    t.shimmer = null;
    t.hnr = null;
    t.formants = null;
    t.grbas = null;
    t.completedAt = new Date();
    const saved = await VoiceAnalysisRepository.createVoiceAnalysis(t);
    const read = await VoiceAnalysisRepository.getVoiceAnalysisById(saved.id);
    expect(read!.f0).toBeNull();
    expect(read!.jitter).toBeNull();
    expect(read!.shimmer).toBeNull();
    expect(read!.hnr).toBeNull();
    expect(read!.formants).toBeNull();
    expect(read!.grbas).toBeNull();
  });

  it('un 0 medido (jitter 0) vuelve 0 y no null', async () => {
    const t = buildVoice(a);
    t.jitter = 0;
    t.completedAt = new Date();
    const saved = await VoiceAnalysisRepository.createVoiceAnalysis(t);
    expect((await VoiceAnalysisRepository.getVoiceAnalysisById(saved.id))!.jitter).toBe(0);
  });
});

const buildProsody = (ev: Evaluation): ProsodyAnalysis =>
  Object.assign(new ProsodyAnalysis(), {
    task: 'narracion-lamina',
    ageBand: 'prelector',
    stimulusId: 'lamina-03',
    language: 'es',
    metrics: {
      speechRate: 3.2,
      pauses: [{ startMs: 400, durMs: 320 }, { startMs: 1500, durMs: 210 }],
      pitch: { mean: 240, sd: 31.5, range: [180, 330] },
      nested: { deep: { value: null, flag: false } },
    },
    reason: 'ok',
    interpretation: 'prosodia esperable',
    notes: { obs: 'observación', tags: ['a', 'b'] },
    evaluatorName: 'Dra. Prueba',
    evaluatorLicense: 'COL-123',
    evaluatorSignatureSvg: null,
    evaluation: ev,
  }) as unknown as ProsodyAnalysis;

describe('ProsodyAnalysisRepository', () => {
  registerRoundTrip<ProsodyAnalysis>(
    {
      build: buildProsody,
      fields: [
        'task', 'ageBand', 'stimulusId', 'language', 'metrics', 'reason', 'interpretation',
        'notes', 'evaluatorName', 'evaluatorLicense', 'evaluatorSignatureSvg',
      ],
      mutatedField: 'interpretation',
      create: item => ProsodyAnalysisRepository.createProsodyAnalysis(item),
      getById: id => ProsodyAnalysisRepository.getProsodyAnalysisById(id),
      getByEvaluation: id => ProsodyAnalysisRepository.getProsodyAnalysisByEvaluation(id),
      mutate: t => { t.interpretation = 'revisar'; },
      update: item => ProsodyAnalysisRepository.updateProsodyAnalysis(item),
      remove: id => ProsodyAnalysisRepository.deleteProsodyAnalysis(id),
    },
    () => ({ a, b }),
  );

  it('las métricas anidadas (arrays, objetos, null, false) vuelven idénticas', async () => {
    const t = buildProsody(a);
    t.completedAt = new Date();
    const saved = await ProsodyAnalysisRepository.createProsodyAnalysis(t);
    const read = await ProsodyAnalysisRepository.getProsodyAnalysisById(saved.id);
    expect(read!.metrics).toEqual(buildProsody(a).metrics);
    expect((read!.metrics as unknown as { nested: { deep: { value: null; flag: boolean } } }).nested.deep.flag).toBe(false);
  });
});
