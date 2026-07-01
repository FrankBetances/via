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

export type ClinicalGlobalResult = 'FULL' | 'PARTIAL' | 'BLOCKED';
export type ClinicalDomainKind = 'pending' | 'ok' | 'warn' | 'block';

/** Una prueba/juego y si queda habilitado o bloqueado por el CAP. */
export interface ClinicalGameGate {
  code: string; // 'J01'
  title: string;
  active: boolean;
  reason: string; // 'Habilitado' o motivo de bloqueo
}

/** Estructura serializada de los 4 dominios evaluados. */
export interface ClinicalDomains {
  otoscopia: {
    od: string | null;
    oi: string | null;
    odNotes: string;
    oiNotes: string;
    notes: string;
    kind: ClinicalDomainKind;
  };
  visual: { answers: Record<string, boolean | null>; notes: string; kind: ClinicalDomainKind };
  verbal: { ageGroup: string; answers: Record<string, boolean | null>; notes: string; kind: ClinicalDomainKind };
  motor: { answers: Record<string, boolean | null>; notes: string; kind: ClinicalDomainKind };
}

export interface ClinicalAssessmentDTO {
  id: number;
  instrument: string; // 'CAP'
  globalResult: ClinicalGlobalResult;
  globalLabel: string; // 'APTO PARCIAL'
  activeGames: number;
  totalGames: number;
  domains: ClinicalDomains;
  games: ClinicalGameGate[];
  evaluatorName: string;
  evaluatorLicense: string;
  completedAt: string; // ISO string
  evaluationId: number;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

/**
 * Certificado de Aptitud para la Prueba (CAP). Resultado de la evaluación clínica
 * previa que certifica las condiciones mínimas de viabilidad en 4 dominios y deriva
 * qué pruebas quedan habilitadas en la sesión.
 *
 * Sigue el mismo patrón de entidad/DTO que `Screening` y `GameTest`:
 *  - Define la entidad/columnas para TypeORM.
 *  - Define la transformación a DTO (toPlainOnly) y desde DTO (toClassOnly).
 */
@Entity('clinical_assessment')
export class ClinicalAssessment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', default: 'CAP' })
  instrument: string;

  @Column({ type: 'varchar' })
  globalResult: ClinicalGlobalResult;

  @Column({ type: 'varchar' })
  globalLabel: string;

  @Column({ type: 'integer' })
  activeGames: number;

  @Column({ type: 'integer', default: 5 })
  totalGames: number;

  @Column('simple-json')
  domains: ClinicalDomains;

  @Column('simple-json')
  games: ClinicalGameGate[];

  @Column({ type: 'varchar' })
  evaluatorName: string;

  @Column({ type: 'varchar' })
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
