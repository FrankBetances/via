import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Exclude, Transform, Type } from 'class-transformer';
import { Patient } from '@/Models/Patient/Patient';
import { Professional } from '@/Models/Professional/Professional';

/* -------------------------------------------------------------------------- */
/*  Evaluation — sesión de evaluación clínica de un paciente. Es el ancla del  */
/*  flujo obligatorio: Consentimiento (bloqueante) -> CAP (bloqueante) ->      */
/*  batería de 9 módulos -> informe PDF. Cada módulo persiste su propio       */
/*  resultado referenciando esta evaluación (ver GameTest y modelos de        */
/*  módulo de fases posteriores).                                             */
/* -------------------------------------------------------------------------- */

export type EvaluationStatus = 'in_progress' | 'completed' | 'cancelled';

export interface EvaluationDTO {
  id: number;
  patientId: number;
  professionalId: number;
  status: EvaluationStatus;
  consentSignedAt: string | null;
  capApproved: boolean;
  capNotes: string | null;
  startedAt: string;
  completedAt: string | null;
}

@Entity('evaluation')
export class Evaluation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Patient, { eager: true })
  @Exclude({ toPlainOnly: true })
  @Type(() => Patient)
  patient: Patient;

  @ManyToOne(() => Professional, { eager: true })
  @Exclude({ toPlainOnly: true })
  @Type(() => Professional)
  professional: Professional;

  @Column({ type: 'varchar', default: 'in_progress' })
  status: EvaluationStatus;

  /** Firma digital del tutor legal — paso BLOQUEANTE previo a la batería. */
  @Column({ type: 'datetime', nullable: true })
  @Transform(({ value }) => value?.toISOString(), { toPlainOnly: true })
  @Transform(({ value }) => (value ? new Date(value) : null), { toClassOnly: true })
  consentSignedAt: Date | null;

  /** Resultado del Certificado de Aptitud para la Prueba (CAP) — BLOQUEANTE. */
  @Column({ type: 'boolean', default: false })
  capApproved: boolean;

  @Column({ type: 'text', nullable: true })
  capNotes: string | null;

  @CreateDateColumn()
  @Transform(({ value }) => value?.toISOString(), { toPlainOnly: true })
  @Transform(({ value }) => (value ? new Date(value) : null), { toClassOnly: true })
  startedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  @Transform(({ value }) => value?.toISOString(), { toPlainOnly: true })
  @Transform(({ value }) => (value ? new Date(value) : null), { toClassOnly: true })
  completedAt: Date | null;
}
