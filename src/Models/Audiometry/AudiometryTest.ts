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

/** Umbrales por oído y frecuencia (Hz). `null` = no determinado. */
export interface AudiometryThresholds {
  OD: Record<number, number | null>;
  OI: Record<number, number | null>;
}

export interface AudiometryTestDTO {
  id: number;
  method: AudiometryMethod; // 'play' (juego de instrumentos) | 'conditioned' (tren / CRA)
  transducer: string; // 'air'
  thresholds: AudiometryThresholds;
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
