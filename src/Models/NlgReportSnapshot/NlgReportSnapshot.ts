import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/* -------------------------------------------------------------------------- */
/*  Instantánea de la síntesis NLG que acompañó a un PDF.                      */
/*                                                                            */
/*  La síntesis se calcula al vuelo a partir de las entidades: si cambia una  */
/*  regla, una plantilla o un umbral, el mismo informe regenerado mañana dice */
/*  otra cosa. Y las observaciones y la firma del profesional no se guardaban */
/*  en ningún sitio («si la app se cierra, el texto libre se pierde»). Esta   */
/*  tabla deja constancia de LO QUE SE FIRMÓ: texto exacto, reglas, versión   */
/*  de la matriz, lengua, notas y firma. Solo se inserta; no se actualiza.    */
/* -------------------------------------------------------------------------- */

export interface NlgSnapshotFact {
  ruleId: string;
  level: string;
  text: string;
  measured: Record<string, string | number | boolean | null>;
}

@Entity('nlg_report_snapshot')
export class NlgReportSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  /** Sin relación eager: la instantánea no debe cargar ni reescribir la evaluación. */
  @Column({ type: 'integer' })
  evaluationId: number;

  /** Versión de la matriz de evidencia (`nlg.audit.evidenceVersion`). */
  @Column({ type: 'varchar' })
  evidenceVersion: string;

  @Column({ type: 'varchar' })
  lang: string;

  /** `ok` · `catalog-missing` · `read-failed`: una síntesis ausente también se archiva. */
  @Column({ type: 'varchar', default: 'ok' })
  status: string;

  @Column('simple-json')
  ruleIds: string[];

  @Column('simple-json')
  facts: NlgSnapshotFact[];

  @Column({ type: 'text' })
  formattedReportText: string;

  @Column({ type: 'text', default: '' })
  clinicianNotes: string;

  @Column({ type: 'text', nullable: true })
  clinicianSignatureSvg: string | null;

  @Column({ type: 'varchar', default: '' })
  professionalName: string;

  @Column({ type: 'varchar', default: '' })
  professionalLicense: string;

  @CreateDateColumn()
  createdAt: Date;
}
