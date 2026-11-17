/* Ida y vuelta de DysphagiaTestRepository y AshaMilestoneTestRepository sobre sql.js (NO el driver nitro del dispositivo). */
jest.mock('@/Database/config', () =>
  require('../../../jest/memoryDataSource').configMock(),
);

import { AppDataSource } from '@/Database/config';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { DysphagiaTest } from '@/Models/DysphagiaTest/DysphagiaTest';
import { AshaMilestoneTest } from '@/Models/Asha/AshaMilestoneTest';
import { DysphagiaTestRepository } from '@/Repositories/DysphagiaTestRepository';
import { AshaMilestoneTestRepository } from '@/Repositories/AshaMilestoneTestRepository';
import { makeEvaluation, registerRoundTrip } from '../../../jest/repositoryFixtures';

let a: Evaluation;
let b: Evaluation;

beforeAll(async () => {
  await AppDataSource.initialize();
  a = await makeEvaluation('disA');
  b = await makeEvaluation('disB');
});

afterAll(async () => {
  await AppDataSource.destroy();
});

const bolus = [
  {
    id: 1, viscosity: 'nectar', volume: 5, evaluated: true, skipped: false, spo2: 96,
    safety: { tos: false, cambio_voz: false },
    efficacy: { sello_labial: true, residuo: false, deglucion_fraccionada: false },
  },
  {
    id: 2, viscosity: 'liquido', volume: 10, evaluated: false, skipped: true, spo2: null,
    safety: { tos: true, cambio_voz: false },
    efficacy: { sello_labial: true, residuo: true, deglucion_fraccionada: true },
  },
];

const buildDysphagia = (ev: Evaluation): DysphagiaTest =>
  Object.assign(new DysphagiaTest(), {
    basalSpO2: 98,
    spo2Source: 'ble',
    bolus,
    safetyAltered: true,
    efficacyAltered: false,
    minSpO2: null,
    maxDrop: 3,
    recommendation: 'dieta triturada',
    verdict: 'safety',
    interpretation: 'seguridad alterada',
    notes: '',
    evaluatorName: 'Dra. Prueba',
    evaluatorLicense: 'COL-123',
    evaluation: ev,
  }) as unknown as DysphagiaTest;

describe('DysphagiaTestRepository', () => {
  registerRoundTrip<DysphagiaTest>(
    {
      build: buildDysphagia,
      fields: [
        'basalSpO2', 'spo2Source', 'bolus', 'safetyAltered', 'efficacyAltered', 'minSpO2',
        'maxDrop', 'recommendation', 'verdict', 'interpretation',
      ],
      mutatedField: 'verdict',
      create: item => DysphagiaTestRepository.createDysphagia(item),
      getById: id => DysphagiaTestRepository.getDysphagiaById(id),
      getByEvaluation: id => DysphagiaTestRepository.getDysphagiaByEvaluation(id),
      mutate: t => { t.verdict = 'efficacy'; },
      update: item => DysphagiaTestRepository.updateDysphagia(item),
      remove: id => DysphagiaTestRepository.deleteDysphagia(id),
    },
    () => ({ a, b }),
  );

  it('booleanos clínicos vuelven como booleanos; SpO2 no medida (null) vuelve null, no 0', async () => {
    const t = buildDysphagia(a);
    t.completedAt = new Date();
    const saved = await DysphagiaTestRepository.createDysphagia(t);
    const read = await DysphagiaTestRepository.getDysphagiaById(saved.id);
    expect(read!.safetyAltered).toBe(true);
    expect(read!.efficacyAltered).toBe(false);
    expect(read!.minSpO2).toBeNull();
    expect(read!.bolus[1].spo2).toBeNull();
    expect(read!.bolus[1].skipped).toBe(true);
  });
});

const buildAsha = (ev: Evaluation): AshaMilestoneTest =>
  Object.assign(new AshaMilestoneTest(), {
    ageBand: '24-30m',
    responses: { hit1: true, hit2: false, hit3: true },
    riskLevel: 'yellow',
    recommendedReferrals: ['logopedia'],
    failedDomains: ['expresivo'],
    evaluatorName: 'Dra. Prueba',
    evaluatorLicense: 'COL-123',
    notes: 'revisar en 3 meses',
    evaluation: ev,
  }) as unknown as AshaMilestoneTest;

