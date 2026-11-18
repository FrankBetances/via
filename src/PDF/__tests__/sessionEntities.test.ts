/* -------------------------------------------------------------------------- */
/*  A3: el PDF lee la sesión UNA vez, para la síntesis y para las páginas.     */
/* -------------------------------------------------------------------------- */

const list = (tag: string) => jest.fn().mockResolvedValue([{ tag }]);

jest.mock('@/Repositories/ClinicalAssessmentRepository', () => ({ ClinicalAssessmentRepository: { getClinicalAssessmentsByEvaluation: list('cap') } }));
jest.mock('@/Repositories/ScreeningRepository', () => ({ ScreeningRepository: { getScreeningsByEvaluation: list('scr') } }));
jest.mock('@/Repositories/AudiometryRepository', () => ({ AudiometryRepository: { getAudiometryByEvaluation: list('aud') } }));
jest.mock('@/Repositories/VerbalAudiometryRepository', () => ({ VerbalAudiometryRepository: { getVerbalAudiometryByEvaluation: list('ver') } }));
jest.mock('@/Repositories/VoiceAnalysisRepository', () => ({ VoiceAnalysisRepository: { getVoiceAnalysisByEvaluation: list('voz') } }));
jest.mock('@/Repositories/ProsodyAnalysisRepository', () => ({ ProsodyAnalysisRepository: { getProsodyAnalysisByEvaluation: list('pro') } }));
jest.mock('@/Repositories/ExecutiveFunctionsRepository', () => ({ ExecutiveFunctionsRepository: { getExecutiveFunctionsByEvaluation: list('ef') } }));
jest.mock('@/Repositories/DysphagiaTestRepository', () => ({ DysphagiaTestRepository: { getDysphagiaByEvaluation: list('dys') } }));
jest.mock('@/Repositories/SahsScreeningRepository', () => ({ SahsScreeningRepository: { getSahsScreeningsByEvaluation: list('sahs') } }));
jest.mock('@/Repositories/ArticulationTestRepository', () => ({ ArticulationTestRepository: { getArticulationByEvaluation: list('art') } }));
jest.mock('@/Repositories/AshaMilestoneTestRepository', () => ({ AshaMilestoneTestRepository: { getAshaTestsByEvaluation: list('asha') } }));

import { VoiceAnalysisRepository } from '@/Repositories/VoiceAnalysisRepository';
import { AudiometryRepository } from '@/Repositories/AudiometryRepository';
import { loadSessionEntities } from '@/PDF/sessionEntities';

// Mismo patrón que `src/Lua/__tests__/luaProtocolGate.test.ts`: sin tipos de Node.
declare function require(name: string): any;
declare const __dirname: string;

describe('loadSessionEntities', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lee cada módulo una vez y devuelve los once', async () => {
    const s = await loadSessionEntities(7);
    expect(Object.keys(s).sort()).toEqual(
      [
        'articulations',
        'ashaTests',
        'audiometries',
        'clinicalAssessments',
        'dysphagias',
        'executiveFunctions',
        'prosodyAnalyses',
        'sahsScreenings',
        'screenings',
        'verbalAudiometries',
        'voiceAnalyses',
      ].sort(),
    );
    expect(AudiometryRepository.getAudiometryByEvaluation).toHaveBeenCalledTimes(1);
    expect(AudiometryRepository.getAudiometryByEvaluation).toHaveBeenCalledWith(7);
  });

  it('si un módulo falla, falla la lectura entera (no un informe con un módulo de menos)', async () => {
    (VoiceAnalysisRepository.getVoiceAnalysisByEvaluation as jest.Mock).mockRejectedValueOnce(new Error('tabla'));
    await expect(loadSessionEntities(7)).rejects.toThrow('tabla');
  });
});

describe('Report.ts no relee los módulos por su cuenta', () => {
  it('solo lee el consentimiento directamente; los módulos vienen de loadSessionEntities', () => {
    const fs = require('fs');
    const path = require('path');
    const code: string = fs.readFileSync(path.join(__dirname, '..', 'templates', 'Report.ts'), 'utf8');
    expect(code).toMatch(/loadSessionEntities\(evaluation\.id\)/);
    const repoCalls = code.match(/\b\w+Repository\.\w+\(/g) ?? [];
    const unexpected = repoCalls.filter(
      c => !c.startsWith('InformedConsentRepository.') && !c.startsWith('NlgReportSnapshotRepository.'),
    );
    expect(unexpected).toEqual([]);
  });
});

describe('Resultados finales sintetiza sobre la misma lectura que el PDF', () => {
  it('usa loadSessionEntities para la síntesis', () => {
    const fs = require('fs');
    const path = require('path');
    const code: string = fs.readFileSync(
      path.join(__dirname, '..', '..', 'Screens', 'ResultadosFinal', 'ResultadosFinalScreen.tsx'),
      'utf8',
    );
    expect(code).toMatch(/const session = await loadSessionEntities\(evaluationId\);[\s\S]{0,80}setNlgEntities\(session\)/);
  });
});
