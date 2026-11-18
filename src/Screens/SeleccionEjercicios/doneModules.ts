import { AudiometryRepository } from '@/Repositories/AudiometryRepository';
import { VerbalAudiometryRepository } from '@/Repositories/VerbalAudiometryRepository';
import { VoiceAnalysisRepository } from '@/Repositories/VoiceAnalysisRepository';
import { ArticulationTestRepository } from '@/Repositories/ArticulationTestRepository';
import { ExecutiveFunctionsRepository } from '@/Repositories/ExecutiveFunctionsRepository';
import { ProsodyAnalysisRepository } from '@/Repositories/ProsodyAnalysisRepository';
import { ScreeningRepository } from '@/Repositories/ScreeningRepository';
import { SahsScreeningRepository } from '@/Repositories/SahsScreeningRepository';
import { DysphagiaTestRepository } from '@/Repositories/DysphagiaTestRepository';
import { AshaMilestoneTestRepository } from '@/Repositories/AshaMilestoneTestRepository';

/* -------------------------------------------------------------------------- */
/*  Módulos con un resultado guardado en ESTA evaluación.                      */
/*                                                                             */
/*  Decisión de Frank (18/11/2026): tras guardar cada prueba se vuelve al hub  */
/*  con las hechas marcadas. «Hecha» = hay al menos una fila del módulo ligada */
/*  a la evaluación. Si la lectura de un módulo falla, ese módulo NO se marca: */
/*  no se afirma lo que no se ha leído (regla 4 de CLAUDE.md).                 */
/* -------------------------------------------------------------------------- */

type Reader = (evaluationId: number) => Promise<boolean>;

const READERS: Record<string, Reader> = {
  Audiometry: async id =>
    (await AudiometryRepository.getAudiometryByEvaluation(id)).some(a => a.method !== 'conditioned'),
  AudiometryConditioned: async id =>
    (await AudiometryRepository.getAudiometryByEvaluation(id)).some(a => a.method === 'conditioned'),
  VerbalAudiometry: async id => (await VerbalAudiometryRepository.getVerbalAudiometryByEvaluation(id)).length > 0,
  VoiceAnalysis: async id => (await VoiceAnalysisRepository.getVoiceAnalysisByEvaluation(id)).length > 0,
  Articulation: async id => (await ArticulationTestRepository.getArticulationByEvaluation(id)).length > 0,
  ExecutiveFunctions: async id =>
    (await ExecutiveFunctionsRepository.getExecutiveFunctionsByEvaluation(id)).length > 0,
  ProsodyAnalysis: async id => (await ProsodyAnalysisRepository.getProsodyAnalysisByEvaluation(id)).length > 0,
  Mchat: async id =>
    (await ScreeningRepository.getScreeningsByEvaluation(id)).some(s => s.instrument === 'autism-tea'),
  SahsScreening: async id => (await SahsScreeningRepository.getSahsScreeningsByEvaluation(id)).length > 0,
  DysphagiaTest: async id => (await DysphagiaTestRepository.getDysphagiaByEvaluation(id)).length > 0,
  AshaScreening: async id => (await AshaMilestoneTestRepository.getAshaTestsByEvaluation(id)).length > 0,
};

/** Módulos del hub que ya se pueden leer como hechos. Nunca lanza. */
export async function loadDoneModules(evaluationId: number): Promise<Set<string>> {
  const done = new Set<string>();
  await Promise.all(
    Object.entries(READERS).map(async ([moduleId, read]) => {
      try {
        if (await read(evaluationId)) done.add(moduleId);
      } catch {
        // Lectura fallida: el módulo se queda sin marcar.
      }
    }),
  );
  return done;
}

/** Ids de módulo que este cargador sabe leer (para el test de cobertura). */
export const DONE_MODULE_IDS = Object.keys(READERS);
