import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Exclude, Transform } from 'class-transformer';

/* -------------------------------------------------------------------------- */
/*  Professional — profesional sanitario autenticado (médico, logopeda,       */
/*  psicopedagogo, enfermero). RBAC por `role` (ver README §Privacidad).      */
/* -------------------------------------------------------------------------- */

export type ProfessionalRole = 'medico' | 'logopeda' | 'psicopedagogo' | 'enfermero';

export interface ProfessionalDTO {
  id: number;
  fullName: string;
  licenseNumber: string;
  role: ProfessionalRole;
  email: string;
  centerId: number | null;
  createdAt: string;
}

@Entity('professional')
export class Professional {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  fullName: string;

  @Column({ default: '' })
  licenseNumber: string;

  @Column({ type: 'varchar', default: 'medico' })
  role: ProfessionalRole;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude({ toPlainOnly: true })
  passwordHash: string;

  @Column({ type: 'int', nullable: true })
  centerId: number | null;

  @CreateDateColumn()
  @Transform(({ value }) => value?.toISOString(), { toPlainOnly: true })
  @Transform(({ value }) => (value ? new Date(value) : null), { toClassOnly: true })
  createdAt: Date;

  /** Alias de lectura sobre `fullName` para las pantallas que esperan `name`. */
  get name(): string {
    return this.fullName;
  }
}
