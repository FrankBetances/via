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

  @Column({ default: 'a' })
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

  @Column({ default: '' })
  interpretation: string;

  @Column({ default: '' })
  notes: string;

  @Column({ default: '' })
  evaluatorName: string;

  @Column({ default: '' })
  evaluatorLicense: string;

  @Column()
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
