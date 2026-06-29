import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Transform } from 'class-transformer';

/* -------------------------------------------------------------------------- */
/*  Patient — paciente pediátrico, almacenado SEUDONIMIZADO (GDPR Art. 4(5)). */
/*  Los datos directamente identificativos (nombre, fecha de nacimiento)      */
/*  viajan cifrados (AES-256-GCM) en columnas *Enc; `idHash` es el HMAC-SHA256 */
/*  del NHC con la clave de dispositivo. Ver README §Privacidad y Datos.      */
/*                                                                            */
/*  NOTA: el cifrado/HMAC real se aplica en la capa de seguridad             */
/*  (`core/security`, fuera del alcance de Fase 1); aquí solo se modela el    */
/*  esquema de columnas. Un futuro `PatientDTO` "plano" (con `name`/`dob`      */
/*  descifrados en memoria, nunca persistido) se define en la capa de         */
/*  servicio cuando se implemente la seudonimización completa.                */
/* -------------------------------------------------------------------------- */

export type PatientSex = 'M' | 'F' | 'O';

export interface PatientDTO {
  id: number;
  idHash: string;
  nameEnc: string;
  dobEnc: string;
  sex: PatientSex;
  legalGuardianName: string;
  centerId: number | null;
  createdAt: string;
}

@Entity('patient')
export class Patient {
  @PrimaryGeneratedColumn()
  id: number;

  /** HMAC-SHA256(NHC, device_key) — referencia seudonimizada, nunca el NHC directo. */
  @Column({ unique: true })
  idHash: string;

  /** AES-256-GCM(nombre_completo), almacenado como blob/base64. */
  @Column('text')
  nameEnc: string;

  /** AES-256-GCM(fecha_nacimiento), almacenado como blob/base64. */
  @Column('text')
  dobEnc: string;

  @Column({ type: 'varchar', default: 'O' })
  sex: PatientSex;

  @Column({ default: '' })
  legalGuardianName: string;

  @Column({ type: 'int', nullable: true })
  centerId: number | null;

  @CreateDateColumn()
  @Transform(({ value }) => value?.toISOString(), { toPlainOnly: true })
  @Transform(({ value }) => (value ? new Date(value) : null), { toClassOnly: true })
  createdAt: Date;

  /** Alias de lectura sobre `idHash` para las pantallas que muestran el NHC. */
  get nhc(): string {
    return this.idHash;
  }

  /** Nombre(s) — primer token de `nameEnc` (sin cifrado real en Fase 1). */
  get name(): string {
    return this.nameEnc?.split(' ')[0] ?? '';
  }

  /** Apellidos — resto de tokens de `nameEnc` (sin cifrado real en Fase 1). */
  get lastName(): string {
    return this.nameEnc?.split(' ').slice(1).join(' ') ?? '';
  }
}
