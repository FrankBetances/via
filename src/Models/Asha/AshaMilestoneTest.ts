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

export type AshaRiskLevel = 'green' | 'yellow' | 'red';

export interface AshaMilestoneTestDTO {
  id: string;
  ageBand: string;
  responses: Record<string, boolean>;
  riskLevel: AshaRiskLevel;
  recommendedReferrals: string[];
  failedDomains: string[];
  evaluatorName: string;
  evaluatorLicense: string;
  notes?: string;
  completedAt: string; // ISO string
  evaluationId?: number;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

/**
 * Entidad TypeORM para el Cribado de Hitos del Desarrollo del Lenguaje y la
 * Comunicación (ASHA - American Speech-Language-Hearing Association).
 *
 * Registra las respuestas dicotómicas por hito, la banda de edad evaluada,
 * los dominios comprometidos y las recomendaciones de derivación clínica
 * generadas por el motor determinista CDSS (IEC 62304 Clase B).
 */
@Entity('asha_milestone_test')
export class AshaMilestoneTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32 })
  ageBand: string;

  /** Mapa hitoId -> cumplido (true = cumple, false = no cumple / retraso) */
  @Column('simple-json')
  responses: Record<string, boolean>;

  @Column({ type: 'varchar', length: 16, default: 'green' })
  riskLevel: AshaRiskLevel;

  @Column('simple-json')
  recommendedReferrals: string[];

  @Column('simple-json')
  failedDomains: string[];

  @Column({ type: 'varchar', nullable: true })
  evaluatorName: string;

  @Column({ type: 'varchar', nullable: true })
  evaluatorLicense: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  /** Momento en que el clínico cerró el cribado. Es la fecha que sale en el
   *  informe, como en el resto de módulos (`ArticulationTest`, `Screening`…):
   *  `createdAt` es de la fila, no de la exploración. */
  @Column({ type: 'datetime' })
  @Transform(({ value }) => value?.toISOString(), { toPlainOnly: true })
  @Transform(({ value }) => (value ? new Date(value) : null), { toClassOnly: true })
  completedAt: Date;

  @ManyToOne(() => Evaluation, { eager: true, nullable: true })
  @Exclude({ toPlainOnly: true })
  @Type(() => Evaluation)
  evaluation: Evaluation;

  /** Alias para compatibilidad de nomenclatura clínica (Evaluation/Session) */
  get session(): Evaluation {
    return this.evaluation;
  }
  set session(evalInstance: Evaluation) {
    this.evaluation = evalInstance;
  }

  @CreateDateColumn()
  @Transform(({ value }) => value?.toISOString(), { toPlainOnly: true })
  @Transform(({ value }) => (value ? new Date(value) : null), { toClassOnly: true })
  createdAt: Date;

  @UpdateDateColumn()
  @Transform(({ value }) => value?.toISOString(), { toPlainOnly: true })
  @Transform(({ value }) => (value ? new Date(value) : null), { toClassOnly: true })
  updatedAt: Date;
}
