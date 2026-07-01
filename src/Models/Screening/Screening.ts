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

export type ScreeningRiskLevel = 'low' | 'med' | 'high';

/** Un ítem marcado como respuesta de riesgo dentro del cribado. */
export interface ScreeningFlaggedItem {
  code: string; // 'P-07'
  label: string;
  answer: 'Sí' | 'No';
}

export interface ScreeningDTO {
  id: number;
  instrument: string; // 'autism-tea'
  score: number; // 0–20
  total: number; // 20
  riskLevel: ScreeningRiskLevel;
  rangeLabel: string; // 'Medio (3–7)'
  recommendation: string;
  answers: Record<number, boolean | null>;
  blockCounts: number[]; // respuestas de riesgo por bloque (4)
  flaggedItems: ScreeningFlaggedItem[];
  evaluatorName: string;
  evaluatorLicense: string;
  completedAt: string; // ISO string
  evaluationId: number;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

/**
 * Resultado de un cuestionario de cribado (de momento 'autism-tea' para autismo).
 * Entidad genérica por `instrument` para poder reutilizarla con otros cribados
 * (p. ej. un cribado de seguimiento) sin crear tablas nuevas.
 *
 * Los @Decorators cumplen 2 funciones (igual que el resto de modelos):
 *  - Definir la entidad/columnas para TypeORM.
 *  - Definir la transformación a DTO (toPlainOnly) y desde DTO (toClassOnly).
 */
@Entity('screening')
export class Screening {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  instrument: string;

  @Column({ type: 'integer' })
  score: number;

  @Column({ type: 'integer', default: 20 })
  total: number;

  @Column({ type: 'varchar' })
  riskLevel: ScreeningRiskLevel;

  @Column({ type: 'varchar' })
  rangeLabel: string;

  @Column({ type: 'varchar' })
  recommendation: string;

  @Column('simple-json')
  answers: Record<number, boolean | null>;

  @Column('simple-json')
  blockCounts: number[];

  @Column('simple-json')
  flaggedItems: ScreeningFlaggedItem[];

  @Column({ type: 'varchar' })
  evaluatorName: string;

  @Column({ type: 'varchar' })
  evaluatorLicense: string;

  @Column({ type: 'datetime' })
  @Transform(({ value }) => value?.toISOString(), { toPlainOnly: true })
  @Transform(({ value }) => (value ? new Date(value) : null), { toClassOnly: true })
  completedAt: Date;

  @ManyToOne(() => Evaluation, { eager: true })
  // Evita la referencia circular al convertir a DTO (igual que GameTest).
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
