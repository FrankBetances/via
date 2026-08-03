import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { Exclude, Transform, Type } from 'class-transformer';
import type { ProsodyReason } from '@/Screens/ProsodyAnalysis/prosodyDsp';

/* -------------------------------------------------------------------------- */
/*  Entidad del análisis prosódico.                                            */
/*                                                                            */
/*  ZERO-PHI: guarda MÉTRICAS. Nunca audio, nunca transcripción, nunca los     */
/*  contornos de F0 e intensidad. Los contornos existen en memoria mientras la */
/*  pantalla los dibuja y mueren con ella: son una serie temporal de la voz    */
/*  del menor y no aportan nada al informe que no aporte ya el resumen.        */
/* -------------------------------------------------------------------------- */

/**
 * Tarea de habla conectada con la que se obtuvo la muestra (decisión B0.1, ver
 * `docs/design/b0-prosodia-tarea-y-afirmaciones.md`).
 *
 * SE GUARDA CON CADA TOMA, y no es un adorno documental: la tasa de habla
 * depende fuertemente de la tarea —el habla automática y la repetición son más
 * rápidas que la imitada, y la generación de historia más lenta que la
 * narración espontánea—, así que dos tomas de tareas distintas NO son
 * comparables. Sin este campo, el seguimiento intrasujeto (la única comparación
 * que B0.2 permite) podría cruzar tareas sin que nadie se diera cuenta.
 */
export type ProsodyTask = 'narracion-lamina' | 'recuento-historia' | 'lectura';

/** Banda de edad de la tarea. Determina la lámina y la consigna. */
export type ProsodyAgeBand = 'prelector' | 'lector';

/**
 * Métricas prosódicas persistidas. Reflejo de `ProsodyMetrics` del DSP, con la
 * MISMA regla: `null` significa «no medido», nunca «cero». Un recuento de
 * pausas 0 y uno `null` son clínicamente lo contrario, y confundirlos en el
 * informe sería el peor modo de fallo posible.
 *
 * Se guarda como `simple-json` en una sola columna en lugar de quince columnas
 * sueltas: el conjunto se escribe y se lee siempre entero, y así añadir una
 * métrica en el futuro no obliga a migrar el esquema.
 */
export interface ProsodyMetricsRecord {
  durationSec: number;
  spanSec: number | null;
  phonationTimeSec: number | null;
  voicedFraction: number | null;

  pauseCount: number | null;
  pauseTotalSec: number | null;
  pauseMeanSec: number | null;

  syllableCount: number | null;
  speechRateSps: number | null;
  articulationRateSps: number | null;

  f0MedianHz: number | null;
  f0RangeSt: number | null;
  f0SdSt: number | null;
  finalContourSt: number | null;

  intensitySdDb: number | null;
}

export interface ProsodyNotes {
  /** Observación clínica libre sobre la muestra (colaboración, fatiga, etc.). */
  obs: string;
}

export interface ProsodyAnalysisDTO {
  id: number;
  task: ProsodyTask;
  ageBand: ProsodyAgeBand;
  /** Identificador de la lámina o texto usado (trazabilidad del estímulo). */
  stimulusId: string;
  /** Lengua de la sesión en que se tomó la muestra (BCP-47). */
  language: string;
  metrics: ProsodyMetricsRecord;
  /** Por qué el análisis no dio métricas, cuando no las dio. */
  reason: ProsodyReason;
  interpretation: string;
  notes: ProsodyNotes;
  evaluatorName: string;
  evaluatorLicense: string;
  evaluatorSignatureSvg: string | null;
  completedAt: string; // ISO
  evaluationId: number;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

/**
 * Resultado de un análisis prosódico sobre habla conectada. Tabla dedicada
 * `prosody_analysis`, como `voice_analysis` / `articulation_test`.
 *
 * Los @Decorators cumplen 2 funciones (igual que el resto de modelos):
 *  - Definir la entidad/columnas para TypeORM.
 *  - Definir la transformación a DTO (toPlainOnly) y desde DTO (toClassOnly).
 */
@Entity('prosody_analysis')
export class ProsodyAnalysis {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', default: 'narracion-lamina' })
  task: ProsodyTask;

  @Column({ type: 'varchar', default: 'prelector' })
  ageBand: ProsodyAgeBand;

  @Column({ type: 'varchar', default: '' })
  stimulusId: string;

  @Column({ type: 'varchar', default: 'es' })
  language: string;

  @Column('simple-json')
  metrics: ProsodyMetricsRecord;

  /** `'ok'` cuando el análisis fue posible. El resto de valores explican POR QUÉ
   *  no lo fue (toma vacía, en silencio, demasiado corta, sin sonoridad), para
   *  que la pantalla y el informe puedan decirlo en vez de un «no disponible»
   *  genérico. */
  @Column({ type: 'varchar', default: 'ok' })
  reason: ProsodyReason;

  @Column({ type: 'varchar', default: '' })
  interpretation: string;

  @Column('simple-json')
  notes: ProsodyNotes;

  @Column({ type: 'varchar', default: '' })
  evaluatorName: string;

  @Column({ type: 'varchar', default: '' })
  evaluatorLicense: string;

  /** Trazo de la firma del explorador como path SVG (null = sin firma). */
  @Column({ type: 'text', nullable: true })
  evaluatorSignatureSvg: string | null;

  @Column({ type: 'datetime' })
  @Transform(({ value }) => value?.toISOString(), { toPlainOnly: true })
  @Transform(({ value }) => (value ? new Date(value) : null), { toClassOnly: true })
  completedAt: Date;

  @ManyToOne(() => Evaluation, { eager: true })
  // Evita la referencia circular al convertir a DTO (igual que el resto).
  @Exclude({ toPlainOnly: true })
  @Type(() => Evaluation)
  evaluation: Evaluation;

  @CreateDateColumn()
  @Transform(({ value }) => value?.toISOString(), { toPlainOnly: true })
  @Transform(({ value }) => (value ? new Date(value) : null), { toClassOnly: true })
  createdAt: Date;

  @UpdateDateColumn()
  @Transform(({ value }) => value?.toISOString(), { toPlainOnly: true })
  @Transform(({ value }) => (value ? new Date(value) : null), { toClassOnly: true })
  updatedAt: Date;
}
