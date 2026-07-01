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

/** Veredicto global de la exploración MECV-V. */
export type DysphagiaVerdict = 'safe' | 'efficacy' | 'safety';
//  safe     = exploración negativa (sin alteración)
//  efficacy = alteración de la eficacia (sin riesgo de seguridad)
//  safety   = alteración de la seguridad (riesgo de aspiración)

/** Procedencia de la lectura de SpO₂. */
export type Spo2Source = 'ble' | 'demo' | 'manual';

export type BolusViscosity = 'nectar' | 'liquido' | 'pudin';

/** Registro de un bolo evaluado (uno de los 9 del protocolo MECV-V). */
export interface BolusRecord {
  id: number; // 1..9
  viscosity: BolusViscosity;
  volume: number; // mL (5 / 10 / 20)
  evaluated: boolean;
  skipped: boolean;
  spo2: number | null; // SpO₂ post-deglución
  safety: { tos: boolean; cambio_voz: boolean }; // desat se deriva de spo2 vs basal
  efficacy: { sello_labial: boolean; residuo: boolean; deglucion_fraccionada: boolean };
}

export interface DysphagiaTestDTO {
  id: number;
  basalSpO2: number;
  spo2Source: Spo2Source;
  bolus: BolusRecord[];
  safetyAltered: boolean;
  efficacyAltered: boolean;
  minSpO2: number | null;
  maxDrop: number | null;
  recommendation: string; // dieta recomendada (texto)
  verdict: DysphagiaVerdict;
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
 * Resultado de una exploración de disfagia orofaríngea por el método
 * Volumen-Viscosidad (MECV-V). Tabla dedicada `dysphagia_test`.
 *
 * Los @Decorators cumplen 2 funciones (igual que AudiometryTest / Screening):
 *  - Definir la entidad/columnas para TypeORM.
 *  - Definir la transformación a/desde DTO.
 */
@Entity('dysphagia_test')
export class DysphagiaTest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer', default: 98 })
  basalSpO2: number;

  @Column({ type: 'varchar', default: 'manual' })
  spo2Source: Spo2Source;

  @Column('simple-json')
  bolus: BolusRecord[];

  @Column({ type: 'boolean', default: false })
  safetyAltered: boolean;

  @Column({ type: 'boolean', default: false })
  efficacyAltered: boolean;

  @Column({ type: 'integer', nullable: true })
  minSpO2: number | null;

  @Column({ type: 'integer', nullable: true })
  maxDrop: number | null;

  @Column({ type: 'varchar', default: '' })
  recommendation: string;

  @Column({ type: 'varchar', default: 'safe' })
  verdict: DysphagiaVerdict;

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
