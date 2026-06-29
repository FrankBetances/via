import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Transform } from 'class-transformer';

/* -------------------------------------------------------------------------- */
/*  Media — referencia a un fichero local (foto/vídeo/audio) capturado        */
/*  durante la evaluación (p.ej. foto de Evaluación Clínica, vídeo de         */
/*  Disfagia). Solo guarda la URI local; el binario vive en el filesystem.    */
/* -------------------------------------------------------------------------- */

export type MediaType = 'photo' | 'video' | 'audio';

export interface MediaDTO {
  id: number;
  uri: string;
  type: MediaType;
  createdAt: string;
}

@Entity('media')
export class Media {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  uri: string;

  @Column({ type: 'varchar' })
  type: MediaType;

  @CreateDateColumn()
  @Transform(({ value }) => value?.toISOString(), { toPlainOnly: true })
  @Transform(({ value }) => (value ? new Date(value) : null), { toClassOnly: true })
  createdAt: Date;
}
