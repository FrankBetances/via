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
  AgeBand,
  CardModality,
  LevelScore,
  VerbalMode,
  VerbalResults,
} from '@/Screens/VerbalAudiometry/verbalAudiometryResult';

export interface VerbalAudiometryTestDTO {
  id: number;
  instrument: string; // 'Audiometría verbal (campo libre)'
  transducer: string; // siempre 'soundfield' (altavoz, sin audífonos)
  ageBand: AgeBand; // A | B | C | D (lista de estímulos usada)
  modality: CardModality; // images | mixed | words
  mode: VerbalMode; // discrimination | threshold
  results: VerbalResults; // { `${itemId}@${level}`: VerbalItemResult }
  levelScores: LevelScore[]; // % por nivel presentado (orden descendente)
  srtDb: number | null; // URV estimado (solo modo umbral)
  presentedCount: number;
  correctCount: number;
  discriminationPct: number; // % al nivel principal (voz conversacional)
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
 * Resultado de una audiometría verbal en campo libre: logoaudiometría de
 * reconocimiento de conjunto cerrado por selección de tarjetas (WordCard),
 * presentada por el altavoz del dispositivo (binaural, sin audífonos), con
 * lista de estímulos por franja de edad. Tabla dedicada
 * `verbal_audiometry_test`.
 *
 * Se opta por una tabla propia (como `articulation_test` / `dysphagia_test`)
 * en lugar de reutilizar `audiometry_test`: la salida no son umbrales por
 * frecuencia sino un mapa de respuestas por ítem/nivel y porcentajes de
 * discriminación, que no encajan en `AudiometryThresholds`.
 *
 * Los @Decorators cumplen 2 funciones (igual que el resto de modelos):
 *  - Definir la entidad/columnas para TypeORM.
 *  - Definir la transformación a/desde DTO.
 */
@Entity('verbal_audiometry_test')
export class VerbalAudiometryTest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', default: 'Audiometría verbal (campo libre)' })
  instrument: string;

  @Column({ type: 'varchar', default: 'soundfield' })
  transducer: string;

  @Column({ type: 'varchar', default: 'A' })
  ageBand: AgeBand;

  @Column({ type: 'varchar', default: 'images' })
  modality: CardModality;

  @Column({ type: 'varchar', default: 'discrimination' })
  mode: VerbalMode;

  @Column('simple-json')
  results: VerbalResults;

  @Column('simple-json')
  levelScores: LevelScore[];

  @Column({ type: 'integer', nullable: true })
  srtDb: number | null;

  @Column({ type: 'integer', default: 0 })
  presentedCount: number;

  @Column({ type: 'integer', default: 0 })
  correctCount: number;

  @Column({ type: 'integer', default: 0 })
  discriminationPct: number;

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
