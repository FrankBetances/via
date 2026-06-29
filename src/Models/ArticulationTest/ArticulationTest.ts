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
  AffectedPhoneme,
  PhonemeStatus,
  SodaCode,
  SodaResults,
  Substitutions,
} from '@/Screens/Articulation/articulationResult';

export interface ArticulationNotes {
  /** Observación clínica libre del profesional sobre la producción a la repetición. */
  obs: string;
}

export interface ArticulationTestDTO {
  id: number;
  instrument: string; // 'T.A.R. (Articulación a la Repetición)'
  results: SodaResults; // { [itemId]: 'C'|'S'|'O'|'D'|'A'|null }
  substitutions: Substitutions; // { [itemId]: 'transcripción de la sustitución' }
  evaluatedCount: number;
  totalCount: number;
  correctPct: number; // 0..100
  sodaCounts: Record<SodaCode, number>; // recuento por categoría SODA
  affectedPhonemes: AffectedPhoneme[]; // fonemas a intervenir
  phonemeStatus: PhonemeStatus[]; // estado por fonema consonántico (mapa de inventario)
  notes: ArticulationNotes;
  evaluatorName: string;
  evaluatorLicense: string;
  completedAt: string; // ISO
  evaluationId: number;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

/**
 * Resultado de un Test de Articulación a la Repetición (T.A.R.): registro
 * descriptivo SODA (Correcto / Sustitución / Omisión / Distorsión / Adición) de
 * la producción del niño/a sobre un inventario fonético por punto de
 * articulación + dífonos, polisílabas y frases. Tabla dedicada `articulation_test`.
 *
 * Se opta por una tabla propia (como `dysphagia_test` / `sahs_screening`) en
 * lugar de la genérica `screening`, porque el módulo captura un mapa de
 * resultados por ítem y un desglose por fonema que no encajan en el modelo
 * plano de `Screening`.
 *
 * Los @Decorators cumplen 2 funciones (igual que el resto de modelos):
 *  - Definir la entidad/columnas para TypeORM.
 *  - Definir la transformación a/desde DTO.
 */
@Entity('articulation_test')
export class ArticulationTest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: 'T.A.R. (Articulación a la Repetición)' })
  instrument: string;

  @Column('simple-json')
  results: SodaResults;

  @Column('simple-json')
  substitutions: Substitutions;

  @Column({ type: 'integer', default: 0 })
  evaluatedCount: number;

  @Column({ type: 'integer', default: 0 })
  totalCount: number;

  @Column({ type: 'integer', default: 0 })
  correctPct: number;

  @Column('simple-json')
  sodaCounts: Record<SodaCode, number>;

  @Column('simple-json')
  affectedPhonemes: AffectedPhoneme[];

  @Column('simple-json')
  phonemeStatus: PhonemeStatus[];

  @Column('simple-json')
  notes: ArticulationNotes;

  @Column({ default: '' })
  evaluatorName: string;

  @Column({ default: '' })
  evaluatorLicense: string;

  @Column()
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
