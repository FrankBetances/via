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
  ImcCategory,
  PsqAnswers,
  SahsScoreBreakdown,
  SahsSuspicion,
} from '@/Screens/SahsScreening/sahsScreeningResult';

export interface SahsNotes {
  psqObs: string;
  examObs: string;
  riskObs: string;
}

export interface SahsScreeningDTO {
  id: number;
  instrument: string; // 'PSQ-Chervin / SAHS'
  psqAnswers: PsqAnswers;
  psqYesCount: number;
  psqTotal: number; // 22
  psqPositive: boolean;
  redFlag: boolean; // apnea presenciada referida
  brodsky: number | null; // 0..4
  imc: ImcCategory | null;
  signs: string[]; // signos exploratorios presentes
  riskFactors: string[]; // factores de riesgo marcados
  breakdown: SahsScoreBreakdown; // puntos por dominio
  totalScore: number;
  scoreMax: number; // 13
  suspicionLevel: SahsSuspicion; // 'low' | 'med' | 'high'
  suspicionLabel: string; // 'Sospecha alta'
  recommendation: string;
  referral: string; // 'PSG · ORL'
  notes: SahsNotes;
  evaluatorName: string;
  evaluatorLicense: string;
  completedAt: string; // ISO
  evaluationId: number;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

/**
 * Resultado de un cribado de SAHS infantil (trastornos respiratorios del sueño)
 * por el cuestionario PSQ de Chervin + exploración física (Brodsky, IMC) +
 * factores de riesgo. Tabla dedicada `sahs_screening`.
 *
 * Se opta por una tabla propia (como `dysphagia_test`) en lugar de la genérica
 * `screening`, porque el módulo captura datos estructurados de 3 dominios y un
 * desglose de puntuación que no encajan en el modelo plano de `Screening`.
 *
 * Los @Decorators cumplen 2 funciones (igual que el resto de modelos):
 *  - Definir la entidad/columnas para TypeORM.
 *  - Definir la transformación a/desde DTO.
 */
@Entity('sahs_screening')
export class SahsScreening {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', default: 'PSQ-Chervin / SAHS' })
  instrument: string;

  @Column('simple-json')
  psqAnswers: PsqAnswers;

  @Column({ type: 'integer', default: 0 })
  psqYesCount: number;

  @Column({ type: 'integer', default: 22 })
  psqTotal: number;

  @Column({ type: 'boolean', default: false })
  psqPositive: boolean;

  @Column({ type: 'boolean', default: false })
  redFlag: boolean;

  @Column({ type: 'integer', nullable: true })
  brodsky: number | null;

  @Column({ type: 'varchar', nullable: true })
  imc: ImcCategory | null;

  @Column('simple-json')
  signs: string[];

  @Column('simple-json')
  riskFactors: string[];

  @Column('simple-json')
  breakdown: SahsScoreBreakdown;

  @Column({ type: 'integer', default: 0 })
  totalScore: number;

  @Column({ type: 'integer', default: 13 })
  scoreMax: number;

  @Column({ type: 'varchar' })
  suspicionLevel: SahsSuspicion;

  @Column({ type: 'varchar', default: '' })
  suspicionLabel: string;

  @Column({ type: 'varchar', default: '' })
  recommendation: string;

  @Column({ type: 'varchar', default: '' })
  referral: string;

  @Column('simple-json')
  notes: SahsNotes;

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
