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
  email: string | null;
  centerId: number | null;
  createdAt: string;
}

@Entity('professional')
export class Professional {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  fullName: string;

  @Column({ type: 'varchar', default: '' })
  licenseNumber: string;

  @Column({ type: 'varchar', default: 'medico' })
  role: ProfessionalRole;

  /** Opcional: el acceso es por selección de perfil en el dispositivo, no por email. */
  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'varchar', default: '' })
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
