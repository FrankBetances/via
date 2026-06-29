import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Transform } from 'class-transformer';

/* -------------------------------------------------------------------------- */
/*  MedicalCenter — centro sanitario al que pertenecen profesionales y         */
/*  pacientes. Entidad CORE (no de módulo clínico).                           */
/* -------------------------------------------------------------------------- */

export interface MedicalCenterDTO {
  id: number;
  name: string;
  address: string;
  createdAt: string;
}

@Entity('medical_center')
export class MedicalCenter {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ default: '' })
  address: string;

  @CreateDateColumn()
  @Transform(({ value }) => value?.toISOString(), { toPlainOnly: true })
  @Transform(({ value }) => (value ? new Date(value) : null), { toClassOnly: true })
  createdAt: Date;
}
