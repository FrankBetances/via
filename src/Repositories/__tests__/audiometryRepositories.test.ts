/* Ida y vuelta de AudiometryRepository y VerbalAudiometryRepository sobre sql.js (NO el driver nitro del dispositivo). */
jest.mock('@/Database/config', () =>
  require('../../../jest/memoryDataSource').configMock(),
);

import { AppDataSource } from '@/Database/config';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { AudiometryTest } from '@/Models/Audiometry/AudiometryTest';
import { VerbalAudiometryTest } from '@/Models/VerbalAudiometry/VerbalAudiometryTest';
import { AudiometryRepository } from '@/Repositories/AudiometryRepository';
import { VerbalAudiometryRepository } from '@/Repositories/VerbalAudiometryRepository';
import { makeEvaluation, registerRoundTrip } from '../../../jest/repositoryFixtures';

let a: Evaluation;
let b: Evaluation;

beforeAll(async () => {
  await AppDataSource.initialize();
  a = await makeEvaluation('audA');
  b = await makeEvaluation('audB');
});

afterAll(async () => {
  await AppDataSource.destroy();
});

const thresholds = {
  OD: { 500: 20, 1000: null, 2000: 35, 4000: 50 },
  OI: { 500: 15, 1000: 20, 2000: null, 4000: 25 },
} as unknown as AudiometryTest['thresholds'];

const buildAudiometry = (ev: Evaluation): AudiometryTest =>
  Object.assign(new AudiometryTest(), {
    method: 'conditioned',
    transducer: 'soundfield',
    thresholds,
    noResponseAtMax: { OD: [8000], CL: [250, 500] },
    ptaOD: 35,
    ptaOI: null,
    reliability: 80,
    interpretation: 'pérdida leve',
    notes: 'niño colaborador',
    evaluatorName: 'Dra. Prueba',
    evaluatorLicense: 'COL-123',
    evaluation: ev,
  });

describe('AudiometryRepository', () => {
  describe('ida y vuelta común', () => {
    registerRoundTrip<AudiometryTest>(
      {
        build: buildAudiometry,
        fields: [
          'method', 'transducer', 'thresholds', 'noResponseAtMax', 'ptaOD', 'ptaOI',
          'reliability', 'interpretation', 'notes', 'evaluatorName', 'evaluatorLicense',
        ],
        mutatedField: 'interpretation',
        create: item => AudiometryRepository.createAudiometry(item),
        getById: id => AudiometryRepository.getAudiometryById(id),
        getByEvaluation: id => AudiometryRepository.getAudiometryByEvaluation(id),
        mutate: t => { t.interpretation = 'normal'; },
        update: item => AudiometryRepository.updateAudiometry(item),
        remove: id => AudiometryRepository.deleteAudiometry(id),
      },
      () => ({ a, b }),
    );
  });

  describe('«no determinado» frente a «sin respuesta al máximo»', () => {
    it('un umbral null sigue siendo null: ni 0, ni ausente, ni el máximo', async () => {
      const t = buildAudiometry(a);
      t.noResponseAtMax = null;
      t.completedAt = new Date();
      const saved = await AudiometryRepository.createAudiometry(t);
      const read = await AudiometryRepository.getAudiometryById(saved.id);
      expect(read!.thresholds.OD[1000]).toBeNull();
      expect(Object.prototype.hasOwnProperty.call(read!.thresholds.OD, '1000')).toBe(true);
      expect(read!.thresholds.OI[2000]).toBeNull();
      expect(read!.thresholds.OD[500]).toBe(20);
    });

    it('un umbral null NO se mezcla con sin-respuesta, ni al revés', async () => {
      const t = buildAudiometry(a);
      t.completedAt = new Date();
      // 1000 Hz OD no determinado (null) en thresholds; 8000 Hz OD sin respuesta al máximo.
      const saved = await AudiometryRepository.createAudiometry(t);
      const read = await AudiometryRepository.getAudiometryById(saved.id);
      expect(read!.thresholds.OD[1000]).toBeNull();
      expect(read!.noResponseAtMax!.OD).toEqual([8000]);
      expect(read!.noResponseAtMax!.OD).not.toContain(1000);
      expect(read!.noResponseAtMax!.CL).toEqual([250, 500]);
      expect(read!.noResponseAtMax!.OI).toBeUndefined();
    });

    it('un registro sin noResponseAtMax se lee como null, no como false ni {}', async () => {
      const t = buildAudiometry(a);
      (t as Partial<AudiometryTest>).noResponseAtMax = undefined;
      t.completedAt = new Date();
      const saved = await AudiometryRepository.createAudiometry(t);
      const read = await AudiometryRepository.getAudiometryById(saved.id);
      expect(read!.noResponseAtMax).toBeNull();
      expect(read!.noResponseAtMax).not.toBe(false);
    });

    it('un registro anterior al 2/11/2026 (columna a NULL en SQL) se lee como null', async () => {
      const t = buildAudiometry(a);
      t.completedAt = new Date();
      const saved = await AudiometryRepository.createAudiometry(t);
      await AppDataSource.query('UPDATE audiometry_test SET noResponseAtMax = NULL WHERE id = ?', [saved.id]);
      const read = await AudiometryRepository.getAudiometryById(saved.id);
      expect(read!.noResponseAtMax).toBeNull();
      expect(read!.thresholds.OD[1000]).toBeNull();
    });

    it('ptaOD/ptaOI/reliability null vuelven null y 0 vuelve 0', async () => {
      const t = buildAudiometry(a);
      t.ptaOD = 0;
      t.ptaOI = null;
      t.reliability = null;
      t.completedAt = new Date();
      const saved = await AudiometryRepository.createAudiometry(t);
      const read = await AudiometryRepository.getAudiometryById(saved.id);
      expect(read!.ptaOD).toBe(0);
      expect(read!.ptaOI).toBeNull();
      expect(read!.reliability).toBeNull();
    });
  });
});

