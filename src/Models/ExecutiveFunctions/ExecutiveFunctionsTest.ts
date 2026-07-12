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
import type {
  EfAgeBand,
  EfRawResults,
} from '@/Screens/ExecutiveFunctions/executiveFunctionsGame';

export interface ExecutiveFunctionsTestDTO {
  id: number;
  instrument: string; // 'Exploración lúdica de funciones ejecutivas'
  ageBand: EfAgeBand; // A | B | C | D (variante de dificultad usada)
  results: EfRawResults; // métricas brutas por mini-juego
  attentionScore: number | null; // 0–100 (null = juego no completado)
  inhibitionScore: number | null;
  flexibilityScore: number | null;
  workingMemoryScore: number | null;
  planningScore: number | null;
  overallScore: number | null; // media de los dominios completados
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
 * Resultado de la exploración lúdica de funciones ejecutivas: batería de 5
 * mini-juegos de tarjetas (atención, inhibición, flexibilidad, memoria de
 * trabajo y planificación) con dificultad graduada por banda de edad A–D.
 * Tabla dedicada `executive_functions_test` (mismo criterio que
 * `verbal_audiometry_test`: salida propia — puntuaciones 0–100 por dominio +
 * métricas brutas — que no encaja en tablas existentes).
 *
 * ⚠ Cribado orientativo con cortes provisionales: no es un instrumento
 * diagnóstico. Los @Decorators cumplen 2 funciones (igual que el resto de
 * modelos): entidad/columnas TypeORM + transformación a/desde DTO.
 */
@Entity('executive_functions_test')
export class ExecutiveFunctionsTest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', default: 'Exploración lúdica de funciones ejecutivas' })
  instrument: string;

  @Column({ type: 'varchar', default: 'A' })
  ageBand: EfAgeBand;

  @Column('simple-json')
  results: EfRawResults;

  /** Puntuaciones 0–100 por dominio; null = mini-juego no completado. */
  @Column({ type: 'integer', nullable: true })
  attentionScore: number | null;

  @Column({ type: 'integer', nullable: true })
  inhibitionScore: number | null;

  @Column({ type: 'integer', nullable: true })
  flexibilityScore: number | null;

  @Column({ type: 'integer', nullable: true })
  workingMemoryScore: number | null;

  @Column({ type: 'integer', nullable: true })
  planningScore: number | null;

  @Column({ type: 'integer', nullable: true })
  overallScore: number | null;

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
  // Evita la referencia circular al convertir a DTO (igual que GameTest / Screening).
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
