/* Ida y vuelta de ArticulationTestRepository y ExecutiveFunctionsRepository sobre sql.js (NO el driver nitro del dispositivo). */
jest.mock('@/Database/config', () =>
  require('../../../jest/memoryDataSource').configMock(),
);

import { AppDataSource } from '@/Database/config';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { ArticulationTest } from '@/Models/ArticulationTest/ArticulationTest';
import { ExecutiveFunctionsTest } from '@/Models/ExecutiveFunctions/ExecutiveFunctionsTest';
import { ArticulationTestRepository } from '@/Repositories/ArticulationTestRepository';
import { ExecutiveFunctionsRepository } from '@/Repositories/ExecutiveFunctionsRepository';
import { makeEvaluation, registerRoundTrip } from '../../../jest/repositoryFixtures';

let a: Evaluation;
let b: Evaluation;

beforeAll(async () => {
  await AppDataSource.initialize();
  a = await makeEvaluation('artA');
  b = await makeEvaluation('artB');
});

afterAll(async () => {
  await AppDataSource.destroy();
});

const buildArticulation = (ev: Evaluation): ArticulationTest =>
  Object.assign(new ArticulationTest(), {
    instrument: 'T.A.R. (Articulación a la Repetición)',
    results: { '1': 'C', '2': 'S', '3': null, '4': 'D' },
    substitutions: { '2': 'tapato' },
    evaluatedCount: 3,
    totalCount: 4,
    correctPct: 33,
    sodaCounts: { C: 1, S: 1, O: 0, D: 1, A: 0 },
    affectedPhonemes: [{ phoneme: '/s/', count: 1 }],
    phonemeStatus: [{ phoneme: '/p/', status: 'ok' }, { phoneme: '/s/', status: 'affected' }],
    notes: { obs: 'sustituye /s/ por /t/' },
    evaluatorName: 'Dra. Prueba',
    evaluatorLicense: 'COL-123',
    evaluation: ev,
  }) as unknown as ArticulationTest;

describe('ArticulationTestRepository', () => {
  registerRoundTrip<ArticulationTest>(
    {
      build: buildArticulation,
      fields: [
        'instrument', 'results', 'substitutions', 'evaluatedCount', 'totalCount', 'correctPct',
        'sodaCounts', 'affectedPhonemes', 'phonemeStatus', 'notes', 'evaluatorName', 'evaluatorLicense',
      ],
      mutatedField: 'correctPct',
      create: item => ArticulationTestRepository.createArticulation(item),
      getById: id => ArticulationTestRepository.getArticulationById(id),
      getByEvaluation: id => ArticulationTestRepository.getArticulationByEvaluation(id),
      mutate: t => { t.correctPct = 75; },
      update: item => ArticulationTestRepository.updateArticulation(item),
      remove: id => ArticulationTestRepository.deleteArticulation(id),
    },
    () => ({ a, b }),
  );

  it('un ítem sin evaluar (null) en results vuelve null, no se pierde ni pasa a false', async () => {
    const t = buildArticulation(a);
    t.completedAt = new Date();
    const saved = await ArticulationTestRepository.createArticulation(t);
    const read = await ArticulationTestRepository.getArticulationById(saved.id);
    expect(read!.results).toHaveProperty('3', null);
    expect(Object.keys(read!.results)).toEqual(['1', '2', '3', '4']);
  });
});

const buildExecutive = (ev: Evaluation): ExecutiveFunctionsTest =>
  Object.assign(new ExecutiveFunctionsTest(), {
    instrument: 'Exploración lúdica de funciones ejecutivas',
    ageBand: 'B',
    results: { attention: { hits: 8, misses: 2, rtMs: [410, 520] }, planning: { moves: 12 } },
    attentionScore: 80,
    inhibitionScore: null,
    flexibilityScore: 0,
    workingMemoryScore: 55,
    planningScore: null,
    overallScore: 45,
    interpretation: 'en rango',
    notes: '',
    evaluatorName: 'Dra. Prueba',
    evaluatorLicense: 'COL-123',
    evaluation: ev,
  }) as unknown as ExecutiveFunctionsTest;

describe('ExecutiveFunctionsRepository', () => {
  registerRoundTrip<ExecutiveFunctionsTest>(
    {
      build: buildExecutive,
      fields: [
        'instrument', 'ageBand', 'results', 'attentionScore', 'inhibitionScore', 'flexibilityScore',
        'workingMemoryScore', 'planningScore', 'overallScore', 'interpretation',
      ],
      mutatedField: 'overallScore',
      create: item => ExecutiveFunctionsRepository.createExecutiveFunctions(item),
      getById: id => ExecutiveFunctionsRepository.getExecutiveFunctionsById(id),
      getByEvaluation: id => ExecutiveFunctionsRepository.getExecutiveFunctionsByEvaluation(id),
      mutate: t => { t.overallScore = 90; },
      update: item => ExecutiveFunctionsRepository.updateExecutiveFunctions(item),
      remove: id => ExecutiveFunctionsRepository.deleteExecutiveFunctions(id),
    },
    () => ({ a, b }),
  );

  it('una puntuación null (no medida) NO se convierte en 0, y un 0 medido sigue siendo 0', async () => {
    const t = buildExecutive(a);
    t.completedAt = new Date();
    const saved = await ExecutiveFunctionsRepository.createExecutiveFunctions(t);
    const read = await ExecutiveFunctionsRepository.getExecutiveFunctionsById(saved.id);
    expect(read!.inhibitionScore).toBeNull();
    expect(read!.planningScore).toBeNull();
    expect(read!.flexibilityScore).toBe(0);
  });
});
