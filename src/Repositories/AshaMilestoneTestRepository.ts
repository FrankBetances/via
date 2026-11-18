import { AshaMilestoneTest } from '@/Models/Asha/AshaMilestoneTest';
import { Repository } from 'typeorm';
import { AppDataSource } from '@/Database/config';

/**
 * Repositorio del cribado de Hitos ASHA (singleton).
 */
export class AshaMilestoneTestRepository {
  private static instance: AshaMilestoneTestRepository | null = null;
  private repository: Repository<AshaMilestoneTest> | null = null;
  private isInitialized: boolean = false;

  private constructor() {}

  static getInstance(): AshaMilestoneTestRepository {
    if (!this.instance) {
      this.instance = new AshaMilestoneTestRepository();
    }
    return this.instance;
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized && this.repository) {
      return;
    }
    this.repository = AppDataSource.getRepository(AshaMilestoneTest);
    this.isInitialized = true;
  }

  private async getRepository(): Promise<Repository<AshaMilestoneTest>> {
    if (!this.isInitialized || !this.repository) {
      await this.initialize();
    }
    if (!this.repository) {
      throw new Error('AshaMilestoneTestRepository: repository could not be initialized.');
    }
    return this.repository;
  }

  static async createAshaTest(test: AshaMilestoneTest): Promise<AshaMilestoneTest> {
    const instance = this.getInstance();
    const repository = await instance.getRepository();
    return await repository.save(test);
  }

  /**
   * Orden: la más reciente primero. `createdAt` lo rellena SQLite con
   * `datetime('now')`, que tiene resolución de UN segundo, y la clave es un
   * UUID sin orden temporal: dos pruebas guardadas en el mismo segundo
   * empataban y la «última» la decidía el UUID, es decir, el azar (hallado por
   * los tests de B2, 17/11/2026). El desempate es `rowid`, el orden de
   * inserción de SQLite: la guardada después gana siempre.
   */
  private static byEvaluation(repository: Repository<AshaMilestoneTest>, evaluationId: number) {
    return repository
      .createQueryBuilder('asha')
      .leftJoinAndSelect('asha.evaluation', 'evaluation')
      .where('evaluation.id = :evaluationId', { evaluationId })
      .orderBy('asha.createdAt', 'DESC')
      .addOrderBy('asha.rowid', 'DESC');
  }

  static async getAshaTestsByEvaluation(evaluationId: number): Promise<AshaMilestoneTest[]> {
    const instance = this.getInstance();
    const repository = await instance.getRepository();
    return await this.byEvaluation(repository, evaluationId).getMany();
  }

  static async getLatestAshaTestByEvaluation(evaluationId: number): Promise<AshaMilestoneTest | null> {
    const instance = this.getInstance();
    const repository = await instance.getRepository();
    return await this.byEvaluation(repository, evaluationId).getOne();
  }
}
