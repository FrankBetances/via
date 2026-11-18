/* -------------------------------------------------------------------------- */
/*  Pruebas hechas en la evaluación, para marcarlas en el hub (Frank,          */
/*  18/11/2026: tras cada prueba se vuelve al hub con las hechas marcadas).    */
/* -------------------------------------------------------------------------- */

const empty = () => jest.fn().mockResolvedValue([]);

jest.mock('@/Repositories/AudiometryRepository', () => ({ AudiometryRepository: { getAudiometryByEvaluation: empty() } }));
jest.mock('@/Repositories/VerbalAudiometryRepository', () => ({ VerbalAudiometryRepository: { getVerbalAudiometryByEvaluation: empty() } }));
jest.mock('@/Repositories/VoiceAnalysisRepository', () => ({ VoiceAnalysisRepository: { getVoiceAnalysisByEvaluation: empty() } }));
jest.mock('@/Repositories/ArticulationTestRepository', () => ({ ArticulationTestRepository: { getArticulationByEvaluation: empty() } }));
jest.mock('@/Repositories/ExecutiveFunctionsRepository', () => ({ ExecutiveFunctionsRepository: { getExecutiveFunctionsByEvaluation: empty() } }));
jest.mock('@/Repositories/ProsodyAnalysisRepository', () => ({ ProsodyAnalysisRepository: { getProsodyAnalysisByEvaluation: empty() } }));
jest.mock('@/Repositories/ScreeningRepository', () => ({ ScreeningRepository: { getScreeningsByEvaluation: empty() } }));
jest.mock('@/Repositories/SahsScreeningRepository', () => ({ SahsScreeningRepository: { getSahsScreeningsByEvaluation: empty() } }));
jest.mock('@/Repositories/DysphagiaTestRepository', () => ({ DysphagiaTestRepository: { getDysphagiaByEvaluation: empty() } }));
jest.mock('@/Repositories/AshaMilestoneTestRepository', () => ({ AshaMilestoneTestRepository: { getAshaTestsByEvaluation: empty() } }));

import { AudiometryRepository } from '@/Repositories/AudiometryRepository';
import { ScreeningRepository } from '@/Repositories/ScreeningRepository';
import { VoiceAnalysisRepository } from '@/Repositories/VoiceAnalysisRepository';
import { MODULES } from '../moduleCards';
import { DONE_MODULE_IDS, loadDoneModules } from '../doneModules';

const mocked = (f: unknown) => f as jest.Mock;

describe('loadDoneModules', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sin resultados no marca nada', async () => {
    expect((await loadDoneModules(1)).size).toBe(0);
  });

  it('separa la audiometría infantil de la condicionada', async () => {
    mocked(AudiometryRepository.getAudiometryByEvaluation).mockResolvedValue([{ method: 'conditioned' }]);
    const done = await loadDoneModules(1);
    expect(done.has('AudiometryConditioned')).toBe(true);
    expect(done.has('Audiometry')).toBe(false);
  });

  it('el M-CHAT se marca solo con un cribado de autismo', async () => {
    mocked(ScreeningRepository.getScreeningsByEvaluation).mockResolvedValue([{ instrument: 'otro' }]);
    expect((await loadDoneModules(1)).has('Mchat')).toBe(false);
    mocked(ScreeningRepository.getScreeningsByEvaluation).mockResolvedValue([{ instrument: 'autism-tea' }]);
    expect((await loadDoneModules(1)).has('Mchat')).toBe(true);
  });

  it('una lectura que falla no marca el módulo ni tumba los demás', async () => {
    mocked(VoiceAnalysisRepository.getVoiceAnalysisByEvaluation).mockRejectedValue(new Error('tabla ausente'));
    mocked(ScreeningRepository.getScreeningsByEvaluation).mockResolvedValue([{ instrument: 'autism-tea' }]);
    const done = await loadDoneModules(1);
    expect(done.has('VoiceAnalysis')).toBe(false);
    expect(done.has('Mchat')).toBe(true);
  });

  it('cubre cada tarjeta del hub', () => {
    expect([...DONE_MODULE_IDS].sort()).toEqual(MODULES.map(m => m.id).sort());
  });
});
