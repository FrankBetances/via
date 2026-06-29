import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Exclude, Transform, Type } from 'class-transformer';
import { Evaluation } from '@/Models/Evaluation/Evaluation';

/* -------------------------------------------------------------------------- */
/*  GameTest — fila genérica que une una evaluación con la ejecución de un    */
/*  módulo concreto de la batería gamificada (`moduleKey`, p.ej.              */
/*  'audiometry' | 'voice-analysis' | 'articulation' | ...). El resultado      */
/*  detallado de cada módulo vive en su propia entidad (AudiometryTest,        */
/*  VoiceAnalysis, etc., registradas en fases posteriores); GameTest solo      */
/*  registra QUE el módulo se ejecutó dentro de la evaluación y su estado.     */
/* -------------------------------------------------------------------------- */

export type GameTestStatus = 'in_progress' | 'completed' | 'cancelled';

export interface GameTestDTO {
  id: number;
  evaluationId: number;
  moduleKey: string;
  status: GameTestStatus;
  createdAt: string;
}

@Entity('game_test')
export class GameTest {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Evaluation, { eager: true })
  @Exclude({ toPlainOnly: true })
  @Type(() => Evaluation)
  evaluation: Evaluation;

  /** Clave del módulo de la batería, p.ej. 'audiometry' | 'articulation'. */
  @Column()
  moduleKey: string;

  @Column({ type: 'varchar', default: 'in_progress' })
  status: GameTestStatus;

  @CreateDateColumn()
  @Transform(({ value }) => value?.toISOString(), { toPlainOnly: true })
  @Transform(({ value }) => (value ? new Date(value) : null), { toClassOnly: true })
  createdAt: Date;
}
