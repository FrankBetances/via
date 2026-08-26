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

  static async getAshaTestsByEvaluation(evaluationId: number): Promise<AshaMilestoneTest[]> {
    const instance = this.getInstance();
    const repository = await instance.getRepository();
    return await repository.find({
      // `as any` como en el resto de repositorios: TypeORM admite filtrar por
      // la relación con un objeto parcial, pero su tipo `FindOptionsWhere`
      // exige la entidad entera.
      where: { evaluation: { id: evaluationId } as any },
      relations: ['evaluation'],
      order: { createdAt: 'DESC' },
    });
  }

  static async getLatestAshaTestByEvaluation(evaluationId: number): Promise<AshaMilestoneTest | null> {
    const instance = this.getInstance();
    const repository = await instance.getRepository();
    return await repository.findOne({
      where: { evaluation: { id: evaluationId } as any },
      relations: ['evaluation'],
      order: { createdAt: 'DESC' },
    });
  }
}
