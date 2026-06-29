import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { Professional } from '@/Models/Professional/Professional';
import { MedicalCenter } from '@/Models/MedicalCenter/MedicalCenter';
import { Media } from '@/Models/Media/Media';
import { Patient } from '@/Models/Patient/Patient';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { GameTest } from '@/Models/GameTest/GameTest';
import { ClinicalAssessment } from '@/Models/ClinicalAssessment/ClinicalAssessment';
import { Screening } from '@/Models/Screening/Screening';
import { AudiometryTest } from '@/Models/Audiometry/AudiometryTest';
import { VoiceAnalysis } from '@/Models/VoiceAnalysis/VoiceAnalysis';
import { DysphagiaTest } from '@/Models/DysphagiaTest/DysphagiaTest';
import { SahsScreening } from '@/Models/SahsScreening/SahsScreening';
import { ArticulationTest } from '@/Models/ArticulationTest/ArticulationTest';

/* -------------------------------------------------------------------------- */
/*  TypeORM DataSource — VIA+ (offline-first, SQLite local).                  */
/*                                                                            */
/*  Driver: TypeORM no publica un driver dedicado para                       */
/*  `react-native-nitro-sqlite` (no existe paquete `typeorm-nitro-sqlite-     */
/*  driver` en npm a fecha de esta fase). Se usa el driver `react-native`      */
/*  incorporado de TypeORM, que requiere inyectar un `driver` compatible con  */
/*  la API de `react-native-sqlite-storage` vía `location`. Mientras no se    */
/*  implemente/parchee un driver TypeORM <-> nitro-sqlite, este es el modo    */
/*  más estable para Fase 1. Reevaluar en una fase posterior si Margelo       */
/*  publica soporte oficial de TypeORM.                                      */
/* -------------------------------------------------------------------------- */

export const AppDataSource = new DataSource({
  type: 'react-native',
  database: 'viaplus.db',
  location: 'default',
  synchronize: true,
  logging: false,
  entities: [
    // CORE ENTITIES
    Professional,
    MedicalCenter,
    Media,
    Patient,
    Evaluation,
    GameTest,

    // MODULE ENTITIES
    ClinicalAssessment,
    Screening,
    AudiometryTest,
    VoiceAnalysis,
    DysphagiaTest,
    SahsScreening,
    ArticulationTest,
  ],
  migrations: [],
  subscribers: [],
});

let initialized = false;

/**
 * Inicializa el DataSource de TypeORM. Idempotente: llamadas repetidas
 * devuelven la misma instancia ya inicializada sin relanzar `initialize()`.
 */
export async function initDatabase(): Promise<DataSource> {
  if (!initialized || !AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    initialized = true;
  }
  return AppDataSource;
}
