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

/** Método/condicionamiento de la audiometría tonal (mismo modelo de datos). */
export type AudiometryMethod = 'play' | 'conditioned';
export type Ear = 'OD' | 'OI';

/** Vía de presentación: 'air' (auriculares) | 'soundfield' (campo libre). */
export type AudiometryTransducer = 'air' | 'soundfield';

/**
 * Umbrales por canal y frecuencia (Hz). `null` = no determinado.
 * `CL` (campo libre) se usa en el cribado sin discriminación de oído: estima
 * la audición binaural (mejor oído) con el altavoz del dispositivo.
 */
export interface AudiometryThresholds {
  OD: Record<number, number | null>;
  OI: Record<number, number | null>;
  CL?: Record<number, number | null>;
}

/**
 * Frecuencias en las que el niño NO respondió al nivel máximo de salida, por
 * canal. Distingue «sin respuesta» de «no medido», que en `thresholds` son el
 * mismo `null`. `null` en la columna = registro anterior al 2/11/2026, que no
 * guardaba la distinción: el informe lo dice y no afirma ninguna de las dos.
 */
export type AudiometryNoResponse = Partial<Record<'OD' | 'OI' | 'CL', number[]>>;

export interface AudiometryTestDTO {
  id: number;
  method: AudiometryMethod; // 'play' (juego de instrumentos) | 'conditioned' (tren / CRA)
  transducer: string; // 'air' | 'soundfield'
  thresholds: AudiometryThresholds;
  noResponseAtMax: AudiometryNoResponse | null;
  ptaOD: number | null;
  ptaOI: number | null;
  reliability: number | null; // %
  interpretation: string;
  notes: string;
  evaluatorName: string;
  evaluatorLicense: string;
  completedAt: string; // ISO
  evaluationId: number;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

/**
 * Resultado de una audiometría tonal infantil (umbrales por vía aérea).
 * Tabla dedicada `audiometry_test`, compartida por las dos pantallas
 * (Audiometría Infantil = `play`, Audiometría Condicionada / Tren = `conditioned`),
 * diferenciadas por la columna `method`.
 *
 * Los @Decorators cumplen 2 funciones (igual que Screening / GameTest):
 *  - Definir la entidad/columnas para TypeORM.
 *  - Definir la transformación a/desde DTO.
 */
@Entity('audiometry_test')
export class AudiometryTest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', default: 'play' })
  method: AudiometryMethod;

  @Column({ type: 'varchar', default: 'air' })
  transducer: string;

  @Column('simple-json')
  thresholds: AudiometryThresholds;

  @Column({ type: 'simple-json', nullable: true })
  noResponseAtMax: AudiometryNoResponse | null;

  @Column({ type: 'integer', nullable: true })
  ptaOD: number | null;

  @Column({ type: 'integer', nullable: true })
  ptaOI: number | null;

  @Column({ type: 'integer', nullable: true })
  reliability: number | null;

  @Column({ type: 'varchar', default: '' })
  interpretation: string;

  @Column({ type: 'varchar', default: '' })
  notes: string;

  @Column({ type: 'varchar', default: '' })
  evaluatorName: string;

  @Column({ type: 'varchar', default: '' })
  evaluatorLicense: string;

  @Column({ type: 'datetime' })
  @Transform(({ value }) => value?.toISOString(), { toPlainOnly: true })
  @Transform(({ value }) => (value ? new Date(value) : null), { toClassOnly: true })
  completedAt: Date;

  @ManyToOne(() => Evaluation, { eager: true })
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