const verbalResults = {
  '1': { correct: true, level: 40, ms: 1200 },
  '2': { correct: false, level: 30, ms: null },
} as unknown as VerbalAudiometryTest['results'];

const levelScores = [
  { level: 40, presented: 5, correct: 4 },
  { level: 30, presented: 5, correct: 2 },
] as unknown as VerbalAudiometryTest['levelScores'];

const buildVerbal = (ev: Evaluation): VerbalAudiometryTest =>
  Object.assign(new VerbalAudiometryTest(), {
    instrument: 'Audiometría verbal (campo libre)',
    transducer: 'soundfield',
    ageBand: 'B',
    language: 'gl',
    modality: 'images',
    mode: 'discrimination',
    results: verbalResults,
    levelScores,
    srtDb: null,
    presentedCount: 10,
    correctCount: 6,
    discriminationPct: 60,
    reliability: 90,
    interpretation: 'discriminación moderada',
    notes: '',
    evaluatorName: 'Dra. Prueba',
    evaluatorLicense: 'COL-123',
    evaluation: ev,
  });

describe('VerbalAudiometryRepository', () => {
  registerRoundTrip<VerbalAudiometryTest>(
    {
      build: buildVerbal,
      fields: [
        'ageBand', 'language', 'modality', 'mode', 'results', 'levelScores', 'srtDb',
        'presentedCount', 'correctCount', 'discriminationPct', 'reliability', 'interpretation',
      ],
      mutatedField: 'correctCount',
      create: item => VerbalAudiometryRepository.createVerbalAudiometry(item),
      getById: id => VerbalAudiometryRepository.getVerbalAudiometryById(id),
      getByEvaluation: id => VerbalAudiometryRepository.getVerbalAudiometryByEvaluation(id),
      mutate: t => { t.correctCount = 9; },
      update: item => VerbalAudiometryRepository.updateVerbalAudiometry(item),
      remove: id => VerbalAudiometryRepository.deleteVerbalAudiometry(id),
    },
    () => ({ a, b }),
  );

  it('srtDb null (no determinado) vuelve null; un SRT de 0 dB vuelve 0', async () => {
    const t = buildVerbal(a);
    t.completedAt = new Date();
    const s1 = await VerbalAudiometryRepository.createVerbalAudiometry(t);
    const t2 = buildVerbal(a);
    t2.srtDb = 0;
    t2.completedAt = new Date();
    const s2 = await VerbalAudiometryRepository.createVerbalAudiometry(t2);
    expect((await VerbalAudiometryRepository.getVerbalAudiometryById(s1.id))!.srtDb).toBeNull();
    expect((await VerbalAudiometryRepository.getVerbalAudiometryById(s2.id))!.srtDb).toBe(0);
  });
});
