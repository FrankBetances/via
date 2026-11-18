import { ClinicalAssessmentRepository } from '@/Repositories/ClinicalAssessmentRepository';
import { ScreeningRepository } from '@/Repositories/ScreeningRepository';
import { AudiometryRepository } from '@/Repositories/AudiometryRepository';
import { VerbalAudiometryRepository } from '@/Repositories/VerbalAudiometryRepository';
import { VoiceAnalysisRepository } from '@/Repositories/VoiceAnalysisRepository';
import { ProsodyAnalysisRepository } from '@/Repositories/ProsodyAnalysisRepository';
import { ExecutiveFunctionsRepository } from '@/Repositories/ExecutiveFunctionsRepository';
import { DysphagiaTestRepository } from '@/Repositories/DysphagiaTestRepository';
import { SahsScreeningRepository } from '@/Repositories/SahsScreeningRepository';
import { ArticulationTestRepository } from '@/Repositories/ArticulationTestRepository';
import { AshaMilestoneTestRepository } from '@/Repositories/AshaMilestoneTestRepository';
import type { SessionEntities } from '@/PDF/nlgReportEngine';

/* -------------------------------------------------------------------------- */
/*  UNA lectura de la sesión (paquete A3 del plan, 18/11/2026).                */
/*                                                                             */
/*  El PDF leía cada repositorio dos veces —una para la síntesis y otra para   */
/*  las páginas de módulo— y Resultados finales otras dos. Cuatro lecturas de  */
/*  los mismos datos podían no coincidir, y lo que se firma es el PDF. Aquí se */
/*  leen una vez, todos o ninguno: si falla un módulo, falla la lectura entera */
/*  y quien llama lo dice (no se arma un informe con un módulo de menos).      */
/* -------------------------------------------------------------------------- */

export type SessionRead = Required<SessionEntities>;

export async function loadSessionEntities(evaluationId: number): Promise<SessionRead> {
  const [
    clinicalAssessments,
    screenings,
    audiometries,
    verbalAudiometries,
    voiceAnalyses,
    prosodyAnalyses,
    executiveFunctions,
    dysphagias,
    sahsScreenings,
    articulations,
    ashaTests,
  ] = await Promise.all([
    ClinicalAssessmentRepository.getClinicalAssessmentsByEvaluation(evaluationId),
    ScreeningRepository.getScreeningsByEvaluation(evaluationId),
    AudiometryRepository.getAudiometryByEvaluation(evaluationId),
    VerbalAudiometryRepository.getVerbalAudiometryByEvaluation(evaluationId),
    VoiceAnalysisRepository.getVoiceAnalysisByEvaluation(evaluationId),
    ProsodyAnalysisRepository.getProsodyAnalysisByEvaluation(evaluationId),
    ExecutiveFunctionsRepository.getExecutiveFunctionsByEvaluation(evaluationId),
    DysphagiaTestRepository.getDysphagiaByEvaluation(evaluationId),
    SahsScreeningRepository.getSahsScreeningsByEvaluation(evaluationId),
    ArticulationTestRepository.getArticulationByEvaluation(evaluationId),
    AshaMilestoneTestRepository.getAshaTestsByEvaluation(evaluationId),
  ]);
  return {
    clinicalAssessments,
    screenings,
    audiometries,
    verbalAudiometries,
    voiceAnalyses,
    prosodyAnalyses,
    executiveFunctions,
    dysphagias,
    sahsScreenings,
    articulations,
    ashaTests,
  };
}
