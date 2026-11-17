/* -------------------------------------------------------------------------- */
/*  Lista de entidades de VIA+: UNA sola fuente para la base real            */
/*  (`config.ts`) y para el banco de persistencia en memoria de los tests.    */
/* -------------------------------------------------------------------------- */

import { Professional } from '@/Models/Professional/Professional';
import { MedicalCenter } from '@/Models/MedicalCenter/MedicalCenter';
import { Media } from '@/Models/Media/Media';
import { Patient } from '@/Models/Patient/Patient';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { InformedConsent } from '@/Models/InformedConsent/InformedConsent';
import { GameTest } from '@/Models/GameTest/GameTest';
import { ClinicalAssessment } from '@/Models/ClinicalAssessment/ClinicalAssessment';
import { Screening } from '@/Models/Screening/Screening';
import { AudiometryTest } from '@/Models/Audiometry/AudiometryTest';
import { VoiceAnalysis } from '@/Models/VoiceAnalysis/VoiceAnalysis';
import { ProsodyAnalysis } from '@/Models/ProsodyAnalysis/ProsodyAnalysis';
import { DysphagiaTest } from '@/Models/DysphagiaTest/DysphagiaTest';
import { SahsScreening } from '@/Models/SahsScreening/SahsScreening';
import { ArticulationTest } from '@/Models/ArticulationTest/ArticulationTest';
import { VerbalAudiometryTest } from '@/Models/VerbalAudiometry/VerbalAudiometryTest';
import { ExecutiveFunctionsTest } from '@/Models/ExecutiveFunctions/ExecutiveFunctionsTest';
import { AshaMilestoneTest } from '@/Models/Asha/AshaMilestoneTest';
import { NlgReportSnapshot } from '@/Models/NlgReportSnapshot/NlgReportSnapshot';

export const ENTITIES = [
  // CORE ENTITIES
  Professional,
  MedicalCenter,
  Media,
  Patient,
  Evaluation,
  InformedConsent,
  GameTest,

  // MODULE ENTITIES
  ClinicalAssessment,
  Screening,
  AudiometryTest,
  VoiceAnalysis,
  ProsodyAnalysis,
  DysphagiaTest,
  SahsScreening,
  ArticulationTest,
  VerbalAudiometryTest,
  ExecutiveFunctionsTest,
  AshaMilestoneTest,
  // INFORME: lo que se firmó, tal cual (ver el modelo)
  NlgReportSnapshot,
];
