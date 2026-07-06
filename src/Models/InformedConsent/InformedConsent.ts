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

/**
 * Quién firma el consentimiento informado:
 *  - 'patient'  → el propio paciente (mayor de edad con capacidad).
 *  - 'guardian' → padre/madre/tutor legal (paciente menor de edad).
 *  - 'family'   → familiar/representante de un adulto que no puede firmar
 *                 (trastorno neurodegenerativo, incapacidad…); requiere motivo.
 */
export type ConsentSignerType = 'patient' | 'guardian' | 'family';

export interface InformedConsentDTO {
  id: number;
  consentVersion: string;
  signerType: ConsentSignerType;
  signerName: string;
  signerRelation: string;
  incapacityReason: string | null;
  patientIsMinor: boolean;
  signatureSvg: string | null;
  signedAt: string; // ISO
  evaluationId: number;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

/**
 * Consentimiento informado firmado antes de iniciar la batería de pruebas.
 * Es el primer paso BLOQUEANTE del flujo (ver `Evaluation`): registro del
 * paciente → consentimiento → CAP → sala → pruebas.
 *
 * Tabla DEDICADA (`informed_consent`) en lugar de columnas nuevas sobre
 * `evaluation`: con `synchronize: true` crear una tabla nueva es el cambio de
 * esquema más seguro (no fuerza el rebuild de tablas con datos existentes).
 * `Evaluation.consentSignedAt` (que ya existía en el esquema) se actualiza a
 * la vez como marca rápida para las comprobaciones de flujo.
 *
 * Mismo patrón entidad/DTO que `ClinicalAssessment` / `Screening`.
 */
@Entity('informed_consent')
export class InformedConsent {
  @PrimaryGeneratedColumn()
  id: number;

  /** Versión del texto de consentimiento mostrado (trazabilidad legal). */
  @Column({ type: 'varchar', default: '1.0' })
  consentVersion: string;

  @Column({ type: 'varchar' })
  signerType: ConsentSignerType;

  /** Nombre y apellidos de quien firma. */
  @Column({ type: 'varchar' })
  signerName: string;

  /** Relación con el paciente: Madre, Padre, Tutor legal, Familiar… ('' si firma el paciente). */
  @Column({ type: 'varchar', default: '' })
  signerRelation: string;

  /** Motivo por el que el adulto no firma por sí mismo (solo signerType 'family'). */
  @Column({ type: 'text', nullable: true })
  incapacityReason: string | null;

  /** Si el paciente era menor de edad en el momento de la firma. */
  @Column({ type: 'boolean', default: false })
  patientIsMinor: boolean;

  /** Trazo de la firma manuscrita como path SVG (null = sin trazo capturado). */
  @Column({ type: 'text', nullable: true })
  signatureSvg: string | null;

  @Column({ type: 'datetime' })
  @Transform(({ value }) => value?.toISOString(), { toPlainOnly: true })
  @Transform(({ value }) => (value ? new Date(value) : null), { toClassOnly: true })
  signedAt: Date;

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
