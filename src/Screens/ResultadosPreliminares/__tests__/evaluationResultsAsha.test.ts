/* -------------------------------------------------------------------------- */
/*  «No guarda la evaluación de lenguaje ASHA» (Frank, 2/11/2026). El cribado  */
/*  se escribía, pero `loadEvaluationResultCards` —Resultados preliminares e   */
/*  Historial— no leía ASHA: tras guardar, la tarjeta no salía en ningún      */
/*  sitio. Este test falla si ASHA vuelve a quedarse fuera.                   */
/* -------------------------------------------------------------------------- */

jest.mock('@/Repositories/AudiometryRepository', () => ({ __esModule: true, AudiometryRepository: { getAudiometryByEvaluation: async () => [] } }));
jest.mock('@/Repositories/VoiceAnalysisRepository', () => ({ __esModule: true, VoiceAnalysisRepository: { getVoiceAnalysisByEvaluation: async () => [] } }));
jest.mock('@/Repositories/DysphagiaTestRepository', () => ({ __esModule: true, DysphagiaTestRepository: { getDysphagiaByEvaluation: async () => [] } }));
jest.mock('@/Repositories/SahsScreeningRepository', () => ({ __esModule: true, SahsScreeningRepository: { getSahsScreeningsByEvaluation: async () => [] } }));
jest.mock('@/Repositories/ArticulationTestRepository', () => ({ __esModule: true, ArticulationTestRepository: { getArticulationByEvaluation: async () => [] } }));
jest.mock('@/Repositories/ProsodyAnalysisRepository', () => ({ __esModule: true, ProsodyAnalysisRepository: { getProsodyAnalysisByEvaluation: async () => [] } }));
jest.mock('@/Repositories/VerbalAudiometryRepository', () => ({ __esModule: true, VerbalAudiometryRepository: { getVerbalAudiometryByEvaluation: async () => [] } }));
jest.mock('@/Repositories/ScreeningRepository', () => ({ __esModule: true, ScreeningRepository: { getScreeningsByEvaluation: async () => [] } }));
jest.mock('@/Repositories/ExecutiveFunctionsRepository', () => ({ __esModule: true, ExecutiveFunctionsRepository: { getExecutiveFunctionsByEvaluation: async () => [] } }));
jest.mock('@/Repositories/AshaMilestoneTestRepository', () => ({
  __esModule: true,
  AshaMilestoneTestRepository: {
    getAshaTestsByEvaluation: async (evaluationId: number) =>
      evaluationId === 7
        ? [
            {
              id: '3f2c-uuid',
              ageBand: '19-24m',
              responses: { a: true, b: false, c: true },
              riskLevel: 'red',
              recommendedReferrals: [],
              failedDomains: ['expressive'],
            },
          ]
        : [],
  },
}));

import { loadEvaluationResultCards } from '@/Screens/ResultadosPreliminares/evaluationResults';

describe('Resultados · cribado ASHA', () => {
  it('el cribado guardado sale como tarjeta, con su estado y la frase del motor', async () => {
    const cards = await loadEvaluationResultCards(7);
    const asha = cards.find(c => c.key === 'asha-3f2c-uuid');
    expect(asha).toBeDefined();
    expect(asha?.status).toBe('alt');
    expect(asha?.headline).toContain('banderas rojas');
    expect(asha?.metric).toContain('19-24m');
  });

  it('sin cribado no inventa tarjeta', async () => {
    expect((await loadEvaluationResultCards(8)).some(c => c.key.startsWith('asha-'))).toBe(false);
  });
});
