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

export type VoiceParamStatus = 'normal' | 'borderline' | 'altered';
export type VoiceSource = 'mic' | 'demo';
export type VoiceQuality = 'low' | 'med' | 'high';

export interface VoiceFormants {
  f1: number;
  f2: number;
  f3: number;
}

/**
 * Valoración perceptual GRBAS de la disfonia (Hirano, 1981). Cada dimensión
 * se puntúa 0 (normal) – 3 (severo): G = grado global, R = aspereza,
 * B = soplo, A = astenia, S = tensión.
 */
export interface GrbasScores {
  g: number;
  r: number;
  b: number;
  a: number;
  s: number;
}

export interface VoiceAnalysisDTO {
  id: number;
  vowel: string; // 'a'
  source: VoiceSource;
  durationSec: number;
  quality: VoiceQuality;
  f0: number; // Hz
  jitter: number; // %
  shimmer: number; // %
  hnr: number; // dB
  formants: VoiceFormants; // Hz
  grbas: GrbasScores | null; // valoración perceptual (null = no realizada)
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
 * Resultado de un análisis acústico de voz (espectrografía vocal).
 * Tabla dedicada `voice_analysis`. Los @Decorators cumplen 2 funciones (igual
 * que Screening / GameTest):
 *  - Definir la entidad/columnas para TypeORM.
 *  - Definir la transformación a DTO (toPlainOnly) y desde DTO (toClassOnly).
 */
@Entity('voice_analysis')
export class VoiceAnalysis {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', default: 'a' })
  vowel: string;

  @Column({ type: 'varchar', default: 'demo' })
  source: VoiceSource;

  @Column({ type: 'float', default: 5 })
  durationSec: number;

  @Column({ type: 'varchar', default: 'med' })
  quality: VoiceQuality;

  @Column({ type: 'float' })
  f0: number;

  @Column({ type: 'float' })
  jitter: number;

  @Column({ type: 'float' })
  shimmer: number;

  @Column({ type: 'float' })
  hnr: number;

  @Column('simple-json')
  formants: VoiceFormants;

  @Column({ type: 'simple-json', nullable: true })
  grbas: GrbasScores | null;

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