describe('AshaMilestoneTestRepository', () => {
  // Este repositorio solo tiene create, getAshaTestsByEvaluation y getLatestAshaTestByEvaluation
  // (sin getById, update ni delete) y el id es un UUID: no usa el recorrido común.
  const t0 = new Date('2026-11-10T09:15:30.123Z');
  const t1 = new Date('2026-11-12T18:45:00.456Z');
  const mk = async (ev: Evaluation, when: Date, mut?: (t: AshaMilestoneTest) => void) => {
    const t = buildAsha(ev);
    t.completedAt = when;
    mut?.(t);
    return AshaMilestoneTestRepository.createAshaTest(t);
  };

  it('guarda y lee con los mismos datos, id UUID y la evaluación', async () => {
    const ev = await makeEvaluation('ashaRT');
    const saved = await mk(ev, t0);
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
    const [read] = await AshaMilestoneTestRepository.getAshaTestsByEvaluation(ev.id);
    expect(read.id).toBe(saved.id);
    const expected = buildAsha(ev);
    expect(read.ageBand).toBe(expected.ageBand);
    expect(read.responses).toEqual(expected.responses);
    expect(read.riskLevel).toBe('yellow');
    expect(read.recommendedReferrals).toEqual(['logopedia']);
    expect(read.failedDomains).toEqual(['expresivo']);
    expect(read.notes).toBe('revisar en 3 meses');
    expect(read.evaluation.id).toBe(ev.id);
    expect(new Date(read.completedAt).getTime()).toBe(t0.getTime());
  });

  it('getAshaTestsByEvaluation no mezcla evaluaciones', async () => {
    const e1 = await makeEvaluation('ashaX');
    const e2 = await makeEvaluation('ashaY');
    const r1 = await mk(e1, t0);
    const r2 = await mk(e2, t1);
    const l1 = await AshaMilestoneTestRepository.getAshaTestsByEvaluation(e1.id);
    expect(l1.map(r => r.id)).toEqual([r1.id]);
    const l2 = await AshaMilestoneTestRepository.getAshaTestsByEvaluation(e2.id);
    expect(l2.map(r => r.id)).toEqual([r2.id]);
    expect(await AshaMilestoneTestRepository.getAshaTestsByEvaluation(987654)).toEqual([]);
  });

  const setCreatedAt = (id: string, value: string) =>
    AppDataSource.query('UPDATE asha_milestone_test SET createdAt = ? WHERE id = ?', [value, id]);

  it('getLatestAshaTestByEvaluation devuelve la más reciente de ESA evaluación o null', async () => {
    const ev = await makeEvaluation('ashaLatest');
    const other = await makeEvaluation('ashaLatestOther');
    const older = await mk(ev, t0, t => { t.riskLevel = 'red'; });
    const newest = await mk(ev, t0, t => { t.riskLevel = 'green'; });
    const foreign = await mk(other, t1, t => { t.riskLevel = 'red'; });
    // createdAt fijado a mano: no depender del reloj ni de la resolución del segundo.
    await setCreatedAt(older.id, '2026-11-01 10:00:00');
    await setCreatedAt(newest.id, '2026-11-05 10:00:00');
    await setCreatedAt(foreign.id, '2026-11-30 10:00:00');
    const got = await AshaMilestoneTestRepository.getLatestAshaTestByEvaluation(ev.id);
    expect(got!.id).toBe(newest.id);
    expect(got!.riskLevel).toBe('green');
    const none = await makeEvaluation('ashaNone');
    expect(await AshaMilestoneTestRepository.getLatestAshaTestByEvaluation(none.id)).toBeNull();
  });

  // FALLO REAL: getLatestAshaTestByEvaluation (y getAshaTestsByEvaluation) ordenan solo por createdAt,
  // que SQLite rellena con datetime('now'), resolución de UN segundo, y la PK es un UUID sin orden
  // temporal. Dos pruebas guardadas en el mismo segundo empatan y la «última» sale indeterminada
  // (el desempate lo decide el UUID, es decir, el azar). Reproducido 1 de cada 5 sin forzar el empate. Sin corregir en el
  // repositorio por orden de B2; al arreglarlo, quitar el .failing.
  it.failing('dos pruebas ASHA guardadas en el mismo segundo: la «última» es siempre la guardada después', async () => {
    // El desempate lo decide el UUID (aleatorio): una sola pareja acierta el 50 % de las veces,
    // así que se repite 16 veces para que acertar todas por azar sea 1 entre 65 536.
    for (let i = 0; i < 16; i += 1) {
      const ev = await makeEvaluation(`ashaTie${i}`);
      const first = await mk(ev, t0, t => { t.riskLevel = 'red'; });
      const second = await mk(ev, t0, t => { t.riskLevel = 'green'; });
      // createdAt tiene resolución de segundo (datetime('now') de SQLite): el empate es realista.
      await setCreatedAt(first.id, '2026-11-05 10:00:00');
      await setCreatedAt(second.id, '2026-11-05 10:00:00');
      const got = await AshaMilestoneTestRepository.getLatestAshaTestByEvaluation(ev.id);
      expect(got!.id).toBe(second.id);
    }
  });
});
